import { useCallback, useState } from "react";
import type { Algorithm, KeyPair } from "../types/activationKey";
import { signJWT, toEpochSeconds } from "../utils/activationKey";
import { useToast } from "./use-toast";
import type { AkTemplate } from "./use-templates";

export interface UseSaveTemplateParams {
  jwt: string;
  editorValue: string;
  algorithm: Algorithm;
  selectedKeyId: string;
  /** Template the current key was loaded from, if any. */
  sourceTemplateId: string | null;
  isJwtExpired: () => boolean;
  templates: AkTemplate[];
  getTemplateById: (id: string) => AkTemplate | undefined;
  addTemplate: (template: Omit<AkTemplate, "id" | "createdAt">) => AkTemplate;
  updateTemplate: (id: string, updates: Partial<Omit<AkTemplate, "id" | "createdAt">>) => void;
  getKeyPairById: (id: string) => KeyPair | undefined;
}

/**
 * State and actions of the "Save as template" flow: form fields, the
 * "templates should hold expired keys" notice, name conflict / overwrite
 * confirmations and signing of the expired copy.
 */
export function useSaveTemplate({
  jwt,
  editorValue,
  algorithm,
  selectedKeyId,
  sourceTemplateId,
  isJwtExpired,
  templates,
  getTemplateById,
  addTemplate,
  updateTemplate,
  getKeyPairById,
}: UseSaveTemplateParams) {
  const { error: showError, success: showSuccess, confirm } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [saveAsExpired, setSaveAsExpired] = useState(false);

  // Handle opening save template popover
  const openDialog = useCallback(() => {
    const notExpired = !isJwtExpired();
    setShowExpiryWarning(notExpired);
    setSaveAsExpired(notExpired); // Default to save as expired if not already expired
    setOpen(true);

    // Pre-fill with source template info if loaded from a template
    if (sourceTemplateId) {
      const sourceTemplate = getTemplateById(sourceTemplateId);
      if (sourceTemplate) {
        setName(sourceTemplate.name);
        setDescription(sourceTemplate.description || "");
        return;
      }
    }

    setName("");
    setDescription("");
  }, [isJwtExpired, sourceTemplateId, getTemplateById]);

  // Find existing template by name
  const findTemplateByName = useCallback(
    (name: string) => {
      return templates.find((t) => t.name.toLowerCase() === name.toLowerCase());
    },
    [templates],
  );

  // Generate activation key with modified expiry for template saving
  const getActivationKeyForTemplate = useCallback(async (): Promise<string | null> => {
    if (!saveAsExpired || isJwtExpired()) {
      return jwt; // Return current AK as-is
    }

    // Need to sign a new AK with expiry 24h before now
    const selectedKey = getKeyPairById(selectedKeyId);
    if (!selectedKey) {
      showError("No signing key selected");
      return null;
    }

    let payload;
    try {
      payload = JSON.parse(editorValue);
    } catch {
      showError("Invalid JSON payload");
      return null;
    }

    // Set expiry to 24 hours ago
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Ensure exp is not before iat (issued at) if present
    const iatTimestamp = payload.iat;
    if (iatTimestamp && expiredDate.getTime() / 1000 < iatTimestamp) {
      // Set exp to 1 second after iat to maintain valid temporal order
      payload.exp = iatTimestamp + 1;
    } else {
      payload.exp = toEpochSeconds(expiredDate);
    }

    try {
      const expiredToken = await signJWT(
        payload,
        algorithm,
        selectedKey,
        new Date(payload.exp * 1000),
      );
      return expiredToken;
    } catch (error) {
      console.error("Error generating expired AK:", error);
      showError("Failed to generate expired activation key");
      return null;
    }
  }, [
    saveAsExpired,
    isJwtExpired,
    jwt,
    selectedKeyId,
    editorValue,
    algorithm,
    getKeyPairById,
    showError,
  ]);

  // Handle saving template
  const save = useCallback(async () => {
    if (!name.trim()) {
      showError("Please enter a template name");
      return;
    }

    if (!jwt) {
      showError("No activation key to save");
      return;
    }

    const trimmedName = name.trim();
    const existingTemplate = findTemplateByName(trimmedName);
    const isOverwrite = existingTemplate && existingTemplate.id === sourceTemplateId;
    const isNameConflict = existingTemplate && existingTemplate.id !== sourceTemplateId;

    // If name conflicts with a different template, warn and ask
    if (isNameConflict) {
      const confirmed = await confirm(
        `A template named "${trimmedName}" already exists. Do you want to overwrite it?`,
      );
      if (!confirmed) return;
    }

    // If overwriting source template, ask for confirmation
    if (isOverwrite) {
      const confirmed = await confirm(
        `Do you want to update the existing template "${trimmedName}"?`,
      );
      if (!confirmed) return;
    }

    // Get the activation key (possibly with modified expiry)
    const activationKeyToSave = await getActivationKeyForTemplate();
    if (!activationKeyToSave) return;

    // Save or update
    if (existingTemplate) {
      updateTemplate(existingTemplate.id, {
        name: trimmedName,
        description: description.trim() || undefined,
        activationKey: activationKeyToSave,
      });
      showSuccess("Template updated successfully");
    } else {
      addTemplate({
        name: trimmedName,
        description: description.trim() || undefined,
        activationKey: activationKeyToSave,
      });
      showSuccess("Template saved successfully");
    }

    setOpen(false);
    setName("");
    setDescription("");
    setShowExpiryWarning(false);
    setSaveAsExpired(false);
  }, [
    name,
    description,
    jwt,
    sourceTemplateId,
    findTemplateByName,
    getActivationKeyForTemplate,
    updateTemplate,
    addTemplate,
    showError,
    showSuccess,
    confirm,
  ]);

  const isUpdate = sourceTemplateId !== null && findTemplateByName(name)?.id === sourceTemplateId;

  return {
    open,
    setOpen,
    name,
    setName,
    description,
    setDescription,
    showExpiryWarning,
    saveAsExpired,
    setSaveAsExpired,
    isUpdate,
    openDialog,
    save,
  };
}

export type SaveTemplateState = ReturnType<typeof useSaveTemplate>;
