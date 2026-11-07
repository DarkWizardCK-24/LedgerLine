"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { Title } from "@/components/page";
import { Card, EmptyState } from "@/components/ui";
import { useOrg } from "@/lib/org";
import type { DocType } from "@/lib/types";

function NewDoc() {
  const type: DocType = useSearchParams().get("type") === "bill" ? "bill" : "invoice";
  const { can } = useOrg();
  const router = useRouter();
  if (!can("accountant")) return <Card><EmptyState title="Read-only access" body="Your role can view documents but not create them." /></Card>;
  return (
    <div className="mx-auto max-w-2xl">
      <Title sub={type === "invoice" ? "Bill a customer. When you issue it, your books are updated for you." : "Record what you owe a supplier so it shows up in what you have to pay."}>{type === "invoice" ? "New invoice" : "New bill"}</Title>
      <InvoiceForm type={type} onSaved={(i) => router.replace(`/invoices/${i.id}?type=${i.doc_type}`)} />
    </div>
  );
}

export default function NewDocPage() {
  return <Suspense fallback={null}><NewDoc /></Suspense>;
}
