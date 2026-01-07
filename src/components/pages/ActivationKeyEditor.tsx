import { useReducer, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import Editor from "@monaco-editor/react";
import { Button } from '../ui/button';
import { X, Check, Copy, FileText, Plus } from 'lucide-react';
import { Algorithm, SUPPORTED_ALGORITHMS } from '../../types/activationKey';
import { decodeJWT, getJwtMetadata, signJWT, validateJWTSignature, ValidationResult } from '../../utils/activationKey';
import { ActivationKeyMetadataDisplay } from '../activationkey/ActivationKeyMetadata';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { PageHeader } from '../ui/page-header';
import { ValidationStatus } from '../activationkey/validation-status';
import { useTheme } from '../../hooks/use-theme';
import { useKeyPairs } from '../../hooks/use-key-pairs';
import { useTemplates } from '../../hooks/use-templates';
import { useToast } from '../../hooks/use-toast';
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
  const { templates } = useTemplates();
  const { error: showError } = useToast();
  const [state, dispatch] = useReducer(editorReducer, initialState);

  const { inputValue, jwt, editorValue, algorithm, expiryDate, issuedDate, selectedKeyId, validation, showCopied } = state;

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
      showError('Failed to sign JWT');
    }
  }, [selectedKeyId, editorValue, expiryDate, issuedDate, algorithm, getKeyPairById, showError]);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    dispatch({ type: 'SHOW_COPIED' });
    setTimeout(() => dispatch({ type: 'HIDE_COPIED' }), 2000);
  }, []);

  const clearJwt = useCallback(() => {
    dispatch({ type: 'CLEAR' });
    if (keyPairs.length > 0) {
      dispatch({ type: 'SET_SELECTED_KEY', payload: keyPairs[0].id });
    }
  }, [keyPairs]);

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
                        onClick={() => handleInputChange(template.jwt)}
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
                <div className="ak-header-row">
                  <ValidationStatus validation={validation} />

                  <Select
                    value={selectedKeyId}
                    onValueChange={(value) => dispatch({ type: 'SET_SELECTED_KEY', payload: value })}
                  >
                    <SelectTrigger className="ak-key-select">
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

                {getJwtMetadata(jwt) && (
                  <ActivationKeyMetadataDisplay
                    metadata={getJwtMetadata(jwt)!}
                    expiryDate={expiryDate}
                    onExpiryChange={(date) => dispatch({ type: 'SET_EXPIRY_DATE', payload: date })}
                    issuedDate={issuedDate}
                    onIssuedChange={(date) => dispatch({ type: 'SET_ISSUED_DATE', payload: date })}
                  />
                )}

                <div className="ak-controls">
                  <Button
                    onClick={handleSign}
                    disabled={!selectedKeyId || !editorValue}
                    className="sign-button"
                  >
                    Generate Activation Key
                  </Button>
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
