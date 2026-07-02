import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Pinecone } from '@pinecone-database/pinecone';
import pdf from 'pdf-parse';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, Math.min(start + chunkSize, text.length)));
    start += chunkSize - overlap;
  }
  return chunks.filter(c => c.trim().length > 0);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: CORS_HEADERS });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdf(buffer);
    const text = pdfData.text
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');

    if (!text.trim()) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400, headers: CORS_HEADERS });
    }

    const chunks = chunkText(text);

    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX);

    // Embed in batches of 96 (Pinecone inference limit)
    const BATCH_SIZE = 96;
    const filename = file.name.replace(/\.[^/.]+$/, '');
    const timestamp = Date.now();
    let totalUpserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      const embeddings = await pc.inference.embed({
        model: 'llama-text-embed-v2',
        inputs: batch,
        parameters: { inputType: 'passage', truncate: 'END' },
      });

      const vectors = batch.map((chunk, j) => ({
        id: `${filename}-${timestamp}-chunk-${i + j}`,
        values: embeddings.data[j].values,
        metadata: { text: chunk, source: file.name, chunkIndex: i + j },
      }));

      await index.namespace(userId).upsert({ records: vectors });
      totalUpserted += vectors.length;
    }

    return NextResponse.json(
      { success: true, chunksUploaded: totalUpserted, filename: file.name },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Upload error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
