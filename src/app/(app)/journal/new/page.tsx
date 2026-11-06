"use client";

import { EntryEditor } from "@/components/entry-editor";
import { Title } from "@/components/page";
import { Card, EmptyState } from "@/components/ui";
import { useOrg } from "@/lib/org";

export default function NewEntry() {
  const { can } = useOrg();
  if (!can("accountant")) return <Card><EmptyState title="Read-only access" body="Your role can view the books but not record entries. Ask an owner or admin for the accountant role." /></Card>;
  return (
    <div>
      <Title sub="Debits must equal credits before an entry can be posted.">New journal entry</Title>
      <EntryEditor />
    </div>
  );
}
