import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyAnalysis } from "@/lib/analyses";
import { Disclaimer } from "@/components/disclaimer";

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getMyAnalysis(id);
  if (!analysis) notFound();
  return <article className="detail"><Link className="text-link text-sm" href="/dashboard">← Back to dashboard</Link><h1>{analysis.title}</h1><Disclaimer /><section className="panel mt-6"><h2>Synthetic documentation</h2><pre className="mt-4">{analysis.syntheticNote}</pre><dl><dt>MDM complexity</dt><dd>{analysis.mdmComplexity ?? "Not yet analyzed"}</dd><dt>Potentially supported CPT code</dt><dd>{analysis.suggestedCptCode ?? "Not yet analyzed"}</dd><dt>Educational explanation</dt><dd>{analysis.rationale ?? "Analysis is planned for Phase 2."}</dd></dl></section></article>;
}
