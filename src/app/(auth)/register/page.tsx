import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create an account" };
export default function RegisterPage() {
  return <><h1>Your learning starts here.</h1><p className="intro">Create a free account for this educational portfolio demo.</p><AuthForm mode="register" /></>;
}
