import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { findOwnedAnalysis } from "@/lib/owned-analysis";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await currentUser();
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401, headers });
    const { id } = await params;
    const record = await findOwnedAnalysis((where) => getDb().billingAnalysis.findFirst({ where }), user.id, id);
    if (!record) return Response.json({ error: "Analysis not found." }, { status: 404, headers });
    return Response.json(record, { headers });
  } catch {
    console.error("[analysis] Saved analysis read failed");
    return Response.json({ error: "Saved analyses are temporarily unavailable. Please try again later." }, { status: 503, headers });
  }
}
