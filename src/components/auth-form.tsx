"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { login, register } from "@/app/actions";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const [state, action, pending] = useActionState(isRegister ? register : login, {});
  return <form action={action} className="auth-form">
    {isRegister && <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" placeholder="Alex Morgan" minLength={2} maxLength={80} required /></div>}
    <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={12} maxLength={72} aria-describedby={isRegister ? "password-help" : undefined} required />
      {isRegister && <p id="password-help" className="field-help">Use 12 or more characters, up to 72 bytes.</p>}
    </div>
    {isRegister && <div className="field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" maxLength={72} aria-describedby="confirm-password-help" required /><p id="confirm-password-help" className="field-help">Enter the same password again.</p></div>}
    {isRegister && <label className="checkbox-label"><input type="checkbox" name="syntheticOnly" required /><span>I will use synthetic data only and will never enter real patient information.</span></label>}
    <div aria-live="polite" aria-atomic="true">{state.error && <p className="form-error" role="alert">{state.error}</p>}</div>
    <button className="button primary full" type="submit" disabled={pending}>
      {pending ? <><LoaderCircle className="spin" size={18} /> Please wait…</> : <>{isRegister ? "Create account" : "Sign in"}<ArrowRight size={18} /></>}
    </button>
    <p className="auth-switch">{isRegister ? "Already have an account?" : "New to MedCode AI?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
  </form>;
}
