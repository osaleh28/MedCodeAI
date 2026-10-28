import Link from "next/link";
import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { listMyAnalysisPage } from "@/lib/analyses";
import { noteLabels } from "@/lib/clinical/input";
import { Disclaimer } from "@/components/disclaimer";

export const metadata: Metadata = { title: "Analysis history" };
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const history = await listMyAnalysisPage(Number(params.page ?? 1));
  return <><div className="dashboard-heading"><div><span className="eyebrow">Your learning record</span><h1>Analysis history</h1><p>{history.total} saved assessment{history.total === 1 ? "" : "s"}. Only your own records appear here.</p></div><Link className="button primary" href="/dashboard/new">New analysis</Link></div><section className="panel">{history.records.length ? <div className="history-table-wrap"><table className="history-table"><caption className="sr-only">Your saved documentation analyses</caption><thead><tr><th scope="col">Analysis</th><th scope="col">Note type</th><th scope="col">Created (UTC)</th><th scope="col">MDM</th><th scope="col">Potential CPT</th></tr></thead><tbody>{history.records.map((item) => <tr key={item.id}><td><Link className="text-link" href={`/dashboard/analyses/${item.id}`}>{item.title}</Link></td><td>{item.noteType === "admission" || item.noteType === "progress" ? noteLabels[item.noteType] : "Earlier record"}</td><td>{item.createdAt.toLocaleString("en-US", { timeZone: "UTC" })}</td><td>{item.mdmComplexity ?? "Indeterminate"}</td><td>{item.suggestedCptCode ?? "Indeterminate"}</td></tr>)}</tbody></table></div> : <div className="empty-state"><div className="empty-icon"><FolderOpen size={28} /></div><h2>{history.total ? "No records on this page" : "Your first case starts here."}</h2><p>Analyze fictional or fully de-identified documentation to save a complete assessment, evidence, and any HPI suggestion.</p></div>}
    <nav className="pagination" aria-label="History pages">{history.page > 1 && <Link className="button secondary small" href={`/dashboard/history?page=${history.page - 1}`}>Previous</Link>}<span>Page {history.page} of {history.pages}</span>{history.page < history.pages && <Link className="button secondary small" href={`/dashboard/history?page=${history.page + 1}`}>Next</Link>}</nav></section><div className="mt-6"><Disclaimer /></div></>;
}
