export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_NOTE_CHARACTERS = 24_000;
export type NoteFileFormat = "docx" | "txt";

export function noteFileFormat(name: string, size: number): NoteFileFormat {
  if (size <= 0 || size > MAX_FILE_BYTES) throw new Error("Choose a nonempty file no larger than 5 MB.");
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") throw new Error("PDF imports are not supported. Use Word .docx or plain .txt, or paste the note text.");
  if (extension !== "docx" && extension !== "txt") throw new Error("Choose a Word .docx or plain .txt file. Legacy .doc files are not supported.");
  return extension;
}

export function checkedExtractedText(value: string): string {
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (!text || text.includes("\0")) throw new Error("No readable text was found. Use a DOCX or UTF-8 TXT file containing text, or paste the note text.");
  if (text.length > MAX_NOTE_CHARACTERS) throw new Error("The extracted note exceeds 24,000 characters. Use a shorter document.");
  return text;
}

// Reject oversized/ambiguous ZIP archives before the DOCX parser inflates them.
export function checkDocxArchive(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  const invalid = () => new Error("This DOCX is damaged, encrypted, or too large to extract safely. Export a plain-text copy instead.");
  if (end < 0) throw invalid();
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let cursor = view.getUint32(end + 16, true);
  const directoryEnd = cursor + directorySize;
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 || count !== view.getUint16(end + 8, true) || count > 1_000 || directoryEnd !== end) throw invalid();
  let total = 0;
  let documentFound = false;
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directoryEnd || view.getUint32(cursor, true) !== 0x02014b50) throw invalid();
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const next = cursor + 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (next > directoryEnd || (flags & 1) || ![0, 8].includes(method) || size === 0xffffffff || view.getUint32(cursor + 42, true) === 0xffffffff) throw invalid();
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (seen.has(name) || name.includes("..") || name.startsWith("/")) throw invalid();
    seen.add(name);
    documentFound ||= name === "word/document.xml";
    total += size;
    if (total > 8 * 1024 * 1024) throw invalid();
    cursor = next;
  }
  if (cursor !== directoryEnd || !documentFound) throw invalid();
}
