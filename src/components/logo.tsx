import Image from "next/image";

export function Glyph({ size = 36 }: { size?: number }) {
  return <Image src="/glyph.svg" alt="" width={size} height={size} priority style={{ width: size, height: size }} />;
}

export function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Glyph size={size} />
      <span className="leading-none">
        <span className="font-display text-[1.35rem] font-bold tracking-tight text-foreground">
          Ledger<span className="text-gradient">line</span>
        </span>
        {tagline && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Double-entry accounting</span>}
      </span>
    </span>
  );
}
