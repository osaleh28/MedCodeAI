import test from "node:test";
import assert from "node:assert/strict";
import { potentialIdentifiers } from "../src/lib/clinical/privacy";
import { analysisInputSchema, emptySections } from "../src/lib/clinical/input";
import { checkDocxArchive, checkedExtractedText, MAX_FILE_BYTES, noteFileFormat } from "../src/lib/clinical/file-input";
import { reportSchema } from "../src/lib/clinical/report";
import { demoCases } from "../src/lib/clinical/demos";
import { evaluateMdm } from "../src/lib/clinical/mdm";

const input = { noteType: "progress", inputMode: "full", fullNote: "Fictional teaching documentation.", sections: emptySections, documentSource: "deidentified", privacyConfirmed: true, deidentificationConfirmed: true, encounterConfirmed: true, improveHpi: false, providerMode: "openai", sampleId: null };
test("de-identified source requires separate explicit permission and cannot claim a prepared fixture", () => {
  assert.equal(analysisInputSchema.safeParse(input).success, true);
  for (const changed of [{ deidentificationConfirmed: false }, { privacyConfirmed: false }, { privacyConfirmed: undefined, syntheticOnly: true }, { providerMode: "prepared_demo" }]) assert.equal(analysisInputSchema.safeParse({ ...input, ...changed }).success, false);
  assert.equal(analysisInputSchema.safeParse({ ...input, documentSource: "synthetic", deidentificationConfirmed: false }).success, true);
});
test("screening returns categories without reproducing identifier values", () => {
  for (const note of ["Patient name: Fictional Person", "Patient: Fictional Person", "Patient's Full Name: Fictional Person", "Name: Person, Fictional", "DOB: 1970-01-01", "Date of birth 01/01/1970", "Birthdate: March 1, 1970", "MRN: 123456", "MRN 123456", "Medical record number: A123456", "Medical record no. 123456", "Medical record # 123456"]) {
    const result = potentialIdentifiers(note);
    assert.ok(result.length > 0, note);
    assert.ok(!result.join(", ").includes(note));
  }
  for (const note of ["BP 118/72, motor strength 5/5, sodium 138.", "ROS obtained from the patient: no fever.", "Patient name: [redacted]\nMRN: removed\nDOB: omitted", "Age 90 or older. Admission year 2026."]) assert.deepEqual(potentialIdentifiers(note), []);
});
test("historical dates remain unchanged and do not block either documentation mode", () => {
  const history = "Fictional teaching history: appendectomy on 03/15/2010. Prior admission 2019-07-02. Cardiac study on October 28, 2020.";
  assert.deepEqual(potentialIdentifiers(history), []);
  for (const noteType of ["admission", "progress"] as const) {
    const full = analysisInputSchema.parse({ ...input, noteType, fullNote: history });
    assert.equal(full.fullNote, history);
    const sections = analysisInputSchema.parse({ ...input, noteType, inputMode: "sections", fullNote: "", sections: { ...emptySections, assessmentPlan: history } });
    assert.equal(sections.sections.assessmentPlan, history);
  }
  assert.deepEqual(potentialIdentifiers("DOB: 1970-01-01\nPrior operation 2010-03-15."), ["patient date of birth"]);
});
test("the configured three-category screen is not a complete identifier detector", () => {
  assert.deepEqual(potentialIdentifiers("Contact fiction@example.invalid; call 212-555-0100; SSN 123-45-6789; 123 Main Street."), []);
  assert.deepEqual(potentialIdentifiers("I reviewed the medical record and previous discharge summary."), []);
  assert.deepEqual(potentialIdentifiers("Physician name: Fictional Clinician\nMedication name: Example Drug"), []);
  assert.deepEqual(potentialIdentifiers("Patient name: [redacted] DOB: [redacted] MRN: [redacted]"), []);
});
test("only bounded supported file formats and nonempty readable text are accepted", () => {
  for (const format of ["DOCX", "docx", "TXT", "txt"]) assert.equal(noteFileFormat(`note.${format}`, 10), format.toLowerCase());
  for (const [name, size] of [["note.doc", 10], ["note.docm", 10], ["note.txt.exe", 10], ["note.pdf", 0], ["note.txt", MAX_FILE_BYTES + 1]] as const) assert.throws(() => noteFileFormat(name, size));
  for (const extension of ["pdf", "PDF"]) assert.throws(() => noteFileFormat(`note.${extension}`, 10), /PDF imports are not supported/);
  assert.equal(checkedExtractedText("  HPI\r\nFictional note.  "), "HPI\nFictional note.");
  for (const text of ["", " \n", "binary\0content", "a".repeat(24_001)]) assert.throws(() => checkedExtractedText(text));
});
test("DOCX screening rejects corrupt archives and inflated ZIP sizes before extraction", async () => {
  // JSZip is Mammoth's installed ZIP reader; construct fictional fixture bytes only.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("word/document.xml", "<document>Fictional note</document>");
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  assert.doesNotThrow(() => checkDocxArchive(bytes));
  assert.throws(() => checkDocxArchive(new ArrayBuffer(10)));
  const oversized = bytes.slice(0);
  const view = new DataView(oversized);
  for (let i = 0; i <= oversized.byteLength - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 9 * 1024 * 1024, true); break; }
  assert.throws(() => checkDocxArchive(oversized));
  const wrongArchive = new JSZip(); wrongArchive.file("unrelated.txt", "Fictional note");
  const unrelated = await wrongArchive.generateAsync({ type: "arraybuffer" });
  assert.throws(() => checkDocxArchive(unrelated));
});
test("older reports default to fictional; declared source never changes deterministic coding", () => {
  const sample = demoCases[0];
  const mdm = evaluateMdm(sample.extraction, sample.note, sample.noteType);
  const old = { schemaVersion: 1, origin: "prepared_demo", model: null, demoCaseId: sample.id, exampleRationale: null, extraction: sample.extraction, mdm, hpi: null };
  assert.equal(reportSchema.parse(old).documentSource, "synthetic");
  assert.deepEqual(reportSchema.parse({ ...old, documentSource: "deidentified" }).mdm, mdm);
});
