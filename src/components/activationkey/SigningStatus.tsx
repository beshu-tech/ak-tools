import { AlertTriangle, CheckCircle2, KeyRound, Undo2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { SigningStatus as Status } from "../../utils/payload";
import { Button } from "../ui/button";

interface SigningStatusProps {
  status: Status;
  /** Lets the disabled Generate button point at this text as its description. */
  id?: string;
  /** Puts the editor back to the claims of the current key. */
  onRevert: () => void;
}

const MESSAGES: Record<Status, string> = {
  "invalid-json": "The payload is not a valid JSON object, so it cannot be signed.",
  "no-key": "Add a signing key to generate an activation key.",
  edited: "You edited the payload. The key below does not include your changes yet.",
  "key-mismatch":
    "The selected key did not sign this activation key. Generate to sign it with this key.",
  "up-to-date": "The activation key matches the payload.",
};

/** One line under the Generate button that says why it is enabled or disabled. */
export function SigningStatus({ status, id, onRevert }: SigningStatusProps) {
  const tone =
    status === "up-to-date"
      ? "text-muted-foreground"
      : status === "invalid-json"
        ? "text-destructive"
        : "text-amber-600 dark:text-amber-400";
  const Icon =
    status === "up-to-date"
      ? CheckCircle2
      : status === "no-key" || status === "key-mismatch"
        ? KeyRound
        : AlertTriangle;

  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      data-status={status}
      className={`flex items-start gap-2 text-sm ${tone}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">
        {MESSAGES[status]}
        {status === "no-key" && (
          <>
            {" "}
            <Link to="/keys" className="underline underline-offset-2">
              Go to Keys
            </Link>
          </>
        )}
      </p>
      {(status === "edited" || status === "invalid-json") && (
        <Button variant="ghost" size="sm" className="-my-1 gap-1.5" onClick={onRevert}>
          <Undo2 aria-hidden="true" className="h-3.5 w-3.5" />
          Revert
        </Button>
      )}
    </div>
  );
}
