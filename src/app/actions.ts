"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { signIn, signOut } from "@/auth";
import { getDb } from "@/lib/db";
import { registrationSchema, loginSchema } from "@/lib/validation";
import { allowAuthAttempt } from "@/lib/throttle";

export type FormState = { error?: string };

export async function register(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  try {
    if (!(await allowAuthAttempt(email, "register"))) return { error: "Too many attempts. Please try again in 15 minutes." };
    const passwordHash = await hash(password, 12);
    await getDb().user.create({ data: { name, email, passwordHash } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Unable to create this account. Try signing in or use another email." };
    }
    // Log only the error category/code, never credentials, form data, or raw
    // database messages (which can contain connection details).
    console.error("[registration] Account creation failed", {
      type: error instanceof Error ? error.name : "UnknownError",
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    });
    return { error: "Registration is temporarily unavailable. Please try again later." };
  }
  redirect("/login?registered=1");
}

export async function login(_previous: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.type === "CredentialsSignin"
        ? "Unable to sign in. Check your email and password, or try again in 15 minutes."
        : "Sign-in is temporarily unavailable. Please try again later." };
    }
    throw error; // Preserve Next.js redirect exceptions.
  }
  return {};
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
