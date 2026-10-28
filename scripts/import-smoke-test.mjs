// Parser smoke test using generated fictional bytes only. No local notes,
// network calls, provider calls, file uploads or database writes.
import assert from "node:assert/strict";
import JSZip from "jszip";
import mammoth from "mammoth/mammoth.browser.js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { checkDocxArchive, checkedExtractedText } from "../.npm-cache/unit-tests/src/lib/clinical/file-input.js";

const text = "Fictional teaching note. No identifying details.";
const zip = new JSZip();
zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
const docx = await zip.generateAsync({ type: "arraybuffer" });
checkDocxArchive(docx);
assert.equal(checkedExtractedText((await mammoth.extractRawText({ arrayBuffer: docx })).value), text);
console.log("PASS browser Mammoth raw-text parser reads generated fictional DOCX.");

const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const start = pdf.length;
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
const task = getDocument({ data: new TextEncoder().encode(pdf), disableFontFace: true, useWorkerFetch: false, enableXfa: false, verbosity: 0 });
try {
  const document = await task.promise;
  assert.equal(document.numPages, 1);
  const content = await (await document.getPage(1)).getTextContent();
  assert.equal(checkedExtractedText(content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("")), text);
  console.log("PASS PDF.js text parser reads generated fictional selectable-text PDF.");
} finally { await task.destroy(); }
assert.equal(checkedExtractedText(new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(text))), text);
console.log("PASS UTF-8 text decoding. Browser file-picker, PDF worker loading and extraction review still require manual acceptance.");
