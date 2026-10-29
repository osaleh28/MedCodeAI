"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, LoaderCircle } from "lucide-react";
import { analysisInputSchema, emptySections, noteLabels, normalizeDocumentation, sectionKeys, sectionLabels, type NoteType } from "@/lib/clinical/input";
import { demoCases } from "@/lib/clinical/demos";
import { MdmLearningGuide } from "@/components/mdm-learning-guide";
import { NoteFileImport } from "@/components/note-file-import";
import { documentSourceLabels, potentialIdentifiers, type DocumentSource } from "@/lib/clinical/privacy";
import { ProgressNoteGuide } from "@/components/progress-note-guide";

export function NewAnalysisForm() {
  const router = useRouter();
  const [noteType, setNoteType] = useState<NoteType>("admission");
  const [inputMode, setInputMode] = useState<"full" | "sections">("full");
  const [fullNote, setFullNote] = useState("");
  const [sections, setSections] = useState({ ...emptySections });
  const [documentSource, setDocumentSource] = useState<DocumentSource>("synthetic");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [deidentificationConfirmed, setDeidentificationConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  function resetPrivacy() { setPrivacyConfirmed(false); setDeidentificationConfirmed(false); }
  const [encounterConfirmed, setEncounterConfirmed] = useState(false);
  const [improveHpi, setImproveHpi] = useState(false);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const activeNote = normalizeDocumentation({ noteType, inputMode, fullNote, sections });
  const selectedSample = demoCases.find((sample) => sample.id === sampleId);
  const unchangedSample = selectedSample?.noteType === noteType && selectedSample.note === activeNote;
  const usePreparedExample = unchangedSample && documentSource === "synthetic";

  function loadSample(id: string) {
    if (!id) { setSampleId(null); setError(""); return; }
    const sample = demoCases.find((item) => item.id === id);
    if (!sample) return;
    if ((fullNote.trim() || Object.values(sections).some((value) => value.trim())) && !window.confirm("Replace both documentation drafts with this fictional example?")) return;
    setNoteType(sample.noteType); setFullNote(sample.note); setSections({ ...sample.sections });
    setEncounterConfirmed(false); resetPrivacy(); setDocumentSource("synthetic");
    setSampleId(id); setError("");
  }

  async function submit(providerMode: "openai" | "prepared_demo") {
    if (pending || importing) return;
    const identifiers = potentialIdentifiers(activeNote);
    if (identifiers.length) { setError(`Potential identifying information detected: ${identifiers.join(", ")}. Remove it before submitting. This screen cannot certify de-identification.`); return; }
    const activeSections = { ...emptySections };
    if (inputMode === "sections") for (const key of sectionKeys(noteType)) activeSections[key] = sections[key];
    const input = analysisInputSchema.safeParse({ noteType, inputMode, fullNote: inputMode === "full" ? fullNote : "", sections: activeSections,
      documentSource, privacyConfirmed, deidentificationConfirmed, encounterConfirmed, improveHpi: noteType === "admission" && improveHpi, providerMode, sampleId });
    if (!input.success) {
      setError(input.error.issues.map((issue) => issue.path[0] === "encounterConfirmed"
        ? "Step 1: confirm this example represents the initial hospital visit or subsequent hospital visit selected above."
        : issue.path[0] === "privacyConfirmed" ? "Step 3: confirm that the documentation contains no identifying patient information and is authorized for this demonstration."
          : issue.message).join(" "));
      // Focus also works when the same validation message is already displayed.
      errorRef.current?.focus();
      return;
    }
    setPending(true); setError("");
    try {
      const response = await fetch("/api/analyses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.data),
      });
      const result = await response.json();
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) { setError(result.error ?? "Unable to analyze documentation. Please try again."); return; }
      router.push(`/dashboard/analyses/${result.id}`);
    } catch { setError("The request could not finish. Check your connection, then check History before retrying in case the analysis was saved."); }
    finally { setPending(false); }
  }

  return <form className="analysis-form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(usePreparedExample ? "prepared_demo" : "openai"); }}>
    <fieldset disabled={pending || importing} className="analysis-fieldset">
      <legend className="sr-only">Educational documentation analysis</legend>
      <MdmLearningGuide />
      <section className="panel"><div className="panel-heading"><h2>1. Choose your workflow</h2><span className="label">MDM only</span></div>
        <fieldset className="workflow-options"><legend className="sr-only">Note type</legend>{(["admission", "progress"] as const).map((type) => <label className={`workflow-option ${noteType === type ? "selected" : ""}`} key={type}><input type="radio" name="noteType" checked={noteType === type} onChange={() => { setNoteType(type); setEncounterConfirmed(false); resetPrivacy(); }} /><span><strong>{noteLabels[type]}</strong><small>{type === "admission" ? "Assumes initial hospital inpatient/observation care · 99221–99223" : "Assumes subsequent hospital inpatient/observation care · 99231–99233"}</small></span></label>)}</fieldset>
        <p className="field-help">These are encounter assumptions. A note title alone does not establish the billable service. Time-based billing is excluded.</p>
        <label className="checkbox-label mt-4"><input type="checkbox" checked={encounterConfirmed} onChange={(e) => setEncounterConfirmed(e.target.checked)} aria-describedby="encounter-scope" required /><span>I confirm this example represents the initial hospital visit or subsequent hospital visit selected above.</span></label>
        <p id="encounter-scope" className="field-help mt-3">This demo evaluates these two hospital-care categories only. Consultation, critical-care, discharge, and same-day admission/discharge coding are outside its scope.</p>
      </section>

      <section className="panel"><div className="sample-picker"><div><h2>Load a complete example note</h2><p>Selecting an example fills in the documentation below. Review the note, then choose Run prepared example to see its teaching assessment. You do not need to write a note.</p></div><div className="field"><label htmlFor="demo-case">Choose an example note</label><select id="demo-case" value={sampleId ?? ""} onChange={(e) => loadSample(e.target.value)}><option value="">Choose an example…</option><optgroup label="Core note workflows">{demoCases.filter((sample) => sample.group !== "worksheet").map((sample) => <option key={sample.id} value={sample.id}>{sample.title.replace("Worksheet practice", "Teaching example")}</option>)}</optgroup><optgroup label="MDM teaching examples">{demoCases.filter((sample) => sample.group === "worksheet").map((sample) => <option key={sample.id} value={sample.id}>{sample.title.replace("Worksheet practice", "Teaching example")}</option>)}</optgroup></select></div></div>{selectedSample?.learningFocus && <p className="sample-learning-focus mt-4"><strong>Learning focus:</strong> {selectedSample.learningFocus}</p>}</section>

      {noteType === "progress" && <ProgressNoteGuide />}

      <section className="panel"><div className="panel-heading"><h2>2. Add documentation</h2></div>
        <div className="field mb-5"><label htmlFor="document-source">Documentation source</label><select id="document-source" value={documentSource} onChange={(e) => { setDocumentSource(e.target.value as DocumentSource); resetPrivacy(); }}>{Object.entries(documentSourceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
        <p className="field-help mb-5">Real-case notes must already be fully de-identified before entering this app. Removing a name alone is insufficient. Automatic screening focuses on patient full names, dates of birth, and hospital MRNs. Historical calendar dates are not automatically blocked. Dates, contact details, locations, and other context may still identify a person and require your review. This app cannot certify de-identification and is not HIPAA-compliant. <a className="text-link" href="https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html" target="_blank" rel="noreferrer">Read HHS guidance</a>.</p>
        <NoteFileImport onBusy={setImporting} onApply={(text) => { if (fullNote.trim() && !window.confirm("Replace your full-note draft with the reviewed file text?")) return false; setFullNote(text); setInputMode("full"); setSampleId(null); setEncounterConfirmed(false); resetPrivacy(); return true; }} />
        <fieldset className="input-mode-options"><legend>Input method</legend>{(["full", "sections"] as const).map((mode) => <label key={mode}><input type="radio" name="inputMode" checked={inputMode === mode} onChange={() => { setInputMode(mode); resetPrivacy(); }} /> {mode === "full" ? "Full note" : "Separate sections"}</label>)}</fieldset>
        <p className="field-help mb-5">Your drafts stay here when you switch modes. Only the active mode and the selected workflow’s fields are submitted. Drafts are not stored in browser storage.</p>
        {inputMode === "full" ? <div className="field"><label htmlFor="full-note">Complete {noteLabels[noteType]}</label><textarea id="full-note" rows={17} maxLength={24_000} value={fullNote} onChange={(e) => { setFullNote(e.target.value); resetPrivacy(); }} placeholder="Paste fictional or fully de-identified clinical documentation. Never enter identifying patient information." /><span className="field-help">{fullNote.length.toLocaleString()} / 24,000 characters</span></div> : <div className="section-inputs">{sectionKeys(noteType).map((key, index) => <details key={key} open={index === 0 || key === "assessmentPlan"}><summary>{sectionLabels[key]} <span className="field-help">{sections[key].trim() ? "Text added" : "Optional"}</span></summary><div className="field"><label className="sr-only" htmlFor={`section-${key}`}>{sectionLabels[key]}</label><textarea id={`section-${key}`} rows={key === "assessmentPlan" || key === "hpi" ? 6 : 4} maxLength={24_000} value={sections[key]} onChange={(e) => { setSections((previous) => ({ ...previous, [key]: e.target.value })); resetPrivacy(); }} placeholder={`Add ${sectionLabels[key].toLowerCase()} if documented.`} /></div></details>)}</div>}
        {noteType === "admission" && <div className="hpi-option"><label className="checkbox-label"><input type="checkbox" checked={improveHpi} onChange={(e) => setImproveHpi(e.target.checked)} /><span><strong>Improve HPI (optional)</strong><br />Include a separate wording suggestion and clarification questions. It will not replace your note or affect the MDM calculation.</span></label></div>}
      </section>

      <section className="panel"><h2>3. Review and analyze</h2><label className="checkbox-label mt-5"><input type="checkbox" checked={privacyConfirmed} onChange={(e) => setPrivacyConfirmed(e.target.checked)} required /><span>I confirm the active documentation contains no identifying patient information and I am authorized to use it. {usePreparedExample ? "The submitted text and prepared results are saved to my account without an AI request." : "Live analysis sends the reviewed text to OpenAI; the submitted text and results are saved to my account."}</span></label>
        {documentSource === "deidentified" && <label className="checkbox-label mt-4"><input type="checkbox" checked={deidentificationConfirmed} onChange={(e) => setDeidentificationConfirmed(e.target.checked)} required /><span>This real-case note was fully de-identified before entering this app, with all potentially identifying details and context reviewed. I reviewed it and understand automated screening cannot verify this.</span></label>}
        <div className="analysis-actions"><button className="button primary" type="submit" disabled={pending} aria-describedby="analysis-mode-help">{pending ? <><LoaderCircle size={18} className="spin" /> {usePreparedExample ? "Loading and saving..." : "Analyzing and saving..."}</> : usePreparedExample ? <><FlaskConical size={17} /> Run prepared example</> : <>Run live AI analysis <ArrowRight size={17} /></>}</button></div>
        <p id="analysis-mode-help" className="field-help mt-3">{usePreparedExample
          ? "This complete fictional note uses a built-in teaching assessment. No AI request is made. Your result is saved to History."
          : selectedSample
            ? "This note differs from the selected fictional example or its source setting has changed. Live AI analyzes the active documentation, then saves the result."
            : "Notes you paste, import, or write use live AI analysis. Use fictional or fully de-identified documentation only."} {!usePreparedExample && "Live analysis sends the reviewed text to OpenAI and may take up to a minute."}</p>
        <div aria-live="polite" aria-atomic="true">{pending && <p className="field-help mt-3" role="status">{usePreparedExample ? "Loading the prepared teaching assessment and saving your results. Please keep this page open." : "Analyzing documentation with AI, evaluating MDM, and saving your results. Please keep this page open."}</p>}{error && <p ref={errorRef} tabIndex={-1} role="alert" className="form-error mt-4">{error}</p>}</div>
      </section>
    </fieldset>
  </form>;
}
