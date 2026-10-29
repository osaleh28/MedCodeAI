import { checkDocxArchive, checkedExtractedText, noteFileFormat } from "./file-input";

// Called only in the browser after a user chooses a file. The binary and its name
// never leave the browser. Only reviewed text can be submitted by the main form.
export async function importNote(file: File): Promise<string> {
  const format = noteFileFormat(file.name, file.size);
  const bytes = await file.arrayBuffer();
  if (format === "txt") {
    try { return checkedExtractedText(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch (error) {
      if (error instanceof TypeError) throw new Error("Save the text file using UTF-8 encoding and try again.");
      throw error;
    }
  }
  checkDocxArchive(bytes);
  const mammoth = await import("mammoth/mammoth.browser");
  try { return checkedExtractedText((await mammoth.extractRawText({ arrayBuffer: bytes })).value); }
  catch { throw new Error("Unable to read this DOCX. Export a plain-text copy and try again."); }
}
