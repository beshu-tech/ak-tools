import { useId } from "react";
import { cn } from "@/lib/utils";

/** The AK Tools mark: a key on a blue tile. Keep in sync with public/favicon.svg. */
export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11.5" cy="16" r="4.6" />
        <path d="M16.1 16h9.4M21.5 16v4.2M25.5 16v3" />
      </g>
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] leading-none tracking-tight">
        <span className="font-semibold">AK</span>{" "}
        <span className="text-muted-foreground">Tools</span>
      </span>
    </span>
  );
}
