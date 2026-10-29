export type DocumentSource = "synthetic" | "deidentified";
export const documentSourceLabels: Record<DocumentSource, string> = {
  synthetic: "Fictional teaching note", deidentified: "De-identified real-case note",
};
export const privacyNotice = "Portfolio demonstration only. Fictional or fully de-identified notes only. Not intended for patient care or actual billing decisions.";

// The demo's automatic blocking policy covers these three labeled identifiers.
// It is NOT a de-identification service: other details can still identify people.
// Return categories only; never echo suspected values into logs/messages.
export function potentialIdentifiers(note: string): string[] {
  const found = new Set<string>();
  const placeholder = /^(?:\[(?:redacted|removed|omitted)\]|<(?:redacted|removed|omitted)>|redacted|removed|omitted|not provided|unknown|not documented|N\/A)\s*[.!]?$/i;
  function valueAfterLabel(value: string) {
    // Headers often put several identifiers on one line. Evaluate each label
    // separately rather than treating a redacted name plus a DOB as a name.
    return value.split(/[ \t]+(?=(?:DOB|D\.O\.B\.|date of birth|birth[ \t]*date|MRN|medical record|patient(?:'s)?[ \t]+(?:full[ \t]+)?name|full name)\b)/i)[0].trim();
  }
  const names = /(?:\b(?:patient(?:'s)?[ \t]+(?:full[ \t]+)?name|full[ \t]+name)|^[ \t]*(?:name|patient))[ \t]*(?::|#|=)[ \t]*([^\r\n;|]+)/gim;
  for (const match of note.matchAll(names)) {
    const value = valueAfterLabel(match[1]);
    if (value && !placeholder.test(value) && ((value.match(/\p{L}[\p{L}'’-]*/gu)?.length ?? 0) >= 2 || /full[ \t]+name/i.test(match[0].slice(0, match[0].length - match[1].length)))) found.add("patient full name");
  }
  const birthDates = /\b(?:DOB\b|D\.O\.B\.|date[ \t]+of[ \t]+birth\b|birth[ \t]*date\b)[ \t]*(?::|#|=|is\b)?[ \t]*([^\r\n;|]+)/gi;
  for (const match of note.matchAll(birthDates)) {
    const value = valueAfterLabel(match[1]);
    if (value && !placeholder.test(value)) found.add("patient date of birth");
  }
  const recordNumbers = /\b(?:MRN\b|medical[ \t]+record[ \t]*(?:number\b|no\.?(?=[ \t:#=])|ID\b|(?=[:#=])))[ \t]*(?::|#|=|is\b)?[ \t]*([^\r\n;|]+)/gi;
  for (const match of note.matchAll(recordNumbers)) {
    const value = valueAfterLabel(match[1]);
    if (value && !placeholder.test(value)) found.add("hospital medical record number (MRN)");
  }
  return [...found];
}
