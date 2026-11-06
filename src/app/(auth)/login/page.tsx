"use client";

import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Button, Field, Input } from "@/components/ui";
import { passwordStrength } from "@/lib/supabase-auth";
import { useAuth } from "@/lib/auth";

type Mode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const { status, signIn, signUp, sendReset, busy, error, info, clearMessages, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => { if (status === "signedIn") router.replace("/"); }, [status, router]);

  const switchMode = (m: Mode) => { clearMessages(); setMode(m); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") await signIn(email, password);
    else if (mode === "signup") await signUp(name, email, password);
    else await sendReset(email);
  };
  const strength = passwordStrength(password);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* hero */}
      <section className="relative isolate h-[34dvh] min-h-[250px] overflow-hidden lg:h-auto lg:min-h-dvh">
        <Image src="/art/hero.svg" alt="" fill priority sizes="(min-width:1024px) 52vw, 100vw" className="-z-10 object-cover" />
        <div className="pt-safe absolute inset-0 -z-0 bg-gradient-to-b from-[#03281f]/55 via-transparent to-[#03281f]/35" />
        <div className="pt-safe relative flex h-full flex-col justify-between p-5 lg:p-12">
          <div className="rounded-2xl bg-white/90 px-3.5 py-2 backdrop-blur self-start shadow-lg"><Logo size={34} /></div>
          <div className="hidden max-w-md text-white lg:block">
            <h2 className="font-display text-5xl font-semibold leading-[1.05]">Every rupee, <span className="text-[#ffe08a]">accounted for.</span></h2>
            <p className="mt-4 text-lg text-white/85">Real double-entry books: every entry balanced, every report built from the ledger.</p>
          </div>
        </div>
      </section>

      {/* form: a sheet that rises over the hero on phones */}
      <section className="relative -mt-7 rounded-t-[32px] bg-background px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-8 lg:mt-0 lg:grid lg:place-items-center lg:rounded-none lg:px-12">
        <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-5 anim-rise" noValidate>
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {mode === "signin" ? "Sign in with your platform account." : mode === "signup" ? "One account works across Ledgerly, Lensly and Ledgerline." : "We'll email you a reset link."}
            </p>
          </div>

          {!configured && <p role="alert" className="rounded-2xl bg-gold-soft p-3 text-sm text-warning">Sign-in isn&apos;t configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in <code>.env.local</code>.</p>}

          {mode === "signup" && (
            <Field label="Your name">{(id) => <Input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
          )}
          <Field label="Email">{(id) => <Input id={id} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
          {mode !== "reset" && (
            <Field label="Password">
              {(id) => (
                <div className="relative">
                  <Input id={id} type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" required />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="tap absolute right-1 top-1 grid h-10 w-10 place-items-center text-muted">{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
                </div>
              )}
            </Field>
          )}
          {mode === "signup" && password && (
            <div className="flex gap-1.5" aria-label={`Password strength ${strength} of 4`}>
              {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength ? (strength < 3 ? "bg-gold" : "bg-brand") : "bg-border"}`} />)}
            </div>
          )}

          {error && <p role="alert" className="rounded-2xl bg-expense-soft p-3 text-sm text-expense">{error}</p>}
          {info && <p role="status" className="rounded-2xl bg-brand-soft p-3 text-sm text-brand-strong">{info}</p>}

          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!configured}>
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>

          <div className="space-y-2 text-center text-sm">
            {mode === "signin" && <button type="button" onClick={() => switchMode("reset")} className="tap font-semibold text-muted underline-offset-4 hover:underline">Forgot password?</button>}
            <p className="text-muted">
              {mode === "signup" ? "Already have an account? " : mode === "signin" ? "New here? " : "Remembered it? "}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} className="font-bold text-brand-strong">
                {mode === "signup" || mode === "reset" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-4" /> Your password is sent only to the sign-in service.</p>
        </form>
      </section>
    </div>
  );
}
