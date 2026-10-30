import { CopyTextButton } from "@/components/copy-text-button";
import { dataKinds, type EvidenceFinding } from "@/lib/clinical/contracts";
import { noteLabels, type NoteType } from "@/lib/clinical/input";
import { ruleSources } from "@/lib/clinical/mdm";
import { documentSourceLabels } from "@/lib/clinical/privacy";
import { billingContextLabels } from "@/lib/clinical/billing-context";
import type { SavedReport } from "@/lib/clinical/report";
import { MdmLearningGuide } from "@/components/mdm-learning-guide";
import { ProgressNoteGuide } from "@/components/progress-note-guide";
import { HospitalCodeCards } from "@/components/hospital-code-cards";
import { DataDocumentationLesson } from "@/components/data-documentation-lesson";

function Evidence({ finding, note }: { finding: EvidenceFinding; note: string }) {
  const quotes = finding.evidence.filter((quote) => quote.trim() && note.includes(quote));
  return <div className="evidence"><span className="label">Documented facts · source excerpts</span>{quotes.length ? quotes.map((quote, index) => <blockquote key={index}>{quote}</blockquote>) : <p className="field-help">No matching excerpt is available. This finding remains uncertain.</p>}<a className="text-link field-help" href="#source-documentation">Compare with submitted documentation ↓</a></div>;
}

export function AnalysisResults({ report, note, noteType, inputMode }: { report: SavedReport; note: string; noteType: NoteType; inputMode: string | null }) {
  const { mdm, extraction, hpi } = report;
  const groups = [
    { title: "Laboratory studies", kinds: [dataKinds[0]] as readonly string[] },
    { title: "EKG / cardiac studies", kinds: [dataKinds[1]] as readonly string[] },
    { title: "Radiology / imaging", kinds: [dataKinds[2]] as readonly string[] },
    { title: "Other diagnostic studies", kinds: [dataKinds[3]] as readonly string[] },
    { title: "Data review and interpretation activities", kinds: ["records", "historian", "discussion"] as readonly string[] },
  ];
  return <div className="analysis-results">
    <section className="panel result-summary" aria-labelledby="summary-heading">
      <div><span className="eyebrow">Coding-rule conclusion</span><h2 id="summary-heading">{noteLabels[noteType]} assessment</h2><p className="field-help">{inputMode === "sections" ? "Separate sections" : "Full note"} · {noteType === "admission" ? "Initial" : "Subsequent"} hospital encounter assumed · MDM only</p>
        <p className="result-explanation">{mdm.explanation}</p><p className="uncertainty-notice">{mdm.uncertaintyNotice}</p>
      </div><div className="code-summary"><span className="label">{!mdm.potentialCode && mdm.minimumSupportedCode ? "Minimum supported CPT code" : "Potential CPT code"}</span><strong>{mdm.potentialCode ?? mdm.minimumSupportedCode ?? "Indeterminate"}</strong><span>{mdm.overall ? `Overall MDM: ${mdm.overall}` : mdm.minimumSupportedCode ? `Supported MDM: at least ${mdm.minimum}` : "Overall MDM: Indeterminate"}</span>{!mdm.overall && <small>Documented range: {mdm.minimum}–{mdm.maximum}{mdm.minimumSupportedCode && ". Exact final level unresolved; higher coding needs clarification."}</small>}</div>
    </section>

    <p className="field-help">Documentation: {documentSourceLabels[report.documentSource]}.{report.documentSource === "deidentified" && " This source was previously declared by the user; de-identification is not independently verified."}</p>
    {Object.values(report.billingContext).some(Boolean) && <details className="panel result-section"><summary>Billing answers you confirmed</summary><p className="field-help mt-3">You provided these answers separately from your note. The note must still describe the work; these answers alone do not earn credit or guarantee a code.</p><ul className="result-list">{(Object.keys(billingContextLabels) as (keyof typeof billingContextLabels)[]).filter((key) => report.billingContext[key]).map((key) => <li key={key}>{billingContextLabels[key]}</li>)}</ul></details>}
    <p className="origin-notice">{report.origin === "prepared_demo" ? "Prepared educational example: the extraction is a built-in fixture, not a live AI response." : `Live AI extraction · ${report.model ?? "configured model"}. The model did not select the final code.`}</p>
    <section className="panel"><span className="label">{report.origin === "prepared_demo" ? "Prepared clinical interpretation" : "AI interpretation"}</span><h2>Clinical summary</h2><p className="mt-4">{extraction.summary}</p>{report.exampleRationale && <p className="mt-3"><strong>Example rule check:</strong> {report.exampleRationale}</p>}</section>

    <section aria-labelledby="mdm-breakdown-heading" className="result-section"><h2 id="mdm-breakdown-heading">MDM breakdown</h2><div className="mdm-cards">{([
      ["Problems addressed", mdm.problems], ["Data reviewed and analyzed", mdm.data], ["Risk of management", mdm.risk],
    ] as const).map(([title, item]) => <article className="panel" key={title}><span className="label">Coding-rule conclusion</span><h3>{title}</h3><strong className="element-level">{item.level ?? "Indeterminate"}</strong>{!item.level && <p className="field-help">Supported minimum: {item.minimum}; unresolved upper bound: {item.maximum}.</p>}<p>{item.explanation}</p>
      <details><summary>Credited activities and evidence ({item.credited.length})</summary>{item.credited.length ? <ul className="result-list">{item.credited.map((text, index) => <li key={index}>{text}</li>)}</ul> : <p>No definite credit is established.</p>}<Evidence finding={{ evidence: item.evidence, uncertain: false, explanation: "" }} note={note} /></details>
      {item.excluded.length > 0 && <details><summary>Excluded or uncertain ({item.excluded.length})</summary><ul className="result-list">{item.excluded.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
    </article>)}</div></section>

    <section className="panel result-section" aria-labelledby="problems-heading"><span className="label">{report.origin === "prepared_demo" ? "Prepared clinical interpretations" : "AI interpretations"}</span><h2 id="problems-heading">Problems addressed</h2>{extraction.problems.length ? extraction.problems.map((item, index) => <details className="finding-detail" key={index}><summary>{item.label} <span className={`finding-status ${item.uncertain || item.addressed !== true ? "uncertain" : ""}`}>{item.uncertain ? "Uncertain" : item.addressed === true ? "Addressed" : "Not confirmed as addressed"}</span></summary><p><strong>Clinical interpretation:</strong> {item.course} · {item.criterion.replaceAll("_", " ")}</p><p>{item.explanation}</p><p><strong>Management described:</strong> {item.management}</p><Evidence finding={item} note={note} /></details>) : <p className="mt-4">No reliably categorized problems were extracted.</p>}</section>

    <section className="panel result-section" aria-labelledby="diagnostic-heading"><h2 id="diagnostic-heading">Diagnostic data details</h2><p className="mt-3">A result appearing in a note, reviewing it, ordering it, and independently interpreting it are different activities. Credit requires qualifying work and reliable evidence.</p>{groups.map((group) => {
      const items = extraction.data.filter((item) => group.kinds.includes(item.kind));
      return <details className="finding-detail" key={group.title}><summary>{group.title} <span className="count">{items.length}</span></summary>{items.length ? items.map((item, index) => <article className="data-finding" key={index}><h3>{item.label}</h3><span className="label">{report.origin === "prepared_demo" ? "Prepared interpretation" : "AI interpretation"} · {item.activity.replaceAll("_", " ")}</span><p>{item.explanation}</p><p className="field-help">Eligibility: {item.qualifies === true ? "potentially qualifying, subject to rules" : item.qualifies === false ? "not qualifying" : "uncertain"}. Separate reporting: {item.separatelyReported === null ? "unconfirmed" : item.separatelyReported ? "yes; excluded" : "not separately reported"}. {item.uncertain ? "Finding marked uncertain." : ""}</p><Evidence finding={item} note={note} /></article>) : <p>No activities extracted in this category. This does not establish that no work occurred.</p>}</details>;
    })}</section>

    <section className="panel result-section" aria-labelledby="risk-heading"><span className="label">{report.origin === "prepared_demo" ? "Prepared clinical interpretations" : "AI interpretations"}</span><h2 id="risk-heading">Management decisions</h2>{extraction.risks.length ? extraction.risks.map((item, index) => <details className="finding-detail" key={index}><summary>{item.decision} {item.uncertain && <span className="finding-status uncertain">Uncertain</span>}</summary><p>{item.explanation}</p><p className="field-help">Interpretation category: {item.criterion.replaceAll("_", " ")}</p><Evidence finding={item} note={note} /></details>) : <p className="mt-4">No management decision could be reliably extracted. Diagnosis severity alone does not establish management risk.</p>}</section>

    <section className="panel result-section" aria-labelledby="gaps-heading"><span className="eyebrow">Uncertainties · clarification questions</span><h2 id="gaps-heading">Documentation improvement</h2><p className="mt-4">Clarify only what was actually evaluated or performed. These questions are not instructions to invent facts, perform unnecessary work, or increase a billing level.</p>{extraction.gaps.length ? <ol className="gap-list">{extraction.gaps.map((gap, index) => <li key={index}><h3>{gap.question}</h3><p>{gap.educationalExplanation}</p>{gap.evidence.length > 0 && <Evidence finding={{ ...gap, explanation: gap.educationalExplanation }} note={note} />}</li>)}</ol> : <p>No specific clarification questions were generated. This does not certify completeness.</p>}
      {[...extraction.uncertainties, ...extraction.encounterConcerns].length > 0 && <div className="uncertainty-box"><h3>Unresolved information</h3><ul className="result-list">{[...extraction.uncertainties, ...extraction.encounterConcerns].map((text, index) => <li key={index}>{text}</li>)}</ul></div>}
    </section>

    {noteType === "admission" && <section className="panel result-section" aria-labelledby="hpi-heading"><span className="eyebrow">Documentation wording · separate from coding</span><h2 id="hpi-heading">HPI improvement</h2>{!hpi ? <p className="mt-4">HPI improvement was not requested. The original note remains unchanged.</p> : <><p className="mt-4">A clearer rewrite of unchanged facts does not increase the supported billing level. Review all clinical meaning, chronology, and negations before copying.</p>{hpi.status === "available" ? <><div className="hpi-comparison"><div><h3>Original HPI · documented facts</h3><p className="note-text">{hpi.originalHpi}</p></div><div><h3>Suggested improved HPI · {report.origin === "prepared_demo" ? "prepared wording" : "AI interpretation"}</h3><p className="note-text">{hpi.suggestedHpi}</p><CopyTextButton text={hpi.suggestedHpi} /></div></div><details className="finding-detail"><summary>Sentence-level source traceability</summary>{hpi.sentences.map((sentence, index) => <div className="data-finding" key={index}><p>{sentence.text}</p><Evidence finding={{ evidence: sentence.sourceQuotes, uncertain: false, explanation: "" }} note={hpi.originalHpi} /></div>)}</details></> : <><p>An existing HPI or a grounded revision could not be verified; no replacement is offered.</p>{hpi.originalHpi && <div className="mt-4"><h3>Original HPI ? preserved documentation</h3><p className="note-text">{hpi.originalHpi}</p></div>}</>}{hpi.warnings.map((warning, index) => <p key={index} className="uncertainty-notice">{warning}</p>)}{hpi.clarificationQuestions.length > 0 && <><h3 className="mt-5">HPI clarification questions</h3><ul className="result-list">{hpi.clarificationQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul></>}</>}<details className="finding-detail mt-4"><summary>How to improve HPI and document your work</summary><DataDocumentationLesson /></details></section>}

    <div className="result-section"><HospitalCodeCards noteType={noteType} suggestedCode={mdm.potentialCode ?? mdm.minimumSupportedCode} /></div>
    {noteType === "progress" && <div className="result-section"><ProgressNoteGuide /></div>}
    <div className="result-section"><MdmLearningGuide /></div>
    <details className="panel result-section" id="source-documentation"><summary>Submitted documentation · original source</summary><pre className="note-text">{note}</pre></details>
    <details className="panel result-section"><summary>How this code was determined</summary><p className="mt-4">Saved rule version: {mdm.ruleVersion}. Assessment date: {new Date(mdm.assessedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}.</p><ul className="result-list">{mdm.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul><ul className="result-list">{ruleSources.map((source) => <li key={source.url}><a className="text-link" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
  </div>;
}
