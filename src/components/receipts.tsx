"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { compressImage, fetchBlob, prettySize, uploadFile } from "@/lib/files";
import { errorMessage, useOrg, useOrgQuery } from "@/lib/org";
import type { Attachment } from "@/lib/types";
import { Button, Card, useToast } from "./ui";

/** Choose files (or take a photo on a phone) before an entry exists; they are uploaded once it has been saved. */
export function ReceiptPicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const add = async (list: FileList | null) => {
    if (!list) return;
    const next = await Promise.all(Array.from(list).map(compressImage));
    onChange([...files, ...next].slice(0, 10));
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take a photo of the receipt" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <input ref={picker} type="file" accept="image/*,application/pdf" multiple className="sr-only" aria-label="Choose receipt files" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <Button type="button" variant="secondary" size="sm" onClick={() => camera.current?.click()}><Camera className="size-4" /> Take photo</Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}><Paperclip className="size-4" /> Attach file</Button>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-brand" /><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted">{prettySize(f.size)}</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="tap grid place-items-center text-muted hover:text-expense"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function useUploadReceipts() {
  const { getToken } = useAuth();
  const { org } = useOrg();
  return async (entryId: string, files: File[]): Promise<string | null> => {
    const token = await getToken();
    if (!token || !org) return "You are signed out.";
    for (const f of files) {
      try { await uploadFile(token, `/journal-entries/${entryId}/attachments`, f, org.id); } catch (e) { return `${f.name}: ${errorMessage(e)}`; }
    }
    return null;
  };
}

function Thumb({ entryId, a }: { entryId: string; a: Attachment }) {
  const { getToken } = useAuth();
  const { org } = useOrg();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false, made: string | null = null;
    (async () => {
      const token = await getToken();
      if (!token || !org || !a.content_type.startsWith("image/")) return;
      try {
        made = URL.createObjectURL(await fetchBlob(token, `/journal-entries/${entryId}/attachments/${a.id}`, org.id));
        if (!revoked) setUrl(made);
      } catch { /* the name is still shown */ }
    })();
    return () => { revoked = true; if (made) URL.revokeObjectURL(made); };
  }, [entryId, a.id, a.content_type, getToken, org]);
  return url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt={a.file_name} className="size-14 rounded-xl object-cover" /> : <span className="grid size-14 place-items-center rounded-xl bg-surface-muted text-muted"><FileText className="size-6" /></span>;
}

/** The receipts attached to a saved entry: view, add, remove. */
export function EntryReceipts({ entryId, canEdit }: { entryId: string; canEdit: boolean }) {
  const { getToken } = useAuth();
  const { org, call } = useOrg();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useOrgQuery<Attachment[]>(["attachments", entryId], `/journal-entries/${entryId}/attachments`);
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const upload = useUploadReceipts();

  const open = async (a: Attachment) => {
    const token = await getToken();
    if (!token || !org) return;
    const url = URL.createObjectURL(await fetchBlob(token, `/journal-entries/${entryId}/attachments/${a.id}`, org.id));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const save = async () => {
    setBusy(true);
    const err = await upload(entryId, pending);
    setBusy(false);
    if (err) toast(err, "error"); else { toast("Receipt added."); setPending([]); }
    await qc.invalidateQueries({ queryKey: ["attachments"] });
  };

  return (
    <Card className="space-y-3 p-4">
      <h2 className="font-display text-lg font-semibold">Receipts & documents</h2>
      {list.data && list.data.length === 0 && <p className="text-sm text-muted">Nothing attached yet.</p>}
      <ul className="space-y-2">
        {list.data?.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <button onClick={() => open(a)} className="tap shrink-0" aria-label={`Open ${a.file_name}`}><Thumb entryId={entryId} a={a} /></button>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.file_name}</span><span className="text-xs text-muted">{prettySize(a.size_bytes)}</span></span>
            {canEdit && <button onClick={async () => { await call(`/journal-entries/${entryId}/attachments/${a.id}`, { method: "DELETE" }); await qc.invalidateQueries({ queryKey: ["attachments"] }); toast("Removed."); }} aria-label={`Remove ${a.file_name}`} className="tap grid place-items-center rounded-xl text-muted hover:bg-expense-soft hover:text-expense"><Trash2 className="size-5" /></button>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <ReceiptPicker files={pending} onChange={setPending} />
          {pending.length > 0 && <Button loading={busy} onClick={save}>Upload {pending.length} file{pending.length > 1 ? "s" : ""}</Button>}
        </>
      )}
    </Card>
  );
}
