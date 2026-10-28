import { ruleSources } from "@/lib/clinical/mdm";

const lessons = [
  { title: "Problems addressed", text: "Assess the conditions actually evaluated or managed today. Distinguish a stable condition at the patient's treatment goal from a flare or organ threat. A diagnosis list alone does not establish complexity." },
  { title: "Qualifying data activities", text: "Distinguish a result listing from physician review, an order, and independent interpretation. Verify unique tests and sources, and avoid counting a panel's values or an order and its review twice." },
  { title: "Management decisions", text: "Evaluate the treatment decisions and their documented context. A prescription list, an abnormal result, or the hospital setting alone does not establish management risk." },
  { title: "Toxicity monitoring", text: "Identify the drug, serious adverse effect being monitored, monitoring plan, and how it informs management. Routine response checks or a vague plan to monitor do not automatically establish intensive toxicity monitoring." },
  { title: "Resuscitation and care limits", text: "An existing DNR status differs from a decision made during this encounter because of poor prognosis. The latter requires its own documented decision and context; it does not establish high overall MDM on its own." },
];

export function MdmLearningGuide() {
  return <section className="panel mdm-learning-guide" aria-label="Worksheet-based MDM education">
    <details><summary>Understand complexity: lessons from the Danger Table Worksheet</summary>
      <p className="mt-4 text-sm text-slate-600">The supplied worksheet uses an older point method. This guide adapts its teaching topics to the AMA hospital E/M framework effective in 2023. MedCode AI evaluates problems, data, and management risk separately; it does not add the worksheet’s diagnosis or data points.</p>
      <div className="learning-guide-grid">{lessons.map((lesson) => <article key={lesson.title}><h3>{lesson.title}</h3><p>{lesson.text}</p></article>)}</div>
      <div className="uncertainty-box mt-5"><strong>The two-of-three check</strong><p className="text-sm mt-2">A higher element does not automatically raise the entire encounter. Moderate problems, low data, and moderate management risk support moderate overall MDM when the encounter assumptions and evidence are reliable.</p><p className="text-sm">Unclear documentation stays uncertain. Clarify work actually performed; do not add facts or unnecessary activities to reach a level.</p></div>
      <p className="field-help mt-4">The new worksheet practice cases are original, entirely fictional teaching cases, not clinical advice or validated billing examples. Prepared outcomes are checked by rule tests. A live AI interpretation may differ and must be reviewed.</p>
      <a className="text-link text-sm" href={ruleSources[0].url + "#page=8"} target="_blank" rel="noreferrer">Read the governing AMA framework ↗</a>
    </details>
  </section>;
}
