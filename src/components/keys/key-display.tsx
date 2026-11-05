import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "../ui/button";

interface KeyDisplayProps {
  /** Visible heading, for example "Public Key (PEM)". */
  label: string;
  /** Used in the button name, for example "Show private key". */
  kind: "public" | "private";
  value: string;
}

/**
 * Key material, blurred until the user chooses to show it.
 * While blurred the text is hidden from assistive technology; the toggle button
 * is the only way to reveal it (focus inside the field also unblurs it for sighted keyboard users).
 */
export const KeyDisplay = ({ label, kind, value }: KeyDisplayProps) => {
  const labelId = useId();
  const [shown, setShown] = useState(false);

  return (
    <div role="group" aria-labelledby={labelId} className="key-field space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span id={labelId} className="key-label">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${shown ? "Hide" : "Show"} ${kind} key`}
          onClick={() => setShown((prev) => !prev)}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {shown ? "Hide" : "Show"}
        </Button>
      </div>
      <div
        className={shown ? "key-display" : "key-display blurred"}
        aria-hidden={shown ? undefined : true}
      >
        {value}
      </div>
    </div>
  );
};
