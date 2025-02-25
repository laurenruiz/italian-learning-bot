// utils/loadPdfNotes.js
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

export async function loadPdfNotes() {
  // List your PDF filenames (adjust as needed)
  const files = [
    'notes_1.pdf',
    'notes_2.pdf',
    'notes_3.pdf',
    // add the rest...
  ];

  let combinedText = '';

  for (const file of files) {
    const filePath = path.join(process.cwd(), 'pdfs', file);
    if (fs.existsSync(filePath)) {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      combinedText += data.text + "\n";
    } else {
      console.warn(`File not found: ${filePath}`);
    }
  }
  return combinedText;
}
