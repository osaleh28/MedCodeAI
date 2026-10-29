"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";

export function DeleteAnalysisButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (pending || deleted || !window.confirm(`Delete "${title}"? This permanently removes the saved note and results from Overview and Saved analyses. This cannot be undone.`)) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/analyses/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "Unable to delete this analysis. Please try again.");
        return;
      }
      setDeleted(true);
      router.refresh();
    } catch { setError("The request could not finish. Refresh Overview to check whether the analysis was deleted before retrying."); }
    finally { setPending(false); }
  }

  return <div className="analysis-delete">
    <button type="button" className="button secondary small delete-analysis-button" aria-label={`Delete ${title}`} disabled={pending || deleted} onClick={() => void remove()}>
      {pending ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />}
      {pending ? "Deleting…" : deleted ? "Deleted" : "Delete"}
    </button>
    <div aria-live="polite">{error && <p className="form-error mt-3" role="alert">{error}</p>}</div>
  </div>;
}
