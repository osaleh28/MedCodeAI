export type DocumentSource = "synthetic" | "deidentified";
export const documentSourceLabels: Record<DocumentSource, string> = {
  synthetic: "Fictional teaching note", deidentified: "De-identified real-case note",
};
export const privacyNotice = "Portfolio demonstration only. Fictional or fully de-identified notes only. Not intended for patient care or actual billing decisions.";

// Best-effort screening, NOT a de-identification service or HIPAA certification.
// Return categories only: never echo suspected identifiers into logs/messages.
export function potentialIdentifiers(note: string): string[] {
  const found = new Set<string>();
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(note)) found.add("email address");
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(note)) found.add("Social Security number");
  if (/(?:\+?1[-.\s]?)?\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/.test(note)) found.add("phone or fax number");
  const labels = /(?:\b(?:MRN|medical record (?:number|no\.?)|patient\s+name|name|date of birth|DOB|address|ZIP(?:\s*code)?|account(?:\s*(?:number|no\.?))?|insurance\s*(?:ID|number)|member\s*ID|health\s*plan\s*ID|FIN|SSN)|^\s*patient)\s*[:#=]\s*([^\r\n]+)/gim;
  for (const match of note.matchAll(labels)) {
    if (!/^\s*(?:\[(?:redacted|removed|omitted)\]|<(?:redacted|removed|omitted)>|(?:redacted|removed|omitted|not provided))\s*[.!]?\s*$/i.test(match[1])) found.add("identifying label or record number");
  }
  if (/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/]\d{2,4}\b/.test(note)
    || /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}\b/i.test(note)) found.add("calendar date");
  if (/https?:\/\/|www\.|\b(?:\d{1,3}\.){3}\d{1,3}\b/i.test(note)) found.add("URL or IP address");
  if (/\b(?:9\d|[1-9]\d{2,})[-\s]*(?:year[-\s]*old|years?\s+of\s+age)\b/i.test(note)) found.add("specific age above 89");
  if (/\b\d{1,6}\s+(?:[a-z]+\s+){0,4}(?:street|avenue|road|boulevard|lane|drive|court|st\.|ave\.|rd\.)\b/i.test(note)) found.add("street address");
  return [...found];
}
