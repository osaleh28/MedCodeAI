"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CopyTextButton({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return <div><button type="button" className="button secondary small" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setMessage("Copied. Review before using this synthetic wording suggestion."); }
    catch { setMessage("Copy was unavailable. Select the suggested text and copy it manually."); }
  }}><Copy size={15} aria-hidden="true" /> Copy suggested HPI</button><p className="field-help mt-2" aria-live="polite">{message}</p></div>;
}
