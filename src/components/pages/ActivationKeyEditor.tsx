import { useReducer, useEffect, useCallback, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import Editor from "@monaco-editor/react";
import { Button } from '../ui/button';
import { X, Check, Copy, FileText, Plus, Save, AlertTriangle, Key, ChevronDown, Circle } from 'lucide-react';
import { Algorithm, SUPPORTED_ALGORITHMS } from '../../types/activationKey';
import { decodeJWT, getJwtMetadata, signJWT, validateJWTSignature, ValidationResult } from '../../utils/activationKey';
import { ActivationKeyMetadataDisplay } from '../activationkey/ActivationKeyMetadata';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { PageHeader } from '../ui/page-header';
import { useTheme } from '../../hooks/use-theme';
import { useKeyPairs } from '../../hooks/use-key-pairs';
import { useTemplates } from '../../hooks/use-templates';
import { useToast } from '../../hooks/use-toast';
import { PENDING_TEMPLATE_KEY } from './Templates';
import './ActivationKeyEditor.css';

// State type for the editor
interface EditorState {
  inputValue: string;
  jwt: string;
  editorValue: string;
  algorithm: Algorithm;
  expiryDate: Date | undefined;
  issuedDate: Date | undefined;
  selectedKeyId: string;
  validation: ValidationResult | null;
  showCopied: boolean;
}

// Action types for the reducer
type EditorAction =
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_JWT'; payload: { jwt: string; editorValue: string; algorithm?: Algorithm; expiryDate?: Date; issuedDate?: Date } }
  | { type: 'SET_EDITOR_VALUE'; payload: string }
  | { type: 'SET_ALGORITHM'; payload: Algorithm }
  | { type: 'SET_EXPIRY_DATE'; payload: Date | undefined }
  | { type: 'SET_ISSUED_DATE'; payload: Date | undefined }
  | { type: 'SET_SELECTED_KEY'; payload: string }
  | { type: 'SET_VALIDATION'; payload: ValidationResult | null }
  | { type: 'SHOW_COPIED' }
  | { type: 'HIDE_COPIED' }
  | { type: 'CLEAR' };

const initialState: EditorState = {
  inputValue: '',
  jwt: '',
  editorValue: '{}',
  algorithm: 'ES512',
  expiryDate: undefined,
  issuedDate: undefined,
  selectedKeyId: '',
  validation: null,
  showCopied: false,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, inputValue: action.payload };
    case 'SET_JWT':
      return {
        ...state,
        jwt: action.payload.jwt,
        editorValue: action.payload.editorValue,
        algorithm: action.payload.algorithm ?? state.algorithm,
        expiryDate: action.payload.expiryDate ?? state.expiryDate,
        issuedDate: action.payload.issuedDate ?? state.issuedDate,
      };
    case 'SET_EDITOR_VALUE':
      return { ...state, editorValue: action.payload };
    case 'SET_ALGORITHM':
      return { ...state, algorithm: action.payload };
    case 'SET_EXPIRY_DATE':
      return { ...state, expiryDate: action.payload };
    case 'SET_ISSUED_DATE':
      return { ...state, issuedDate: action.payload };
    case 'SET_SELECTED_KEY':
      return { ...state, selectedKeyId: action.payload };
    case 'SET_VALIDATION':
      return { ...state, validation: action.payload };
    case 'SHOW_COPIED':
      return { ...state, showCopied: true };
    case 'HIDE_COPIED':
      return { ...state, showCopied: false };
    case 'CLEAR':
      return { ...initialState, selectedKeyId: state.selectedKeyId };
    default:
      return state;
  }
}

const ActivationKeyEditor = () => {
  const { theme } = useTheme();
  const { keyPairs, getKeyPairById } = useKeyPairs();
  const { templates, addTemplate, updateTemplate, getTemplateById } = useTemplates();
  const { error: showError, success: showSuccess, confirm } = useToast();
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Track source template (when loaded from a template)
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);

  // Track original editor value for dirty detection
  const originalEditorValueRef = useRef<string>('{}');

  // Template switcher state
  const [templateSwitcherOpen, setTemplateSwitcherOpen] = useState(false);

  // Save as template state
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [saveAsExpired, setSaveAsExpired] = useState(false);

  const { inputValue, jwt, editorValue, algorithm, expiryDate, issuedDate, selectedKeyId, validation, showCopied } = state;

  // Compute dirty state after state destructuring
  const isDirty = editorValue !== originalEditorValueRef.current && jwt !== '';

  // Check if current JWT is expired
  const isJwtExpired = useCallback(() => {
    if (!jwt) return false;
    const metadata = getJwtMetadata(jwt);
    if (!metadata?.expiresAt) return false;
    return metadata.expiresAt < new Date();
  }, [jwt]);

  // Set initial selected key when keyPairs load
  useEffect(() => {
    if (keyPairs.length > 0 && !selectedKeyId) {
      dispatch({ type: 'SET_SELECTED_KEY', payload: keyPairs[0].id });
    }
  }, [keyPairs, selectedKeyId]);

  // Validate JWT when selected key changes
  useEffect(() => {
    if (jwt && selectedKeyId) {
      const selectedKey = getKeyPairById(selectedKeyId);
      validateJWTSignature(jwt, selectedKey).then(result => {
        dispatch({ type: 'SET_VALIDATION', payload: result });
      });
    }
  }, [selectedKeyId, jwt, getKeyPairById]);

  const handleInputChange = useCallback(async (value: string) => {
    dispatch({ type: 'SET_INPUT', payload: value });

    if (!value) {
      dispatch({ type: 'CLEAR' });
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

    const decoded = await decodeJWT(value);
    let payloadOnly = '{}';
    try {
      const parsedDecoded = JSON.parse(decoded);
      payloadOnly = JSON.stringify(parsedDecoded.payload || {}, null, 2);
    } catch {
      // Keep default empty object
    }

    dispatch({
      type: 'SET_JWT',
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
      dispatch({ type: 'SET_VALIDATION', payload: validationResult });
    } catch {
      dispatch({
        type: 'SET_VALIDATION',
        payload: { isValid: false, error: 'Invalid signature' },
      });
    }
  }, [selectedKeyId, getKeyPairById]);

  // Check for pending template to load when templates are available
  useEffect(() => {
    const pendingTemplateId = localStorage.getItem(PENDING_TEMPLATE_KEY);
    if (pendingTemplateId && templates.length > 0) {
      const template = getTemplateById(pendingTemplateId);
      if (template) {
        localStorage.removeItem(PENDING_TEMPLATE_KEY);
        setSourceTemplateId(template.id);
        handleInputChange(template.activationKey);
      }
    }
  }, [templates, getTemplateById, handleInputChange]);

  const handleSign = useCallback(async () => {
    const selectedKey = getKeyPairById(selectedKeyId);
    if (!selectedKey) return;

    let payload;
    try {
      payload = JSON.parse(editorValue);
    } catch {
      showError('Invalid JSON payload');
      return;
    }

    // Only override exp if a new expiry date is selected
    if (expiryDate) {
      payload.exp = Math.floor(expiryDate.getTime() / 1000);
    }

    // Only override iat if a new issued date is selected
    if (issuedDate) {
      payload.iat = Math.floor(issuedDate.getTime() / 1000);
    }

    try {
      const newToken = await signJWT(
        payload,
        algorithm,
        selectedKey,
        expiryDate || (payload.exp ? new Date(payload.exp * 1000) : new Date())
      );

      const newDecoded = await decodeJWT(newToken);
      let payloadOnly = '{}';
      try {
        const parsedDecoded = JSON.parse(newDecoded);
        payloadOnly = JSON.stringify(parsedDecoded.payload || {}, null, 2);
      } catch {
        // Keep default
      }

      dispatch({
        type: 'SET_JWT',
        payload: { jwt: newToken, editorValue: payloadOnly },
      });
    } catch (error) {
      console.error('Signing error:', error);
      showError('Failed to sign activation key');
    }
  }, [selectedKeyId, editorValue, expiryDate, issuedDate, algorithm, getKeyPairById, showError]);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    dispatch({ type: 'SHOW_COPIED' });
    setTimeout(() => dispatch({ type: 'HIDE_COPIED' }), 2000);
  }, []);

  const clearJwt = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    setSourceTemplateId(null);
    originalEditorValueRef.current = '{}';
    if (keyPairs.length > 0) {
      dispatch({ type: 'SET_SELECTED_KEY', payload: keyPairs[0].id });
    }
  }, [keyPairs]);

  // Handle template switching with dirty check
  const handleSwitchTemplate = useCallback(async (templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) return;

    // Check for unsaved changes
    if (isDirty) {
      const confirmed = await confirm(
        'You have unsaved changes. Switch template anyway?'
      );
      if (!confirmed) return;
    }

    setTemplateSwitcherOpen(false);
    setSourceTemplateId(template.id);
    handleInputChange(template.activationKey);
  }, [isDirty, confirm, getTemplateById, handleInputChange]);

  // Get current template name
  const currentTemplateName = sourceTemplateId
    ? getTemplateById(sourceTemplateId)?.name
    : null;

  // Handle opening save template popover
  const handleSaveTemplateClick = useCallback(() => {
    const notExpired = !isJwtExpired();
    setShowExpiryWarning(notExpired);
    setSaveAsExpired(notExpired); // Default to save as expired if not already expired
    setSaveTemplateOpen(true);

    // Pre-fill with source template info if loaded from a template
    if (sourceTemplateId) {
      const sourceTemplate = getTemplateById(sourceTemplateId);
      if (sourceTemplate) {
        setTemplateName(sourceTemplate.name);
        setTemplateDescription(sourceTemplate.description || '');
        return;
      }
    }

    setTemplateName('');
    setTemplateDescription('');
  }, [isJwtExpired, sourceTemplateId, getTemplateById]);

  // Find existing template by name
  const findTemplateByName = useCallback((name: string) => {
    return templates.find(t => t.name.toLowerCase() === name.toLowerCase());
  }, [templates]);

  // Generate activation key with modified expiry for template saving
  const getActivationKeyForTemplate = useCallback(async (): Promise<string | null> => {
    if (!saveAsExpired || isJwtExpired()) {
      return jwt; // Return current AK as-is
    }

    // Need to sign a new AK with expiry 24h before now
    const selectedKey = getKeyPairById(selectedKeyId);
    if (!selectedKey) {
      showError('No signing key selected');
      return null;
    }

    let payload;
    try {
      payload = JSON.parse(editorValue);
    } catch {
      showError('Invalid JSON payload');
      return null;
    }

    // Set expiry to 24 hours ago
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    payload.exp = Math.floor(expiredDate.getTime() / 1000);

    try {
      const expiredToken = await signJWT(payload, algorithm, selectedKey, expiredDate);
      return expiredToken;
    } catch (error) {
      console.error('Error generating expired AK:', error);
      showError('Failed to generate expired activation key');
      return null;
    }
  }, [saveAsExpired, isJwtExpired, jwt, selectedKeyId, editorValue, algorithm, getKeyPairById, showError]);

  // Handle saving template
  const handleSaveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      showError('Please enter a template name');
      return;
    }

    if (!jwt) {
      showError('No activation key to save');
      return;
    }

    const trimmedName = templateName.trim();
    const existingTemplate = findTemplateByName(trimmedName);
    const isOverwrite = existingTemplate && existingTemplate.id === sourceTemplateId;
    const isNameConflict = existingTemplate && existingTemplate.id !== sourceTemplateId;

    // If name conflicts with a different template, warn and ask
    if (isNameConflict) {
      const confirmed = await confirm(
        `A template named "${trimmedName}" already exists. Do you want to overwrite it?`
      );
      if (!confirmed) return;
    }

    // If overwriting source template, ask for confirmation
    if (isOverwrite) {
      const confirmed = await confirm(
        `Do you want to update the existing template "${trimmedName}"?`
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
        description: templateDescription.trim() || undefined,
        activationKey: activationKeyToSave,
      });
      showSuccess('Template updated successfully');
    } else {
      addTemplate({
        name: trimmedName,
        description: templateDescription.trim() || undefined,
        activationKey: activationKeyToSave,
      });
      showSuccess('Template saved successfully');
    }

    setSaveTemplateOpen(false);
    setTemplateName('');
    setTemplateDescription('');
    setShowExpiryWarning(false);
    setSaveAsExpired(false);
  }, [templateName, templateDescription, jwt, sourceTemplateId, findTemplateByName, getActivationKeyForTemplate, updateTemplate, addTemplate, showError, showSuccess, confirm]);

  return (
    <div className="ak-editor-container">
      <PageHeader
        title="Activation Key Editor"
        description="Create, decode, and validate Activation Keys"
      />

      {!jwt ? (
        <div className="space-y-3">
          <Textarea
            placeholder="Paste your Activation Key here"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="ak-input"
          />
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Use template
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="p-2 border-b">
                  <p className="text-sm font-medium">Select a template</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {templates.length > 0 ? (
                    templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSourceTemplateId(template.id);
                          handleInputChange(template.activationKey);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                      >
                        <div className="text-sm font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No templates yet
                    </div>
                  )}
                </div>
                <div className="p-2 border-t">
                  <Link to="/templates">
                    <Button variant="ghost" size="sm" className="w-full gap-2">
                      <Plus className="h-4 w-4" />
                      Manage templates
                    </Button>
                  </Link>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      ) : (
        <Card className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="ak-clear-button"
            onClick={clearJwt}
          >
            <X className="h-4 w-4" />
          </Button>
          <CardContent className="space-y-6 pt-6">
            <div className="ak-content-wrapper">
              <div className="ak-editor-monaco">
                <Editor
                  defaultLanguage="json"
                  value={editorValue}
                  onChange={(value) => dispatch({ type: 'SET_EDITOR_VALUE', payload: value || '{}' })}
                  options={{
                    minimap: { enabled: false },
                    formatOnPaste: true,
                    formatOnType: true,
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    fontSize: 12,
                    lineNumbers: 'off',
                    folding: false,
                    glyphMargin: false,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 0,
                    overviewRulerBorder: false,
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    scrollbar: {
                      vertical: 'auto',
                      horizontal: 'auto',
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                      alwaysConsumeMouseWheel: false
                    }
                  }}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
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
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        validation.isValid
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {validation.isValid ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </div>
                    )}
                    <Popover open={templateSwitcherOpen} onOpenChange={setTemplateSwitcherOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 justify-between h-10"
                        >
                          <span className="truncate">
                            {currentTemplateName || 'No template'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isDirty && (
                              <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
                            )}
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start">
                        <div className="p-2 border-b">
                          <p className="text-sm font-medium">Switch Template</p>
                          {isDirty && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              Unsaved changes will be lost
                            </p>
                          )}
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {templates.length > 0 ? (
                            templates.map((template) => (
                              <button
                                key={template.id}
                                onClick={() => handleSwitchTemplate(template.id)}
                                className={`w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors ${
                                  template.id === sourceTemplateId ? 'bg-secondary/30' : ''
                                }`}
                              >
                                <div className="text-sm font-medium flex items-center gap-2">
                                  {template.name}
                                  {template.id === sourceTemplateId && (
                                    <Check className="h-3 w-3 text-primary" />
                                  )}
                                </div>
                                {template.description && (
                                  <div className="text-xs text-muted-foreground truncate">
                                    {template.description}
                                  </div>
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                              No templates yet
                            </div>
                          )}
                        </div>
                        <div className="p-2 border-t">
                          <Link to="/templates">
                            <Button variant="ghost" size="sm" className="w-full gap-2">
                              <Plus className="h-4 w-4" />
                              Manage templates
                            </Button>
                          </Link>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Metadata Display */}
                {getJwtMetadata(jwt) && (
                  <ActivationKeyMetadataDisplay
                    metadata={getJwtMetadata(jwt)!}
                    expiryDate={expiryDate}
                    onExpiryChange={(date) => dispatch({ type: 'SET_EXPIRY_DATE', payload: date })}
                    issuedDate={issuedDate}
                    onIssuedChange={(date) => dispatch({ type: 'SET_ISSUED_DATE', payload: date })}
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
                    onValueChange={(value) => dispatch({ type: 'SET_SELECTED_KEY', payload: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a key for signing" />
                    </SelectTrigger>
                    <SelectContent>
                      {keyPairs.map((key) => (
                        <SelectItem key={key.id} value={key.id}>
                          {key.name} ({algorithm.startsWith('HS') ? 'Symmetric' : 'Asymmetric'})
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

                  <Popover open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleSaveTemplateClick}
                      >
                        <Save className="h-4 w-4" />
                        Save as template
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Save as Template</h4>
                          <p className="text-xs text-muted-foreground">
                            Save this activation key as a reusable template.
                          </p>
                        </div>

                        {showExpiryWarning && (
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md space-y-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                                <strong>Notice:</strong> This activation key is not expired.
                                For safety reasons, templates should contain expired keys only.
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pl-6">
                              <input
                                type="checkbox"
                                id="save-as-expired"
                                checked={saveAsExpired}
                                onChange={(e) => setSaveAsExpired(e.target.checked)}
                                className="h-4 w-4 rounded border-yellow-600 text-yellow-600 focus:ring-yellow-500"
                              />
                              <label htmlFor="save-as-expired" className="text-xs text-yellow-800 dark:text-yellow-200 cursor-pointer">
                                Save as expired (set expiry to 24h ago)
                              </label>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="template-name" className="text-sm">Name *</Label>
                          <Input
                            id="template-name"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., ReadonlyREST Enterprise"
                            autoFocus
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="template-description" className="text-sm">Description (optional)</Label>
                          <Input
                            id="template-description"
                            value={templateDescription}
                            onChange={(e) => setTemplateDescription(e.target.value)}
                            placeholder="e.g., Template for enterprise licenses"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSaveTemplateOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveTemplate}
                          >
                            {sourceTemplateId && findTemplateByName(templateName)?.id === sourceTemplateId
                              ? 'Update Template'
                              : 'Save Template'}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {jwt && (
                  <div className="ak-output">
                    <div className="ak-output-text">
                      {jwt}
                    </div>
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
