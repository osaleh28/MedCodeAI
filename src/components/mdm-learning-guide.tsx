import { ruleSources } from "@/lib/clinical/mdm";
import { DataDocumentationLesson } from "@/components/data-documentation-lesson";

const lessons = [
  { title: "Problems addressed", text: "Assess the conditions actually evaluated or managed today. Distinguish a stable condition at the patient's treatment goal from a flare or organ threat. A diagnosis list alone does not establish complexity." },
  { title: "Qualifying data activities", text: "Distinguish a result listing from physician review, an order, and independent interpretation. Verify unique tests and sources, and avoid counting a panel's values or an order and its review twice." },
  { title: "Management decisions", text: "Evaluate the treatment decisions and their documented context. A prescription list, an abnormal result, or the hospital setting alone does not establish management risk." },
  { title: "Toxicity monitoring", text: "Identify the drug, serious adverse effect being monitored, monitoring plan, and how it informs management. Routine response checks or a vague plan to monitor do not automatically establish intensive toxicity monitoring." },
  { title: "Resuscitation and care limits", text: "An existing DNR status differs from a decision made during this encounter because of poor prognosis. The latter requires its own documented decision and context; it does not establish high overall MDM on its own." },
];

export function MdmLearningGuide() {
  return <section className="panel mdm-learning-guide" aria-label="How MDM complexity is determined">
    <h2>How MDM complexity is determined</h2>
      <p className="mt-4 text-sm text-slate-600">The supplied worksheet uses an older point method. This guide adapts its teaching topics to the AMA hospital E/M framework effective in 2023. MedCode AI evaluates problems, data, and management risk separately; it does not add the worksheet’s diagnosis or data points.</p>
      <div className="learning-guide-grid">{lessons.map((lesson) => <article key={lesson.title}><h3>{lesson.title}</h3><p>{lesson.text}</p></article>)}</div>
      <details className="finding-detail mt-5"><summary>Learning point: your own interpretations and direct discussions</summary><DataDocumentationLesson /></details>
      <div className="uncertainty-box mt-5">
        <h3>The two-of-three check</h3>
        <p className="text-sm mt-2">At least <strong>two of the three MDM elements must meet or exceed a level</strong> for the overall assessment to reach that level.</p>
        <p className="text-sm mt-3">The three elements are:</p>
        <ol className="list-decimal pl-5 text-sm space-y-2">
          <li><strong>Problems addressed:</strong> Their documented complexity.</li>
          <li><strong>Data reviewed and analyzed:</strong> Qualifying tests, records, interpretations, and discussions.</li>
          <li><strong>Management risk:</strong> Risk associated with the documented treatment decisions.</li>
        </ol>
        <p className="text-sm mt-4">For example:</p>
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Example of two moderate elements supporting moderate overall MDM</caption>
          <thead><tr><th scope="col" className="border-b border-slate-200 px-3 py-2">Element</th><th scope="col" className="border-b border-slate-200 px-3 py-2">Supported level</th></tr></thead>
          <tbody>{[["Problems", "Moderate"], ["Data", "Low"], ["Management risk", "Moderate"]].map(([element, level]) => <tr key={element}><th scope="row" className="border-b border-slate-200 px-3 py-2 font-normal">{element}</th><td className="border-b border-slate-200 px-3 py-2">{level}</td></tr>)}</tbody>
        </table>
        <p className="text-sm mt-4">The overall MDM is <strong>moderate</strong> because two elements meet moderate criteria.</p>
        <p className="text-sm">One high element alone does <strong>not</strong> establish high overall MDM. The check concerns problems, data, and risk—not history, examination, and MDM.</p>
        <p className="text-sm">Unclear documentation stays uncertain. Clarify work actually performed; do not add facts or unnecessary activities to reach a level.</p>
      </div>
      <p className="field-help mt-4">The new worksheet practice cases are original, entirely fictional teaching cases, not clinical advice or validated billing examples. Prepared outcomes are checked by rule tests. A live AI interpretation may differ and must be reviewed.</p>
      <a className="text-link text-sm" href={ruleSources[0].url + "#page=8"} target="_blank" rel="noreferrer">Read the governing AMA framework ↗</a>
  </section>;
}
