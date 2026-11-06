"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Glyph, Logo } from "@/components/logo";
import { OrgForm } from "@/components/org-form";
import { AppShell } from "@/components/shell";
import { Card, ErrorState, ToastProvider } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { OrgProvider, useOrg } from "@/lib/org";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse"><Glyph size={64} /></div>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { orgs, loading, error, reload } = useOrg();
  if (loading) return <Splash />;
  if (error && orgs.length === 0) return <div className="mx-auto max-w-md pt-24"><ErrorState message={error} retry={() => reload()} /></div>;
  if (orgs.length === 0) {
    return (
      <div className="min-h-dvh lg:grid lg:grid-cols-2">
        <div className="relative hidden lg:block"><Image src="/art/hero.svg" alt="" fill sizes="50vw" className="object-cover" /></div>
        <div className="pt-safe mx-auto w-full max-w-md px-5 py-8 lg:grid lg:place-items-center">
          <div className="w-full space-y-6 anim-rise">
            <Logo />
            <div>
              <h1 className="font-display text-3xl font-semibold">Set up your books</h1>
              <p className="mt-1 text-sm text-muted">We&apos;ll create your organization with a ready-to-use chart of accounts.</p>
            </div>
            <Card className="p-5"><OrgForm /></Card>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  useEffect(() => { if (status === "signedOut") router.replace("/login"); }, [status, router]);
  if (status !== "signedIn") return <Splash />;
  return (
    <OrgProvider>
      <ToastProvider>
        <Gate><AppShell>{children}</AppShell></Gate>
      </ToastProvider>
    </OrgProvider>
  );
}

