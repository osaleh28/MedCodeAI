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
  if (format === "docx") {
    checkDocxArchive(bytes);
    const mammoth = await import("mammoth/mammoth.browser");
    try { return checkedExtractedText((await mammoth.extractRawText({ arrayBuffer: bytes })).value); }
    catch { throw new Error("Unable to read this DOCX. Export a plain-text copy and try again."); }
  }
  const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdf.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdf.getDocument({ data: new Uint8Array(bytes), disableFontFace: true, useWorkerFetch: false, enableXfa: false, verbosity: 0 });
  try {
    const document = await task.promise;
    if (document.numPages > 40) throw new Error("Use a PDF with no more than 40 pages.");
    const pages: string[] = [];
    let length = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      length += text.length;
      if (length > 24_000) throw new Error("The extracted note exceeds 24,000 characters. Use a shorter document.");
      pages.push(text);
      page.cleanup();
    }
    return checkedExtractedText(pages.join("\n\n"));
  } catch (error) {
    if (error instanceof Error && (error.message.includes("24,000") || error.message.includes("40 pages") || error.message.includes("OCR"))) throw error;
    throw new Error("Unable to read this PDF. Use an unencrypted PDF with selectable text, or export a DOCX/TXT copy. Scanned images need OCR outside this app.");
  } finally { await task.destroy(); }
}
