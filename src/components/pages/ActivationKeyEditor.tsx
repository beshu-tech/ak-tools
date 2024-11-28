import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Textarea } from '../ui/textarea';
import Editor from "@monaco-editor/react";
import { Button } from '../ui/button';
import { X, Check, Copy } from 'lucide-react';
import { Algorithm, SUPPORTED_ALGORITHMS, KeyPair } from '../../types/activationKey';
import { decodeJWT, getJwtMetadata, signJWT, validateJWTSignature, ValidationResult } from '../../utils/activationKey';
import { ActivationKeyMetadataDisplay } from '../activationkey/ActivationKeyMetadata';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PageHeader } from '../ui/page-header';
import { ValidationStatus } from '../activationkey/validation-status';
import './ActivationKeyEditor.css';
import { useTheme } from '../../hooks/use-theme';

const ActivationKeyEditor = () => {
  const { theme } = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [jwt, setJwt] = useState('');
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [showCopied, setShowCopied] = useState(false);
  const [algorithm, setAlgorithm] = useState<Algorithm>('ES512');
  const [editorValue, setEditorValue] = useState('{}');
  const [signatureValidation, setSignatureValidation] = useState<ValidationResult | null>(null);

  const exampleJwt = "eyJhbGciOiJFUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjg4MDYxMjEyODAwLCJpc3MiOiJodHRwczovL2FwaS5iZXNodS50ZWNoIiwiaWF0IjoxNjYxMzU2MTAxLCJqdGkiOiJhbmFwaG9yYV9saWNfMjViMmFhYTgtMTQwMS00YjhmLThkMGYtNmMzMTdmOWJhNjcwIiwiYXVkIjoiQW5hcGhvcmEiLCJzdWIiOiIxMTExMTExMS0xMTExLTExMTEtMTExMS0xMTExMTExMSIsImxpY2Vuc29yIjp7Im5hbWUiOiJBbmFwaG9yYSIsImNvbnRhY3QiOlsic3VwcG9ydEByZWFkb25seXJlc3QuY29tIiwiZmluYW5jZUByZWFkb25seXJlc3QuY29tIl0sImlzc3VlciI6InN1cHBvcnRAcmVhZG9ubHlyZXN0LmNvbSJ9LCJsaWNlbnNlZSI6eyJuYW1lIjoiQW5vbnltb3VzIEZyZWUgVXNlciIsImJ1eWluZ19mb3IiOm51bGwsImJpbGxpbmdfZW1haWwiOiJ1bmtub3duQGFuYXBob3JhLmNvbSIsImFsdF9lbWFpbHMiOltdLCJhZGRyZXNzIjpbIlVua25vd24iXX0sImxpY2Vuc2UiOnsiY2x1c3Rlcl91dWlkIjoiKiIsImVkaXRpb24iOiJmcmVlIiwiZWRpdGlvbl9uYW1lIjoiRnJlZSIsImlzVHJpYWwiOmZhbHNlfX0.ATAB81zkWRxTdpSD_23tcFxba81OCrjdtcGlx_yXwa2VSvJAx7rWQYO2VM2N8zeknA01SzYpPP2o_FXzP3TCEo4iABRof2G1u0iD1AFf5Y0m_TYPs89acR5Fztb46wSBwsj4L1ONal0y8xHYfJC54SKwdXJV4XTJwIP2tBVcTl9QNAfn"
  useEffect(() => {
    const savedKeys = localStorage.getItem('keyPairs');
    if (savedKeys) {
      const keys = JSON.parse(savedKeys);
      setKeyPairs(keys);
      if (keys.length > 0 && !selectedKeyId) {
        setSelectedKeyId(keys[0].id);
      }
    }
  }, [selectedKeyId]);

  const handleInputChange = async (value: string) => {
    setInputValue(value);

    if (!value) {
      clearJwt();
      return;
    }

    if (!selectedKeyId && keyPairs.length > 0) {
      setSelectedKeyId(keyPairs[0].id);
    }

    // Try to parse as JWT
    const metadata = getJwtMetadata(value);
    if (metadata) {
      if (metadata.algorithm && SUPPORTED_ALGORITHMS.includes(metadata.algorithm as Algorithm)) {
        setAlgorithm(metadata.algorithm as Algorithm);
      }
      if (metadata.expiresAt) {
        setExpiryDate(new Date(metadata.expiresAt));
      }
    }

    const decoded = await decodeJWT(value);
    try {
      const parsedDecoded = JSON.parse(decoded);
      const payloadOnly = JSON.stringify(parsedDecoded.payload || {}, null, 2);
      setEditorValue(payloadOnly);
    } catch (e) {
      setEditorValue('{}');
    }
    setJwt(value);

    try {
      // Only validate against the selected key pair
      const selectedKey = keyPairs.find(k => k.id === selectedKeyId);
      const validation = await validateJWTSignature(value, selectedKey);
      setSignatureValidation(validation);
    } catch (error) {
      setSignatureValidation({
        isValid: false,
        error: "Invalid signature",
      });
    }
  };

  // Also update validation when the selected key changes
  useEffect(() => {
    if (jwt && selectedKeyId) {
      const selectedKey = keyPairs.find(k => k.id === selectedKeyId);
      validateJWTSignature(jwt, selectedKey).then(setSignatureValidation);
    }
  }, [selectedKeyId, jwt]);

  const clearJwt = () => {
    setInputValue('');
    setJwt('');
    setSignatureValidation(null);
    if (keyPairs.length > 0) {
      setSelectedKeyId(keyPairs[0].id);
    } else {
      setSelectedKeyId('');
    }
  };

  const handleSign = async () => {
    try {
      const selectedKey = keyPairs.find(k => k.id === selectedKeyId);
      if (!selectedKey) return;

      let payload;
      try {
        // Parse the editor value directly as the payload
        payload = JSON.parse(editorValue);
      } catch (e) {
        alert('Invalid JSON payload');
        return;
      }

      // Only override exp if a new expiry date is selected
      if (expiryDate) {
        payload.exp = Math.floor(expiryDate.getTime() / 1000);
      }

      const newToken = await signJWT(
        payload,
        algorithm,
        selectedKey,
        // Use the expiry date from the payload if no new date is selected
        expiryDate || (payload.exp ? new Date(payload.exp * 1000) : new Date())
      );

      setJwt(newToken);
      const newDecoded = await decodeJWT(newToken);
      // Extract just the payload object for the editor
      try {
        const parsedDecoded = JSON.parse(newDecoded);
        const payloadOnly = JSON.stringify(parsedDecoded.payload || {}, null, 2);
        setEditorValue(payloadOnly);
      } catch (e) {
        setEditorValue('{}');
      }
    } catch (error) {
      console.error('Signing error:', error);
      alert('Failed to sign JWT');
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  return (
    <div className="ak-editor-container">
      <PageHeader
        title="Activation Key Editor"
        description="Create, decode, and validate Activation Keys"
      />

      {!jwt ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Paste your Activation Key here"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            className="ak-input"
          />
          <button
            onClick={() => handleInputChange(exampleJwt)}
            className="ak-example-link"
          >
            Use example
          </button>
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
                  key={`monaco-${jwt}`}
                  defaultLanguage="json"
                  value={editorValue}
                  onChange={(value) => setEditorValue(value || '{}')}
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
                  <ValidationStatus validation={signatureValidation} />
                  
                  <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
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
                    onExpiryChange={setExpiryDate}
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
