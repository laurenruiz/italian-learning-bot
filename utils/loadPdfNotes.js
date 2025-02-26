async function loadPdfNotes() {
  const fs = require('fs');
  const path = require('path');
  const pdf = (await import('pdf-parse')).default;
  
  // List your PDF filenames
  const files = [
    'notes_1.pdf',
    'notes_2.pdf',
    'notes_3.pdf',
    'notes_4.pdf',
    'notes_5.pdf',
    'notes_6.pdf',
    'notes_7.pdf',
    'notes_8.pdf',
    'notes_9.pdf',
    'notes_10.pdf',
    'notes_11.pdf',
    'notes_12.pdf',
    'notes_13.pdf',
    'notes_14.pdf'
  ];

  let combinedText = '';

  for (const file of files) {
    // This will look for files in the "pdfs" folder at the project root.
    const filePath = path.join(process.cwd(), 'pdfs', file);
    if (fs.existsSync(filePath)) {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      combinedText += data.text + "\n";
    } else {
      console.warn(`File not found: ${filePath}`);
    }
  }

  // Remove empty lines from the combined text:
  combinedText = combinedText
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');

  return combinedText;
}

module.exports = { loadPdfNotes };
