"use client";

import { useRouter } from "next/navigation";
import { QuickForm } from "@/components/quick-form";
import { Title } from "@/components/page";
import { Card, EmptyState } from "@/components/ui";
import { useOrg } from "@/lib/org";

export default function QuickPage() {
  const { can } = useOrg();
  const router = useRouter();
  if (!can("accountant")) return <Card><EmptyState title="Read-only access" body="Your role can view the books but not record transactions." /></Card>;
  return (
    <div className="mx-auto max-w-xl">
      <Title sub="No debits or credits to think about. We handle the accounting.">Add a transaction</Title>
      <Card className="p-4"><QuickForm onDone={(r) => r.status !== "draft" && router.push("/")} /></Card>
    </div>
  );
}
