import React, { useEffect, useId, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { KeyPair } from "../../types/activationKey";
import type { KeyPairValidationErrors } from "../../utils/validation";
import { Wand2 } from "lucide-react";
import { KeyTextarea } from "./key-textarea";
import { KEY_PAIR_FIELDS, type KeyPairField } from "./key-pair-errors";
import "./key-pair-form.css";

export interface KeyPairFormProps {
  mode: "create" | "edit";
  keyPair: Partial<KeyPair>;
  onChange: (e: Partial<KeyPair>) => void;
  onSave: () => void;
  onCancel: () => void;
  onGenerateKeys?: () => Promise<void>;
  /** Inline validation errors by field. */
  errors?: KeyPairValidationErrors;
  /** Increase on every failed submit: the first invalid field then takes the focus. */
  failedSubmits?: number;
}

type Field = KeyPairField;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="whitespace-pre-line text-sm text-red-700 dark:text-red-300">
      {message}
    </p>
  ) : null;

const labelClass = "after:ml-0.5 after:text-red-700 dark:after:text-red-300 after:content-['*']";

export const KeyPairForm: React.FC<KeyPairFormProps> = ({
  mode,
  keyPair,
  onChange,
  onSave,
  onCancel,
  onGenerateKeys,
  errors = {},
  failedSubmits = 0,
}) => {
  const uid = useId();
  const ids = {
    name: `${uid}-name`,
    publicKey: `${uid}-publicKey`,
    privateKey: `${uid}-privateKey`,
  };
  const errorId = (field: Field) => `${ids[field]}-error`;
  const describedBy = (field: Field) => (errors[field] ? errorId(field) : undefined);

  const nameRef = useRef<HTMLInputElement>(null);
  const publicKeyRef = useRef<HTMLTextAreaElement>(null);
  const privateKeyRef = useRef<HTMLTextAreaElement>(null);
  const fieldRefs = { name: nameRef, publicKey: publicKeyRef, privateKey: privateKeyRef };

  // The form opens on its first field.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // A failed submit sends the focus to the first invalid field (not when an error clears while typing).
  useEffect(() => {
    if (!failedSubmits) return;
    const first = KEY_PAIR_FIELDS.find((field) => errors[field]);
    if (first) fieldRefs[first].current?.focus();
    // Only a new failed submit moves the focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedSubmits]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={ids.name} className={labelClass}>
          Name
        </Label>
        <Input
          ref={nameRef}
          id={ids.name}
          value={keyPair.name || ""}
          onChange={(e) => onChange({ ...keyPair, name: e.target.value })}
          placeholder="Name"
          required
          aria-required="true"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy("name")}
          autoComplete="off"
        />
        <FieldError id={errorId("name")} message={errors.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.publicKey} className={labelClass}>
          Public key (PEM)
        </Label>
        <KeyTextarea
          ref={publicKeyRef}
          id={ids.publicKey}
          value={keyPair.publicKey || ""}
          onChange={(value) => onChange({ ...keyPair, publicKey: value })}
          placeholder="Public Key (PEM)"
          required
          invalid={!!errors.publicKey}
          describedBy={describedBy("publicKey")}
        />
        <FieldError id={errorId("publicKey")} message={errors.publicKey} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.privateKey} className={labelClass}>
          Private key (PEM)
        </Label>
        <KeyTextarea
          ref={privateKeyRef}
          id={ids.privateKey}
          value={keyPair.privateKey || ""}
          onChange={(value) => onChange({ ...keyPair, privateKey: value })}
          placeholder="Private Key (PEM)"
          required
          invalid={!!errors.privateKey}
          describedBy={describedBy("privateKey")}
        />
        <FieldError id={errorId("privateKey")} message={errors.privateKey} />
      </div>

      <div className="flex flex-wrap justify-end items-center gap-2">
        {mode === "create" && onGenerateKeys && (
          <Button type="button" variant="outline" onClick={onGenerateKeys} className="mr-auto">
            <Wand2 className="h-4 w-4 mr-2" aria-hidden="true" />
            Generate Random Keys
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={onSave}>
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  );
};
