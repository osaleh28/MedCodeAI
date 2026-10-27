import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, FolderOpen } from "lucide-react";
import { Disclaimer } from "@/components/disclaimer";
import { requireUser } from "@/lib/session";
import { listMyAnalyses } from "@/lib/analyses";

export const metadata: Metadata = { title: "Your dashboard", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  const user = await requireUser();
  const analyses = await listMyAnalyses();
  return <>
    <div className="dashboard-heading"><div><span className="eyebrow">Your learning workspace</span><h1>Welcome, {user.name.split(" ")[0]}.</h1><p>A place to connect documentation with understanding.</p></div><span className="phase-badge">Phase 1 · Foundation ready</span></div>
    <Disclaimer />
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><h2>Your analyses</h2><span className="count">{analyses.length}{analyses.length === 50 ? "+" : ""}</span></div>
      {analyses.length ? <ul className="analysis-list">{analyses.map((analysis) => <li key={analysis.id}><Link href={`/dashboard/analyses/${analysis.id}`}><strong>{analysis.title}</strong><small>{analysis.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" })} · {analysis.mdmComplexity ?? "Awaiting analysis"}</small></Link></li>)}</ul> : <div className="empty-state"><div className="empty-icon"><FolderOpen size={29} /></div><h3>A fresh start for your learning.</h3><p>Your saved synthetic case analyses will appear here. Case entry and AI analysis arrive in Phase 2.</p></div>}
    </section><aside className="panel"><h2>What’s ready. What’s next.</h2><ul className="roadmap"><li><CheckCircle2 size={17} /><span>Your personal account<small>Registration and protected sign-in</small></span></li><li><CheckCircle2 size={17} /><span>Your learning dashboard<small>Access to your own saved records</small></span></li><li><CircleDashed size={17} /><span>Synthetic case analysis<small>Phase 2 · Not available yet</small></span></li><li><CircleDashed size={17} /><span>MDM and CPT explanations<small>Phase 2 · Not available yet</small></span></li></ul></aside></div>
    <p className="text-sm text-slate-600">Signed in as {user.email}. Use an account email you are comfortable using for a portfolio demo.</p>
  </>;
}
