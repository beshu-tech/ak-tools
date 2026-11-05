import { useReducer, useEffect, useCallback, useState, useRef, useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import Editor from "@monaco-editor/react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { X, Check, Pencil, AlertTriangle, Copy, FileText, Key } from "lucide-react";
import { Algorithm, SUPPORTED_ALGORITHMS } from "../../types/activationKey";
import {
  getJwtMetadata,
  getPayloadJson,
  signJWT,
  validateJWTSignature,
} from "../../utils/activationKey";
import {
  canGenerate,
  claimDate,
  deriveDraft,
  signingStatus,
  withClaimDate,
  type DateClaim,
} from "../../utils/payload";
import { SigningStatus } from "../activationkey/SigningStatus";
import { ActivationKeyMetadataDisplay } from "../activationkey/ActivationKeyMetadata";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { PageHeader } from "../ui/page-header";
import { SaveTemplatePopover } from "../activationkey/SaveTemplatePopover";
import { TemplatePicker } from "../activationkey/TemplatePicker";
import { TemplateSwitcher } from "../activationkey/TemplateSwitcher";
import { useSaveTemplate } from "../../hooks/use-save-template";
import { useTheme } from "../../hooks/use-theme";
import { useKeyPairs } from "../../hooks/use-key-pairs";
import { useTemplates } from "../../hooks/use-templates";
import { useToast } from "../../hooks/use-toast";
import { PENDING_TEMPLATE_KEY } from "./Templates";
import { editorReducer, initialState } from "./editorReducer";
import {
  MONACO_DARK_THEME,
  MONACO_LIGHT_THEME,
  MONACO_OPTIONS,
  defineMonacoThemes,
} from "./monacoOptions";
import "./ActivationKeyEditor.css";

const ActivationKeyEditor = () => {
  const { resolvedTheme } = useTheme();
  const { keyPairs, getKeyPairById } = useKeyPairs();
  const { templates, addTemplate, updateTemplate, getTemplateById } = useTemplates();
  const { error: showError, confirm } = useToast();
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Track source template (when loaded from a template)
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);

  // Ref to store handleInputChange to avoid effect dependency issues
  const handleInputChangeRef = useRef<((value: string) => Promise<void>) | undefined>(undefined);

  // Template switcher state
  const [templateSwitcherOpen, setTemplateSwitcherOpen] = useState(false);

  const { inputValue, jwt, editorValue, algorithm, selectedKeyId, validation, showCopied } = state;

  // The JSON in the editor is the source of truth; the key is only what was last signed.
  const draft = useMemo(() => deriveDraft(editorValue, jwt), [editorValue, jwt]);
  const isDirty = draft.hasEdits;

  // Check if current JWT is expired
  const jwtMetadata = useMemo(() => (jwt ? getJwtMetadata(jwt) : null), [jwt]);

  const isJwtExpired = useCallback(
    () => (jwtMetadata?.expiresAt ? jwtMetadata.expiresAt < new Date() : false),
    [jwtMetadata],
  );

  // Dates shown next to the editor come from the editor, so they never disagree with it.
  const draftMetadata = useMemo(() => {
    if (!jwtMetadata || !draft.payload) return jwtMetadata;
    return {
      ...jwtMetadata,
      issuedAt: claimDate(draft.payload, "iat") ?? null,
      expiresAt: claimDate(draft.payload, "exp") ?? null,
    };
  }, [jwtMetadata, draft.payload]);

  const setClaimDate = useCallback(
    (claim: DateClaim) => (date: Date | undefined) => {
      if (!date) return;
      const next = withClaimDate(editorValue, claim, date);
      if (next) dispatch({ type: "SET_EDITOR_VALUE", payload: next });
    },
    [editorValue],
  );

  const revertEdits = useCallback(
    () => dispatch({ type: "SET_EDITOR_VALUE", payload: getPayloadJson(jwt) }),
    [jwt],
  );

  const status = signingStatus({
    draft,
    hasSigningKey: !!getKeyPairById(selectedKeyId),
    signatureMismatch: validation?.errors?.signature === true,
  });

  // Set initial selected key when keyPairs load
  useEffect(() => {
    if (keyPairs.length > 0 && !selectedKeyId) {
      dispatch({ type: "SET_SELECTED_KEY", payload: keyPairs[0].id });
    }
  }, [keyPairs, selectedKeyId]);

  // Validate JWT when selected key changes
  useEffect(() => {
    if (!jwt) {
      dispatch({ type: "SET_VALIDATION", payload: null });
      return;
    }

    if (!selectedKeyId) {
      dispatch({
        type: "SET_VALIDATION",
        payload: {
          isValid: false,
          error: "No signing key selected",
          errors: { signature: true, message: "Please select a signing key" },
        },
      });
      return;
    }

    const selectedKey = getKeyPairById(selectedKeyId);
    if (!selectedKey) {
      dispatch({
        type: "SET_VALIDATION",
        payload: {
          isValid: false,
          error: "Selected key not found",
          errors: { signature: true, message: "The selected key no longer exists" },
        },
      });
      return;
    }

    validateJWTSignature(jwt, selectedKey).then((result) => {
      dispatch({ type: "SET_VALIDATION", payload: result });
    });
  }, [selectedKeyId, jwt, getKeyPairById]);

  const handleInputChange = useCallback(
    async (value: string) => {
      dispatch({ type: "SET_INPUT", payload: value });

      if (!value) {
        dispatch({ type: "CLEAR" });
        return;
      }

      // Try to parse as JWT
      const metadata = getJwtMetadata(value);
      let newAlgorithm: Algorithm | undefined;

      if (metadata?.algorithm && SUPPORTED_ALGORITHMS.includes(metadata.algorithm as Algorithm)) {
        newAlgorithm = metadata.algorithm as Algorithm;
      }

      const payloadOnly = getPayloadJson(value);

      dispatch({
        type: "SET_JWT",
        payload: {
          jwt: value,
          editorValue: payloadOnly,
          algorithm: newAlgorithm,
        },
      });

      // Validate signature
      const selectedKey = getKeyPairById(selectedKeyId);
      try {
        const validationResult = await validateJWTSignature(value, selectedKey);
        dispatch({ type: "SET_VALIDATION", payload: validationResult });
      } catch {
        dispatch({
          type: "SET_VALIDATION",
          payload: { isValid: false, error: "Invalid signature" },
        });
      }
    },
    [selectedKeyId, getKeyPairById],
  );

  // Keep ref in sync with callback
  handleInputChangeRef.current = handleInputChange;

  // Check for pending template to load when templates are available
  useEffect(() => {
    const pendingTemplateId = localStorage.getItem(PENDING_TEMPLATE_KEY);
    if (pendingTemplateId && templates.length > 0) {
      const template = getTemplateById(pendingTemplateId);
      if (template) {
        localStorage.removeItem(PENDING_TEMPLATE_KEY);
        setSourceTemplateId(template.id);
        handleInputChangeRef.current?.(template.activationKey);
      }
    }
  }, [templates, getTemplateById]);

  const handleSign = useCallback(async () => {
    const selectedKey = getKeyPairById(selectedKeyId);
    if (!selectedKey) return;

    const payload = draft.payload;
    if (!payload) {
      showError("Invalid JSON payload");
      return;
    }

    try {
      const exp = typeof payload.exp === "number" ? new Date(payload.exp * 1000) : undefined;
      const newToken = await signJWT(payload, algorithm, selectedKey, exp);

      dispatch({
        type: "SET_JWT",
        payload: { jwt: newToken, editorValue: getPayloadJson(newToken) },
      });
    } catch (error) {
      console.error("Signing error:", error);
      showError("Failed to sign activation key");
    }
  }, [selectedKeyId, draft.payload, algorithm, getKeyPairById, showError]);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    dispatch({ type: "SHOW_COPIED" });
    setTimeout(() => dispatch({ type: "HIDE_COPIED" }), 2000);
  }, []);

  const clearJwt = useCallback(() => {
    dispatch({ type: "CLEAR" });
    setSourceTemplateId(null);
    if (keyPairs.length > 0) {
      dispatch({ type: "SET_SELECTED_KEY", payload: keyPairs[0].id });
    }
  }, [keyPairs]);

  // Handle template switching with dirty check
  const handleSwitchTemplate = useCallback(
    async (templateId: string) => {
      const template = getTemplateById(templateId);
      if (!template) return;

      // Check for unsaved changes
      if (isDirty) {
        const confirmed = await confirm("You have unsaved changes. Switch template anyway?");
        if (!confirmed) return;
      }

      setTemplateSwitcherOpen(false);
      setSourceTemplateId(template.id);
      handleInputChange(template.activationKey);
    },
    [isDirty, confirm, getTemplateById, handleInputChange],
  );

  const saveTemplate = useSaveTemplate({
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
  });

  return (
    <div className="ak-editor-container">
      <PageHeader
        title="Activation Key Editor"
        description="Create, decode, and validate Activation Keys"
      />

      {!jwt ? (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <Textarea
              placeholder="Paste your Activation Key here"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="ak-input"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="border-l-2 border-primary/70 pl-3 text-sm text-muted-foreground">
                Decode, edit and re-sign a key, or start from a template.
              </p>
              <TemplatePicker
                templates={templates}
                onPick={(template) => {
                  setSourceTemplateId(template.id);
                  handleInputChange(template.activationKey);
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b px-4 py-2 sm:px-6">
            <span className="text-sm font-medium">Activation key</span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              aria-label="Clear activation key"
              onClick={clearJwt}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
          <CardContent className="space-y-6 p-4 sm:p-6">
            <div className="ak-content-wrapper">
              <div className="ak-editor-monaco">
                <Editor
                  defaultLanguage="json"
                  value={editorValue}
                  onChange={(value) =>
                    dispatch({ type: "SET_EDITOR_VALUE", payload: value || "{}" })
                  }
                  options={MONACO_OPTIONS}
                  beforeMount={defineMonacoThemes}
                  theme={resolvedTheme === "dark" ? MONACO_DARK_THEME : MONACO_LIGHT_THEME}
                />
              </div>

              <div className="ak-right-column">
                {/* Template Switcher with Validation Status */}
                <div className="space-y-2 pb-4 border-b mb-4">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Template
                  </Label>
                  <div className="flex items-center gap-2">
                    {/* Validation indicator */}
                    {isDirty && (
                      <div
                        title="Edited since the key was last generated"
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-500"
                      >
                        <Pencil className="h-4 w-4" />
                      </div>
                    )}
                    {!isDirty && validation && (
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          validation.isValid
                            ? "bg-green-500/10 text-green-500"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {validation.isValid ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </div>
                    )}
                    <TemplateSwitcher
                      templates={templates}
                      sourceTemplateId={sourceTemplateId}
                      isDirty={isDirty}
                      open={templateSwitcherOpen}
                      onOpenChange={setTemplateSwitcherOpen}
                      onSwitch={handleSwitchTemplate}
                    />
                  </div>
                </div>

                {/* Metadata Display */}
                {draftMetadata && (
                  <ActivationKeyMetadataDisplay
                    metadata={draftMetadata}
                    expiryDate={draftMetadata.expiresAt ?? undefined}
                    onExpiryChange={draft.payload ? setClaimDate("exp") : undefined}
                    issuedDate={draftMetadata.issuedAt ?? undefined}
                    onIssuedChange={draft.payload ? setClaimDate("iat") : undefined}
                  />
                )}

                {/* Signing Key Selection */}
                <div className="space-y-2 mt-4 pt-4 border-t">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Key className="h-3 w-3" />
                    Signing Key
                  </Label>
                  <Select
                    value={selectedKeyId}
                    onValueChange={(value) =>
                      dispatch({ type: "SET_SELECTED_KEY", payload: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a key for signing" />
                    </SelectTrigger>
                    <SelectContent>
                      {keyPairs.map((key) => (
                        <SelectItem key={key.id} value={key.id}>
                          {key.name} ({algorithm.startsWith("HS") ? "Symmetric" : "Asymmetric"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="ak-controls mt-4">
                  <Button
                    onClick={handleSign}
                    disabled={!canGenerate(status)}
                    className="sign-button"
                  >
                    Generate Activation Key
                  </Button>

                  <SaveTemplatePopover saveTemplate={saveTemplate} />
                </div>

                <div className="mt-3">
                  <SigningStatus status={status} onRevert={revertEdits} />
                </div>

                {jwt && (
                  <div className="ak-output space-y-2">
                    {isDirty && (
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Outdated: generate to update
                      </span>
                    )}
                    <div className="relative">
                      <div
                        className={cn("ak-output-text", isDirty && "opacity-50")}
                        data-stale={isDirty}
                      >
                        {jwt}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ak-copy-button"
                        aria-label="Copy activation key"
                        disabled={isDirty}
                        title={
                          isDirty
                            ? "Generate the key first: it does not include your edits"
                            : undefined
                        }
                        onClick={() => copyToClipboard(jwt)}
                      >
                        {showCopied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ActivationKeyEditor;
