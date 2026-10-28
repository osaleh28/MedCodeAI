"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical, LoaderCircle } from "lucide-react";
import { emptySections, noteLabels, normalizeDocumentation, sectionKeys, sectionLabels, type NoteType } from "@/lib/clinical/input";
import { demoCases } from "@/lib/clinical/demos";

export function NewAnalysisForm() {
  const router = useRouter();
  const [noteType, setNoteType] = useState<NoteType>("admission");
  const [inputMode, setInputMode] = useState<"full" | "sections">("full");
  const [fullNote, setFullNote] = useState("");
  const [sections, setSections] = useState({ ...emptySections });
  const [syntheticOnly, setSyntheticOnly] = useState(false);
  const [encounterConfirmed, setEncounterConfirmed] = useState(false);
  const [improveHpi, setImproveHpi] = useState(false);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const activeNote = normalizeDocumentation({ noteType, inputMode, fullNote, sections });
  const selectedSample = demoCases.find((sample) => sample.id === sampleId);
  const unchangedSample = selectedSample?.noteType === noteType && selectedSample.note === activeNote;

  function loadSample(id: string) {
    const sample = demoCases.find((item) => item.id === id);
    if (!sample) return;
    if ((fullNote.trim() || Object.values(sections).some((value) => value.trim())) && !window.confirm("Replace both documentation drafts with this fictional example?")) return;
    setNoteType(sample.noteType); setFullNote(sample.note); setSections({ ...sample.sections });
    setSampleId(id); setError("");
  }

  async function submit(providerMode: "openai" | "prepared_demo") {
    setPending(true); setError("");
    try {
      const activeSections = { ...emptySections };
      if (inputMode === "sections") for (const key of sectionKeys(noteType)) activeSections[key] = sections[key];
      const response = await fetch("/api/analyses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteType, inputMode, fullNote: inputMode === "full" ? fullNote : "", sections: activeSections,
          syntheticOnly, encounterConfirmed, improveHpi: noteType === "admission" && improveHpi, providerMode, sampleId }),
      });
      const result = await response.json();
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) { setError(result.error ?? "Unable to analyze documentation. Please try again."); return; }
      router.push(`/dashboard/analyses/${result.id}`);
    } catch { setError("The request could not finish. Check your connection, then check History before retrying in case the analysis was saved."); }
    finally { setPending(false); }
  }

  return <form className="analysis-form" onSubmit={(event) => { event.preventDefault(); void submit("openai"); }}>
    <fieldset disabled={pending} className="analysis-fieldset">
      <legend className="sr-only">Synthetic documentation analysis</legend>
      <section className="panel"><div className="panel-heading"><h2>1. Choose your workflow</h2><span className="label">MDM only</span></div>
        <fieldset className="workflow-options"><legend className="sr-only">Note type</legend>{(["admission", "progress"] as const).map((type) => <label className={`workflow-option ${noteType === type ? "selected" : ""}`} key={type}><input type="radio" name="noteType" checked={noteType === type} onChange={() => { setNoteType(type); setEncounterConfirmed(false); }} /><span><strong>{noteLabels[type]}</strong><small>{type === "admission" ? "Assumes initial hospital inpatient/observation care · 99221–99223" : "Assumes subsequent hospital inpatient/observation care · 99231–99233"}</small></span></label>)}</fieldset>
        <p className="field-help">These are encounter assumptions. A note title alone does not establish the billable service. Time-based billing is excluded.</p>
        <label className="checkbox-label mt-4"><input type="checkbox" checked={encounterConfirmed} onChange={(e) => setEncounterConfirmed(e.target.checked)} required /><span>This fictional encounter fits the selected hospital service family. It is not a consultation, critical-care service, discharge service, or same-day admission/discharge service.</span></label>
      </section>

      <section className="panel"><div className="sample-picker"><div><h2>Try a fictional case</h2><p>Load a case, review its documentation, and choose live AI or its prepared educational extraction.</p></div><div className="field"><label htmlFor="demo-case">Synthetic example</label><select id="demo-case" value={sampleId ?? ""} onChange={(e) => loadSample(e.target.value)}><option value="">Choose an example…</option>{demoCases.map((sample) => <option key={sample.id} value={sample.id}>{sample.title}</option>)}</select></div></div></section>

      <section className="panel"><div className="panel-heading"><h2>2. Add synthetic documentation</h2></div>
        <fieldset className="input-mode-options"><legend>Input method</legend>{(["full", "sections"] as const).map((mode) => <label key={mode}><input type="radio" name="inputMode" checked={inputMode === mode} onChange={() => setInputMode(mode)} /> {mode === "full" ? "Full note" : "Separate sections"}</label>)}</fieldset>
        <p className="field-help mb-5">Your drafts stay here when you switch modes. Only the active mode and the selected workflow’s fields are submitted. Drafts are not stored in browser storage.</p>
        {inputMode === "full" ? <div className="field"><label htmlFor="full-note">Complete {noteLabels[noteType]}</label><textarea id="full-note" rows={17} maxLength={24_000} value={fullNote} onChange={(e) => setFullNote(e.target.value)} placeholder="Paste an entirely fictional clinical note. Do not enter patient identifiers or real patient information." /><span className="field-help">{fullNote.length.toLocaleString()} / 24,000 characters</span></div> : <div className="section-inputs">{sectionKeys(noteType).map((key, index) => <details key={key} open={index === 0 || key === "assessmentPlan"}><summary>{sectionLabels[key]} <span className="field-help">{sections[key].trim() ? "Text added" : "Optional"}</span></summary><div className="field"><label className="sr-only" htmlFor={`section-${key}`}>{sectionLabels[key]}</label><textarea id={`section-${key}`} rows={key === "assessmentPlan" || key === "hpi" ? 6 : 4} maxLength={24_000} value={sections[key]} onChange={(e) => setSections((previous) => ({ ...previous, [key]: e.target.value }))} placeholder={`Add fictional ${sectionLabels[key].toLowerCase()} if documented.`} /></div></details>)}</div>}
        {noteType === "admission" && <div className="hpi-option"><label className="checkbox-label"><input type="checkbox" checked={improveHpi} onChange={(e) => setImproveHpi(e.target.checked)} /><span><strong>Improve HPI (optional)</strong><br />Include a separate wording suggestion and clarification questions. It will not replace your note or affect the MDM calculation.</span></label></div>}
      </section>

      <section className="panel"><h2>3. Review and analyze</h2><label className="checkbox-label mt-5"><input type="checkbox" checked={syntheticOnly} onChange={(e) => setSyntheticOnly(e.target.checked)} required /><span>I confirm this documentation is entirely fictional and contains no real patient information. Live analysis sends the active documentation to OpenAI.</span></label>
        <div className="analysis-actions"><button className="button primary" type="submit" disabled={pending || !activeNote.trim()}>{pending ? <><LoaderCircle size={18} className="spin" /> Analyzing and saving…</> : <>Analyze with AI <ArrowRight size={17} /></>}</button>
          {unchangedSample && <button className="button secondary" type="button" disabled={pending || !syntheticOnly || !encounterConfirmed} onClick={() => void submit("prepared_demo")}><FlaskConical size={17} /> Run prepared example</button>}
        </div><p className="field-help mt-3">Prepared examples use a reviewed fixture, not a live AI call. Editing a case requires live AI analysis. Results may take up to a minute.</p>
        <div aria-live="polite" aria-atomic="true">{pending && <p className="field-help mt-3" role="status">Checking documentation, evaluating MDM, and saving your results. Please keep this page open.</p>}{error && <p role="alert" className="form-error mt-4">{error}</p>}</div>
      </section>
    </fieldset>
  </form>;
}
