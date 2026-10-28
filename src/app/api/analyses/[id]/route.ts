import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { deleteOwnedAnalysis, findOwnedAnalysis } from "@/lib/owned-analysis";
import { sameOrigin } from "@/lib/clinical/api-input";
import { revalidatePath } from "next/cache";

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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await currentUser();
    if (!user) return Response.json({ error: "Authentication required." }, { status: 401, headers });
    if (!sameOrigin(request)) return Response.json({ error: "Delete analyses from this application's dashboard." }, { status: 403, headers });
    const { id } = await params;
    const deleted = await deleteOwnedAnalysis((where) => getDb().billingAnalysis.deleteMany({ where }), user.id, id);
    if (!deleted) return Response.json({ error: "Analysis not found." }, { status: 404, headers });
    revalidatePath("/dashboard", "layout");
    return new Response(null, { status: 204, headers });
  } catch {
    console.error("[analysis] Saved analysis delete failed");
    return Response.json({ error: "Unable to delete this analysis. Check your recent analyses before trying again." }, { status: 503, headers });
  }
}
