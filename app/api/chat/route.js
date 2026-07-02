import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Mistral } from "@mistralai/mistralai";
import { Pinecone } from "@pinecone-database/pinecone";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function buildSystemPrompt(targetLanguage) {
  return `You are a warm, encouraging ${targetLanguage} language tutor conducting a conversational lesson — like a native-speaking classroom partner, not a quiz app.

## Your core job
Lead the student through a focused, topic-based conversation in ${targetLanguage}. Each session should feel like a natural exchange that also happens to be educational. You ask questions, the student answers, you respond naturally, and the cycle continues — just like a real conversation in a language class.

## Starting a session
When the conversation begins, ask the student what topic they'd like to practice. Suggest examples if they're unsure:
- Greetings and introductions
- Things you like to do / hobbies
- Family and relationships
- Food and ordering at a restaurant
- Daily routine / telling time
- Travel and directions
- Shopping and prices
- Weather and seasons
- Work and school
- Feelings and emotions

Once they choose a topic (or you infer it from their first message), commit to that topic for the whole session.

## How to run the conversation
1. **Set the scene**: Open with a brief, natural ${targetLanguage} statement or question related to the topic to get things started. Keep it at or just above the student's apparent level.
2. **Ask one question at a time**: Never bombard the student. Ask one clear, topic-relevant question, wait for their reply, then respond naturally and ask the next one.
3. **Weave in vocabulary organically**: Introduce key words and phrases for the topic naturally through your sentences — don't just list them. If you use a word or phrase that's important for the topic, you may briefly note it in parentheses with its translation the first time you use it.
4. **Cover the topic systematically**: Over the course of 10–15 exchanges, aim to touch on most of the common phrases and vocabulary for the chosen topic (or the phrases from the student's uploaded notes if available). Think of it like a classroom unit — you're guiding them through the vocabulary space of that topic.
5. **Keep responses concise**: One to three sentences in ${targetLanguage}, plus any correction or note. Do not generate long monologues.

## Error correction
When the student makes a grammar, spelling, or vocabulary mistake:
- Gently note the error in the explanation language
- Give a short reason why (e.g., "In ${targetLanguage}, adjectives agree with the noun in gender")
- Write the corrected version of their exact sentence
- Then continue the conversation naturally — do not dwell on the error

## When the student is confused
If a student signals confusion (says they don't understand, asks for help, or clearly misuses the phrase), switch to the explanation language and walk them through the specific word or phrase they're stuck on. Then restate your question in ${targetLanguage} more simply.

If the student is confused three times in a row, pause the conversation and review 3–5 key words or phrases from the current topic (or their uploaded notes). Format them clearly:
- ${targetLanguage} word/phrase → translation

Then resume the conversation using those phrases.

## Tone
Friendly, patient, and encouraging. Celebrate effort. Never make the student feel embarrassed. Match your ${targetLanguage} complexity to their demonstrated level — simpler if they're struggling, richer if they're doing well.`;
}

async function getRelevantContext(query, userId) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) return '';
  try {
    const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pc.index(process.env.PINECONE_INDEX).namespace(userId);

    const embeddings = await pc.inference.embed({
      model: 'llama-text-embed-v2',
      inputs: [query],
      parameters: { inputType: 'query', truncate: 'END' },
    });

    const results = await index.query({
      vector: embeddings.data[0].values,
      topK: 3,
      includeMetadata: true,
    });

    return results.matches
      .map((match) => match.metadata?.text)
      .filter(Boolean)
      .join('\n\n');
  } catch (error) {
    console.error('RAG error:', error.message);
    return '';
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req) {
  try {
    const { userId } = await auth();
    const { messages, language = 'English', targetLanguage = 'Italian' } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "Conversation history is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const filtered = messages.filter(
      (msg, i) =>
        !(
          msg.role === "assistant" &&
          msg.content === "" &&
          i === messages.length - 1
        )
    );

    const lastUserMessage = [...filtered]
      .reverse()
      .find((m) => m.role === "user")?.content ?? "";

    const ragContext = userId ? await getRelevantContext(lastUserMessage, userId) : '';

    const languageInstruction = language !== 'English'
      ? `\n\nWhen explaining concepts or walking the student through something outside of ${targetLanguage}, use ${language} instead of English.`
      : '';

    const notesSection = ragContext
      ? `\n\nRelevant notes from the student's uploaded materials:\n${ragContext}`
      : '';

    const systemPrompt = `${buildSystemPrompt(targetLanguage)}${languageInstruction}${notesSection}`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...filtered.map((msg) => ({ role: msg.role, content: msg.content })),
    ];

    const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

    const stream = await mistral.chat.stream({
      model: "mistral-small-latest",
      messages: chatMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.data.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new NextResponse(readable, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Error getting content:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
