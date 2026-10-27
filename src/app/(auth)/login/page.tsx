import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const { registered } = await searchParams;
  return <><h1>Welcome back.</h1><p className="intro">Sign in to your MedCode AI learning space.</p>{registered === "1" && <p className="success" role="status">Account created. Sign in to get started.</p>}<AuthForm mode="login" /></>;
}
