import React from "react";
import { Textarea } from "../ui/textarea";
import "./key-pair-form.css";

interface KeyTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  /** Sets `aria-invalid`. */
  invalid?: boolean;
  /** Id of the element that describes the field (for example its inline error). */
  describedBy?: string;
}

export const KeyTextarea = React.forwardRef<HTMLTextAreaElement, KeyTextareaProps>(
  ({ id, value, onChange, placeholder, required, invalid, describedBy }, ref) => {
    return (
      <Textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="key-textarea"
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
      />
    );
  },
);
KeyTextarea.displayName = "KeyTextarea";
