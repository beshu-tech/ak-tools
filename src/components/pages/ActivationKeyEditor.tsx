import { useReducer, useEffect, useCallback, useState, useRef, useMemo } from "react";
import { Card, CardContent } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import Editor from "@monaco-editor/react";
import { Button } from "../ui/button";
import { X, Check, Copy, FileText, Key } from "lucide-react";
import { Algorithm, SUPPORTED_ALGORITHMS } from "../../types/activationKey";
import {
  getJwtMetadata,
  getPayloadJson,
  signJWT,
  toEpochSeconds,
  validateJWTSignature,
} from "../../utils/activationKey";
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
import { MONACO_OPTIONS } from "./monacoOptions";
import "./ActivationKeyEditor.css";

const ActivationKeyEditor = () => {
  const { resolvedTheme } = useTheme();
  const { keyPairs, getKeyPairById } = useKeyPairs();
  const { templates, addTemplate, updateTemplate, getTemplateById } = useTemplates();
  const { error: showError, confirm } = useToast();
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Track source template (when loaded from a template)
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);

  // Track original editor value for dirty detection
  const originalEditorValueRef = useRef<string>("{}");

  // Ref to store handleInputChange to avoid effect dependency issues
  const handleInputChangeRef = useRef<((value: string) => Promise<void>) | undefined>(undefined);

  // Template switcher state
  const [templateSwitcherOpen, setTemplateSwitcherOpen] = useState(false);

  const {
    inputValue,
    jwt,
    editorValue,
    algorithm,
    expiryDate,
    issuedDate,
    selectedKeyId,
    validation,
    showCopied,
  } = state;

  // Compute dirty state with useMemo to avoid unnecessary recalculations
  const isDirty = useMemo(() => {
    return editorValue !== originalEditorValueRef.current && jwt !== "";
  }, [editorValue, jwt]);

  // Check if current JWT is expired
  const jwtMetadata = useMemo(() => (jwt ? getJwtMetadata(jwt) : null), [jwt]);

  const isJwtExpired = useCallback(
    () => (jwtMetadata?.expiresAt ? jwtMetadata.expiresAt < new Date() : false),
    [jwtMetadata],
  );

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
      let newExpiryDate: Date | undefined;
      let newIssuedDate: Date | undefined;

      if (metadata) {
        if (metadata.algorithm && SUPPORTED_ALGORITHMS.includes(metadata.algorithm as Algorithm)) {
          newAlgorithm = metadata.algorithm as Algorithm;
        }
        if (metadata.expiresAt) {
          newExpiryDate = new Date(metadata.expiresAt);
        }
        if (metadata.issuedAt) {
          newIssuedDate = new Date(metadata.issuedAt);
        }
      }

      const payloadOnly = getPayloadJson(value);

      dispatch({
        type: "SET_JWT",
        payload: {
          jwt: value,
          editorValue: payloadOnly,
          algorithm: newAlgorithm,
          expiryDate: newExpiryDate,
          issuedDate: newIssuedDate,
        },
      });

      // Track original value for dirty detection
      originalEditorValueRef.current = payloadOnly;

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

    let payload;
    try {
      payload = JSON.parse(editorValue);
    } catch {
      showError("Invalid JSON payload");
      return;
    }

    // Only override exp if a new expiry date is selected
    if (expiryDate) {
      payload.exp = toEpochSeconds(expiryDate);
    }

    // Only override iat if a new issued date is selected
    if (issuedDate) {
      payload.iat = toEpochSeconds(issuedDate);
    }

    try {
      const newToken = await signJWT(
        payload,
        algorithm,
        selectedKey,
        expiryDate || (payload.exp ? new Date(payload.exp * 1000) : new Date()),
      );

      dispatch({
        type: "SET_JWT",
        payload: { jwt: newToken, editorValue: getPayloadJson(newToken) },
      });
    } catch (error) {
      console.error("Signing error:", error);
      showError("Failed to sign activation key");
    }
  }, [selectedKeyId, editorValue, expiryDate, issuedDate, algorithm, getKeyPairById, showError]);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    dispatch({ type: "SHOW_COPIED" });
    setTimeout(() => dispatch({ type: "HIDE_COPIED" }), 2000);
  }, []);

  const clearJwt = useCallback(() => {
    dispatch({ type: "CLEAR" });
    setSourceTemplateId(null);
    originalEditorValueRef.current = "{}";
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
              <p className="text-sm text-muted-foreground">
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
                  theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
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
                    {validation && (
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
                {jwtMetadata && (
                  <ActivationKeyMetadataDisplay
                    metadata={jwtMetadata}
                    expiryDate={expiryDate}
                    onExpiryChange={(date) => dispatch({ type: "SET_EXPIRY_DATE", payload: date })}
                    issuedDate={issuedDate}
                    onIssuedChange={(date) => dispatch({ type: "SET_ISSUED_DATE", payload: date })}
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
                    disabled={!selectedKeyId || !editorValue}
                    className="sign-button"
                  >
                    Generate Activation Key
                  </Button>

                  <SaveTemplatePopover saveTemplate={saveTemplate} />
                </div>

                {jwt && (
                  <div className="ak-output">
                    <div className="ak-output-text">{jwt}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ak-copy-button"
                      onClick={() => copyToClipboard(jwt)}
                    >
                      {showCopied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
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
