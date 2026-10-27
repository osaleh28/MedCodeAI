import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const requireUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await getDb().user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true } });
  if (!user) redirect("/login");
  return user;
});
