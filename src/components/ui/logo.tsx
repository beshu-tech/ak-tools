import { cn } from "@/lib/utils";

/**
 * The Beshu pinecone (public/beshu-mark.png, white on transparent) as a mask,
 * so it is white on the dark theme and dark teal on the light one.
 */
export function LogoMark({ className }: { className?: string }) {
  const mask = `url(${import.meta.env.BASE_URL}beshu-mark.png) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-8 w-[25px] shrink-0 bg-foreground", className)}
      style={{ mask, WebkitMask: mask }}
    />
  );
}

/** Beshu logo (mark and wordmark) followed by the product name. */
export function Logo() {
  return (
    <span className="flex items-center gap-3">
      <LogoMark />
      <span className="font-heading text-2xl font-normal leading-none tracking-tight">Beshu</span>
      <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
      <span className="hidden font-heading text-sm font-light uppercase tracking-widest text-muted-foreground sm:block">
        AK Tools
      </span>
    </span>
  );
}
