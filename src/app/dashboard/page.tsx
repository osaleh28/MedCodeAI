import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, FolderOpen } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { requireUser } from "@/lib/session";
import { listMyAnalyses } from "@/lib/analyses";

export const metadata: Metadata = { title: "Your dashboard", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const user = await requireUser();
  const analyses = await listMyAnalyses();
  return <>
    <div className="dashboard-heading"><div><span className="eyebrow">Your learning workspace</span><h1>Welcome, {user.name.split(" ")[0]}.</h1><p>Connect fictional documentation with evidence and understanding.</p></div><Link href="/dashboard/new" className="button primary">New analysis <ArrowRight size={17} /></Link></div>
    <Disclaimer />
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2>Recent analyses</h2><Link className="text-link text-sm" href="/dashboard/history">View history</Link></div>
      {analyses.length ? <ul className="analysis-list">{analyses.slice(0, 5).map((analysis) => <li key={analysis.id}><Link href={`/dashboard/analyses/${analysis.id}`}><strong>{analysis.title}</strong><small>{analysis.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })} · {analysis.mdmComplexity ?? "Indeterminate"} MDM · Potential CPT {analysis.suggestedCptCode ?? "indeterminate"}</small></Link></li>)}</ul> : <div className="empty-state"><div className="empty-icon"><FolderOpen size={29} /></div><h3>A fresh start for your learning.</h3><p>Start with a built-in fictional case or your own entirely synthetic note. Complete assessments are saved to your history.</p><Link className="button primary mt-5" href="/dashboard/new">Explore a synthetic case</Link></div>}
    </section><aside className="panel"><h2>Read every layer.</h2><ul className="roadmap"><li><CheckCircle2 size={17} /><span>Documented facts<small>Excerpts traceable to the original note</small></span></li><li><CheckCircle2 size={17} /><span>Clinical interpretations<small>AI findings or a labeled prepared fixture</small></span></li><li><CheckCircle2 size={17} /><span>Coding-rule conclusions<small>Deterministic MDM; no model-selected CPT</small></span></li><li><CheckCircle2 size={17} /><span>Uncertainties<small>No guessed facts or unconfirmed activity credit</small></span></li></ul></aside></div>
    <p className="text-sm text-slate-600">Signed in as {user.email}. Use an account email you are comfortable using for a portfolio demo.</p>
  </>;
}
