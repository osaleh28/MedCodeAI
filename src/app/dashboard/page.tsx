import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { DeleteAnalysisButton } from "@/components/delete-analysis-button";
import { requireUser } from "@/lib/session";
import { listMyAnalyses } from "@/lib/analyses";

export const metadata: Metadata = { title: "Overview", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const user = await requireUser();
  const analyses = await listMyAnalyses();
  return <>
    <div className="dashboard-heading"><div><span className="eyebrow">Your learning workspace</span><h1>Overview</h1><p>Welcome, {user.name.split(" ")[0]}. Start a new analysis or return to a recent result.</p></div></div>
    <Disclaimer />
    <div className="overview-grid">
      <section className="panel overview-start"><span className="eyebrow">Start here</span><h2>Start a new analysis</h2><p>Explore what a note supports and learn how problems, data and management decisions contribute to MDM.</p><ul className="overview-note-types"><li><strong>Admission H&amp;P</strong><span>Initial hospital inpatient or observation care</span></li><li><strong>Progress Note</strong><span>Subsequent hospital inpatient or observation care</span></li></ul><p>Load a fictional example, paste a fictional or fully de-identified note, or import a Word or text file.</p><Link href="/dashboard/new" className="button primary">New analysis <ArrowRight size={17} aria-hidden="true" /></Link><p className="field-help mt-4">Review the evidence, explanations and uncertainties in your result. Complete results are kept in Saved analyses.</p></section>
      <aside className="panel overview-recent"><div className="panel-heading"><h2>Recent results</h2><Link className="text-link text-sm" href="/dashboard/history">View all saved analyses</Link></div><p className="field-help mt-4">A quick preview of your three most recent analyses.</p>
        {analyses.length ? <ul className="analysis-list">{analyses.map((analysis) => <li key={analysis.id}><Link href={`/dashboard/analyses/${analysis.id}`}><strong>{analysis.title}</strong><small>{analysis.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })} · {analysis.mdmComplexity ?? "Indeterminate"} MDM · Potential CPT {analysis.suggestedCptCode ?? "indeterminate"}</small></Link><DeleteAnalysisButton id={analysis.id} title={analysis.title} /></li>)}</ul> : <div className="empty-state"><div className="empty-icon"><FolderOpen size={29} /></div><h3>No saved results yet.</h3><p>Your latest analyses will appear here after you complete your first case.</p></div>}
      </aside>
    </div>
    <p className="text-sm text-slate-600">Signed in as {user.email}. Use an account email you are comfortable using for a portfolio demo.</p>
  </>;
}
