import { cn } from "@/lib/utils";

/**
 * The Beshu pinecone mark (public/beshu-mark.png, white on transparent), used as a
 * mask so it takes the brand gradient in both themes.
 */
export function LogoMark({ className }: { className?: string }) {
  const mask = `url(${import.meta.env.BASE_URL}beshu-mark.png) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-8 w-[25px] shrink-0 bg-linear-to-br from-brand-cyan to-brand-green",
        className,
      )}
      style={{ mask, WebkitMask: mask }}
    />
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-3">
      <LogoMark />
      <span className="font-heading text-xl leading-none tracking-tight">
        <span className="font-medium">AK</span>{" "}
        <span className="font-light text-muted-foreground">Tools</span>
      </span>
    </span>
  );
}
