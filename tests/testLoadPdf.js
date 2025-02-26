const { loadPdfNotes } = require("../utils/loadPdfNotes");

async function test() {
  try {
    const output = await loadPdfNotes();
    console.log("PDF Notes Output:\n", output);
  } catch (error) {
    console.error("Error loading PDF notes:", error);
  }
}

test();
