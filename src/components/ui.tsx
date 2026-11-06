"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ----------------------------------------------------------------- buttons */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "md" | "lg" | "sm";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 select-none";
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-14 px-6 text-base" }[size];
  const variants = {
    primary: "bg-brand-gradient text-white shadow-[0_8px_20px_-8px_rgb(14_138_91/0.7)] hover:brightness-110",
    gold: "bg-gold-gradient text-[#3b2a05] shadow-[0_8px_20px_-8px_rgb(217_154_27/0.7)] hover:brightness-105",
    secondary: "bg-surface text-foreground border border-border hover:bg-surface-muted",
    ghost: "text-brand-strong hover:bg-brand-soft",
    danger: "bg-expense text-white hover:brightness-110",
  }[variant];
  return (
    <button className={cx(base, sizes, variants, className)} disabled={disabled || loading} {...rest}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- surfaces */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-3xl border border-border bg-surface shadow-card", className)} {...rest}>{children}</div>;
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "brand" | "gold" | "expense" | "muted"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-surface-muted text-foreground",
    brand: "bg-brand-soft text-brand-strong",
    gold: "bg-gold-soft text-warning",
    expense: "bg-expense-soft text-expense",
    muted: "bg-surface-muted text-muted",
  }[tone];
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones)}>{children}</span>;
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} aria-hidden />;

export function EmptyState({ art = "book", title, body, action }: { art?: "book" | "chart"; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center anim-rise">
      <Image src={`/art/empty-${art}.svg`} alt="" width={240} height={180} className="h-auto w-56" priority={false} />
      <h3 className="font-display mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="m-4 rounded-2xl border border-expense/30 bg-expense-soft p-4 text-sm text-expense">
      <p className="font-semibold">That didn&apos;t work</p>
      <p className="mt-0.5">{message}</p>
      {retry && <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>Try again</Button>}
    </div>
  );
}

/* ----------------------------------------------------------------- forms */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children(id)}
      {error ? <p className="text-sm text-expense" role="alert">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "appearance-auto", props.className)} />;
}

export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="scroll-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cx("tap shrink-0 rounded-full border px-4 text-sm font-semibold transition",
            value === o.value ? "border-transparent bg-brand-gradient text-white" : "border-border bg-surface text-muted hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- sheet: bottom sheet on phones, centered dialog on desktop */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#03150f]/55 backdrop-blur-[2px] anim-fade" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-border bg-surface shadow-2xl outline-none md:max-w-lg md:rounded-[28px]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border md:hidden" aria-hidden />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="tap grid place-items-center rounded-full text-muted hover:bg-surface-muted"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-border px-5 pb-safe pt-3 pb-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmSheet({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose }:
  { open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={<div className="grid grid-cols-2 gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} loading={busy} onClick={onConfirm}>{confirmLabel}</Button></div>}>
      <p className="text-[15px] text-muted">{body}</p>
    </Sheet>
  );
}

/* ----------------------------------------------------------------- toast */
type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // One toast at a time: a newer message replaces the older one instead of stacking over the controls.
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setItem({ id: Date.now() + Math.random(), text, tone });
    timer.current = setTimeout(() => setItem(null), tone === "error" ? 5000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+64px)] z-[60] flex justify-center px-4 lg:bottom-6 lg:top-auto">
        {item && (
          <div key={item.id} className={cx("anim-rise pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl",
            item.tone === "ok" ? "bg-[#0a3d2c] text-white" : "bg-expense text-white")}>{item.text}</div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
