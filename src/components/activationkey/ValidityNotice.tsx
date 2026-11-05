import { format } from "date-fns";
import { AlertTriangle, CalendarCheck, Infinity as InfinityIcon } from "lucide-react";
import { describeValidity } from "../../utils/validity";

interface ValidityNoticeProps {
  /** The `exp` claim, or null/undefined when the key has none. */
  expiresAt: Date | null | undefined;
  /** True when the shown dates are edits that the key does not carry yet. */
  pending?: boolean;
  /** Clock override for tests. */
  now?: Date;
}

const day = (date: Date) => format(date, "d MMM yyyy");

/** Says in words whether the key is expired, and how long it stays valid. */
export function ValidityNotice({ expiresAt, pending = false, now }: ValidityNoticeProps) {
  const validity = describeValidity(expiresAt, now);

  const tone =
    validity.state === "expired"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-border bg-muted/50 text-foreground";

  return (
    <div
      role="note"
      data-validity={validity.state}
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${tone}`}
    >
      {validity.state === "expired" && (
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {validity.state === "valid" && (
        <CalendarCheck
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
        />
      )}
      {validity.state === "no-expiry" && (
        <InfinityIcon
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        />
      )}
      <div className="space-y-0.5">
        {validity.state === "expired" && (
          <>
            <p className="font-medium">This activation key is expired.</p>
            <p>
              It expired {validity.span} ago, on {day(validity.since)}.
            </p>
          </>
        )}
        {validity.state === "valid" && (
          <p>
            <span className="font-medium">Valid for {validity.span}</span>, until{" "}
            {day(validity.until)}.
          </p>
        )}
        {validity.state === "no-expiry" && (
          <p>
            <span className="font-medium">No expiry:</span> this activation key never expires.
          </p>
        )}
        {pending && (
          <p className="text-xs text-muted-foreground">Applies once you generate the key.</p>
        )}
      </div>
    </div>
  );
}
