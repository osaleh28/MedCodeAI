import { Brand } from "@/components/brand";
import Link from "next/link";
import type { Metadata } from "next";
import { logout } from "@/app/actions";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <><header className="site-header workspace-header"><div className="container header-inner"><Brand /><nav className="nav-actions" aria-label="Account navigation"><Link className="text-link" href="/dashboard">Dashboard</Link><Link className="text-link" href="/dashboard/new">New analysis</Link><Link className="text-link" href="/dashboard/history">History</Link><form action={logout}><button className="button secondary small" type="submit">Sign out</button></form></nav></div></header><main id="main-content" className="dashboard"><div className="container">{children}</div></main></>;
}
