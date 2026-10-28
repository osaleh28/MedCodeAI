import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

export const currentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await getDb().user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true } });
  return user;
});

export const requireUser = cache(async () => {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
});
