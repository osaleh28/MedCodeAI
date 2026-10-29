"use client";

import { useId, useState } from "react";
import { getHospitalCodeCards, noteDocumentationGuidance } from "@/lib/clinical/code-card-content";
import type { NoteType } from "@/lib/clinical/input";

export function HospitalCodeCards({ noteType, suggestedCode }: { noteType: NoteType; suggestedCode?: string | null }) {
  const cards = getHospitalCodeCards(noteType);
  const initialIndex = cards.findIndex((card) => card.code === suggestedCode);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 1);
  const id = useId();
  const selected = cards[selectedIndex];
  const initial = noteType === "admission";
  const example = selected.level === 3
    ? initial ? "Acute decompensated heart failure with active respiratory compromise threatens organ function. The clinician evaluates that threat and decides hospitalization is necessary for treatment. High problems plus the supported hospitalization decision can establish high MDM."
      : "An acute illness with worsening respiratory compromise threatens organ function. After reassessment, the clinician decides to escalate hospital care to intensive care. High problems plus the supported escalation decision can establish high MDM."
    : selected.example;
  return <section className="panel hospital-code-guide" aria-labelledby={`${id}-title`}>
    <div className="code-guide-heading"><div><span className="eyebrow">MedCode AI · educational reference</span><h2 id={`${id}-title`}>{initial ? "Admission H&P" : "Progress note"} code cards</h2></div><span className="code-guide-family">{initial ? "Initial" : "Subsequent"} inpatient / observation care</span></div>
    <p className="field-help">Choose a level to review its requirements. These cards explain how documented work can support a code; selecting a card does not change your analysis.</p>
    <div className="code-card-picker" role="group" aria-label="Choose a code card">{cards.map((card, index) => <button type="button" key={card.code} aria-pressed={selectedIndex === index} aria-controls={`${id}-sheet`} onClick={() => setSelectedIndex(index)}><span>Level {card.level}</span><strong>{card.code}</strong><small>{card.label} MDM</small></button>)}</div>
    <article id={`${id}-sheet`} className="code-fact-sheet" aria-label={`CPT ${selected.code} educational fact sheet`}>
      <header className="code-sheet-header"><div><span className="label">Level {selected.level} · {initial ? "Admission H&P" : "Hospital progress note"}</span><h3>CPT {selected.code}</h3></div><span className="code-sheet-mdm">{selected.label} MDM</span></header>
      <div className="code-sheet-ribbon">Code fact sheet <span>Support at least two of the three MDM elements</span></div>
      <div className="code-sheet-layout">
        <div className="code-sheet-main">
          <div className="code-comparison-scroll" role="region" aria-label="Hospital code level comparison" tabIndex={0}>
            <table className="code-comparison"><caption>Compare the three {initial ? "initial" : "subsequent"} hospital-care levels</caption>
              <thead><tr><th scope="col">Reference</th>{cards.map((card, index) => <th key={card.code} scope="col" data-selected={selectedIndex === index}>{card.code}{selectedIndex === index && <span className="sr-only"> (selected card)</span>}</th>)}</tr></thead>
              <tbody>
                <tr><th scope="row">Overall MDM</th>{cards.map((card, index) => <td key={card.code} data-selected={selectedIndex === index}>{card.label}</td>)}</tr>
                <tr><th scope="row">MDM threshold</th>{cards.map((card, index) => <td key={card.code} data-selected={selectedIndex === index}>2 of 3 elements</td>)}</tr>
                <tr><th scope="row">History / examination</th><td colSpan={3}>Medically appropriate; no fixed HPI, ROS or exam counts select the level.</td></tr>
                <tr className="code-time-row"><th scope="row">Alternative time minimum*</th>{cards.map((card, index) => <td key={card.code} data-selected={selectedIndex === index}>{card.minutes} minutes</td>)}</tr>
              </tbody>
            </table>
          </div>
          <h4>What can support {selected.label.toLowerCase()} MDM?</h4>
          <p className="field-help">These are teaching summaries and examples, not a requirement to meet all three elements or an exhaustive list. A higher element can satisfy a lower threshold.</p>
          <dl className="code-criteria">{[["Problems addressed", selected.problems], ["Data reviewed and analyzed", selected.data], ["Risk of management", selected.risk]].map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>
          <section className="code-example" aria-label="Fictional MDM illustration"><h4>Fictional two-of-three illustration</h4><p>{example}</p><p className="code-example-breakdown">{selected.breakdown} · {selected.code}</p><p className="field-help">Illustration only, assuming an eligible {initial ? "initial" : "subsequent"} hospital encounter. Review the complete note and exclusions.</p></section>
          <h4>What to make clear in the {initial ? "admission" : "daily progress"} note</h4>
          <ul className="code-documentation-list">{noteDocumentationGuidance[noteType].map((item) => <li key={item.title}><strong>{item.title}.</strong> {item.text}</li>)}<li><strong>Diagnostic work actually performed.</strong> Identify orders, reviews, relevant external sources, your own interpretations and actual external discussions. Record the decision-making contribution and relevant findings without treating copied results as proof of review.</li></ul>
        </div>
        <aside className="code-sheet-sidebar" aria-label="Important coding qualifications">
          <div><h4>Two of three, not all three</h4><p>Problems, qualifying data and management risk are separate. One high element alone does not establish high MDM. A more detailed note does not by itself support a higher code.</p></div>
          <div><h4>Count data correctly</h4><p>Category 1 combines eligible unique tests, external-source notes and, when required, an independent historian. Do not count lab values separately, overlapping panels twice, or an order and review of the same test twice.</p><p>Independent interpretation must concern another professional&apos;s test. Interpretation and discussion credit require applicable eligibility and no separate reporting by the E/M clinician. A referral is not a discussion.</p></div>
          <div><h4>Document what happened</h4><p>Clinical context and medical necessity matter. Include only work actually performed or considered. Do not add findings, change facts, or perform unnecessary work to reach a level.</p><p>{initial ? "An admission note title alone does not prove a hospitalization decision." : "An improving patient can still require moderate or high MDM. Judge today's documented problems and decisions."}</p></div>
        </aside>
      </div>
      <footer className="code-sheet-footer"><p><strong>*Time is an alternative, not an additional MDM requirement.</strong> MedCode AI calculates from MDM only. The listed minimums refer to qualifying physician/practitioner time on the encounter date. Exclude separately billed services and do not double-count overlapping time.</p><p>Original educational summary based on the <a className="text-link" href="https://www.ama-assn.org/system/files/2023-e-m-descriptors-guidelines.pdf#page=8" target="_blank" rel="noreferrer">AMA E/M framework</a>, <a className="text-link" href="https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management-em-revisions-faqs" target="_blank" rel="noreferrer">AMA clarifications</a>, and <a className="text-link" href="https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf" target="_blank" rel="noreferrer">CMS guidance (May 2026)</a>. Reviewed October 29, 2026. Not an AMA/CMS publication or endorsement; consult the applicable CPT edition and payer rules.</p><p>Portfolio demonstration only. Fictional or fully de-identified notes only. Not intended for patient care or actual billing decisions.</p></footer>
    </article>
  </section>;
}
