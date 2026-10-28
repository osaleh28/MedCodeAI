import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyAnalysis } from "@/lib/analyses";
import { Disclaimer } from "@/components/disclaimer";
import { AnalysisResults } from "@/components/analysis-results";
import { reportSchema } from "@/lib/clinical/report";

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getMyAnalysis(id);
  if (!analysis) notFound();
  const parsed = reportSchema.safeParse(analysis.structuredAnalysis);
  return <article><Link className="text-link text-sm" href="/dashboard/history">← Back to history</Link><div className="dashboard-heading mt-4"><div><span className="eyebrow">Saved assessment</span><h1>{analysis.title}</h1><p>{analysis.createdAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC</p></div><Link href="/dashboard/new" className="button primary">New analysis</Link></div><Disclaimer />
    {parsed.success && (analysis.noteType === "admission" || analysis.noteType === "progress") ? <AnalysisResults report={parsed.data} note={analysis.syntheticNote} noteType={analysis.noteType} inputMode={analysis.inputMode} /> : <section className="panel mt-6"><h2>Earlier analysis record</h2><p className="mt-4">This record has no compatible structured Phase 2 assessment. Its original documentation is preserved; no new code has been inferred.</p><pre className="note-text">{analysis.syntheticNote}</pre><dl><dt>Previously saved MDM</dt><dd>{analysis.mdmComplexity ?? "Not analyzed"}</dd><dt>Previously saved potential code</dt><dd>{analysis.suggestedCptCode ?? "Indeterminate"}</dd></dl></section>}
  </article>;
}
