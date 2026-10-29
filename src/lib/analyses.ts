import "server-only";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { findOwnedAnalysis } from "@/lib/owned-analysis";

export async function listMyAnalyses() {
  const user = await requireUser();
  return getDb().billingAnalysis.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, createdAt: true, mdmComplexity: true, suggestedCptCode: true, noteType: true, inputMode: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 3,
  });
}

export async function getMyAnalysis(id: string) {
  const user = await requireUser();
  return findOwnedAnalysis((where) => getDb().billingAnalysis.findFirst({ where }), user.id, id);
}

export async function listMyAnalysisPage(page: number) {
  const user = await requireUser();
  const pageSize = 20;
  const safePage = Math.min(10_000, Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1));
  const where = { userId: user.id };
  const [records, total] = await Promise.all([
    getDb().billingAnalysis.findMany({ where, select: { id: true, title: true, noteType: true, createdAt: true, mdmComplexity: true, suggestedCptCode: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (safePage - 1) * pageSize, take: pageSize }),
    getDb().billingAnalysis.count({ where }),
  ]);
  return { records, total, page: safePage, pages: Math.max(1, Math.ceil(total / pageSize)) };
}
