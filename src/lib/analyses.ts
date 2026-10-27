import "server-only";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function listMyAnalyses() {
  const user = await requireUser();
  return getDb().billingAnalysis.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, createdAt: true, mdmComplexity: true, suggestedCptCode: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getMyAnalysis(id: string) {
  const user = await requireUser();
  return getDb().billingAnalysis.findFirst({ where: { id, userId: user.id } });
}
