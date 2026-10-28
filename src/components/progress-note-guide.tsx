import { ruleSources } from "@/lib/clinical/mdm";

export function ProgressNoteGuide() {
  return <section className="panel" aria-label="Daily progress note education">
    <details><summary>Write a clear interval history and daily plan</summary>
      <div className="learning-guide-grid">
        <article><h3>Reason for today&apos;s review</h3><p>Identify the problem being followed today. A useful note title makes the service clear, but its wording alone does not establish the billable encounter category.</p></article>
        <article><h3>Interval history and symptoms</h3><p>Describe events since the last assessment, treatment response, support needs, and relevant nursing or consultant updates. Identify the information source. Include the patient&apos;s symptoms and relevant ROS; never add negatives that were not obtained.</p></article>
        <article><h3>Decisions made today</h3><p>For each problem actually addressed, explain your assessment and what you decided to start, adjust, continue, stop, or defer, with the documented reason. Describe your own consultant coordination. An unchanged prescription can still reflect active management.</p></article>
        <article><h3>Carry forward with review</h3><p>A diagnosis list does not prove evaluation or treatment. Review carried-forward information for accuracy and relevance; do not invent changes or retype a plan merely to imply new work. Stable chronic conditions may count when actually addressed.</p></article>
      </div>
      <div className="uncertainty-box mt-5"><strong>Fictional illustration — not text to add unless true</strong><p className="text-sm mt-2">Follow-up for hypoxia during a COPD exacerbation. Nursing reports oxygen decreased from 5 L to 3 L overnight. The patient reports less breathlessness and denies chest pain. I reassessed respiratory status and decided to continue the current steroid today because symptoms persist; reassess oxygen needs tomorrow.</p><p className="text-sm">This illustration does not establish a CPT code. Improving status, an unchanged plan, or a longer note alone determines neither a minimum nor a maximum billing level.</p></div>
      <p className="field-help mt-4">Clarification questions ask about work actually performed and may already be answered elsewhere in the note. MDM uses two of three elements: problems, qualifying data, and management risk. History/ROS/exam counts and legacy diagnosis points do not select the level. A complete note may support 99231; time-based billing is outside this demo.</p>
      <a className="text-link text-sm" href={ruleSources[0].url + "#page=14"} target="_blank" rel="noreferrer">Read the AMA definition of problems addressed</a>
    </details>
  </section>;
}
