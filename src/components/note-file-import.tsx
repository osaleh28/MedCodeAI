"use client";

import { useState } from "react";
import { importNote } from "@/lib/clinical/import-note";
import { potentialIdentifiers } from "@/lib/clinical/privacy";
import { checkedExtractedText } from "@/lib/clinical/file-input";

export function NoteFileImport({ onApply, onBusy }: { onApply: (text: string) => boolean; onBusy: (busy: boolean) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const identifiers = preview === null ? [] : potentialIdentifiers(preview);
  return <details className="finding-detail"><summary>Import Word or text</summary>
    <p className="field-help mt-3">Choose only fictional or already fully de-identified material you are authorized to use. Files are read in your browser; originals and filenames are not uploaded. Review the extracted text before adding it to the form. PDF and image imports are not supported.</p>
    <div className="field mt-4"><label htmlFor="note-file">Note file (.docx or .txt; up to 5 MB)</label><input id="note-file" type="file" accept=".docx,.txt" disabled={busy} onChange={async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setBusy(true); onBusy(true); setError(""); setPreview(null); setReviewed(false);
      try { setPreview(await importNote(file)); }
      catch (error) { setError(error instanceof Error ? error.message : "This file could not be read."); }
      finally { setBusy(false); onBusy(false); }
    }} /></div>
    {busy && <p role="status">Reading the file locally…</p>}
    {preview !== null && <><div className="field mt-4"><label htmlFor="import-preview">Extracted text — review and remove identifying information</label><textarea id="import-preview" rows={12} maxLength={24_000} value={preview} onChange={(e) => { setPreview(e.target.value); setReviewed(false); }} /></div>
      {identifiers.length > 0 && <p className="form-error" role="alert">Potential identifiers detected: {identifiers.join(", ")}. Remove them before continuing. This screen checks only patient full names, dates of birth, and hospital MRNs; it cannot verify de-identification.</p>}
      <label className="checkbox-label mt-4"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /><span>I reviewed the entire extracted text for accuracy and identifying information. It is fictional or already fully de-identified.</span></label>
      <div className="analysis-actions"><button type="button" className="button secondary" disabled={!reviewed || identifiers.length > 0 || busy} onClick={() => {
        try { if (onApply(checkedExtractedText(preview))) { setPreview(null); setReviewed(false); setError(""); } }
        catch (error) { setError(error instanceof Error ? error.message : "Review the extracted text."); }
      }}>Use reviewed text as full note</button><button type="button" className="button secondary" onClick={() => { setPreview(null); setReviewed(false); }}>Discard import</button></div></>}
    {error && <p className="form-error mt-3" role="alert">{error}</p>}
  </details>;
}
