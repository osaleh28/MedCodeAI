// Parser smoke test using generated fictional bytes only. No local notes,
// network calls, provider calls, file uploads or database writes.
import assert from "node:assert/strict";
import JSZip from "jszip";
import mammoth from "mammoth/mammoth.browser.js";
import { checkDocxArchive, checkedExtractedText, noteFileFormat } from "../.npm-cache/unit-tests/src/lib/clinical/file-input.js";

const text = "Fictional teaching note. No identifying details.";
const zip = new JSZip();
zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
const docx = await zip.generateAsync({ type: "arraybuffer" });
checkDocxArchive(docx);
assert.equal(checkedExtractedText((await mammoth.extractRawText({ arrayBuffer: docx })).value), text);
console.log("PASS browser Mammoth raw-text parser reads generated fictional DOCX.");

assert.throws(() => noteFileFormat("fictional.pdf", 100), /PDF imports are not supported/);
console.log("PASS PDF imports are rejected before extraction.");
assert.equal(checkedExtractedText(new TextDecoder("utf-8", { fatal: true }).decode(new TextEncoder().encode(text))), text);
console.log("PASS UTF-8 text decoding. Browser file-picker and extraction review still require manual acceptance.");
