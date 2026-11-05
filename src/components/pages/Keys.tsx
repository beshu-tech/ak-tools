import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Download,
  Upload,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { PageHeader } from "../ui/page-header";
import { KeyPair } from "../../types/activationKey";
import { KeyPairForm } from "../keys/key-pair-form";
import { clearChangedErrors } from "../keys/key-pair-errors";
import { KeyDisplay } from "../keys/key-display";
import {
  validateKeyPair,
  hasValidationErrors,
  getFirstError,
  type KeyPairValidationErrors,
} from "../../utils/validation";
import { generateEC512KeyPair } from "../../utils/activationKey";
import { exportKeyPairToZip, importKeyPairFromZip } from "../../utils/file-utils";
import { useKeyPairs } from "../../hooks/use-key-pairs";
import { useToast } from "../../hooks/use-toast";
import { useConfirmedDelete } from "../../hooks/use-confirmed-delete";
import { useCrudState } from "../../hooks/use-crud-state";
import "./Keys.css";

const EMPTY_KEY_PAIR: Omit<KeyPair, "id"> = {
  name: "",
  publicKey: "",
  privateKey: "",
  createdAt: "",
};

const Keys = () => {
  const { keyPairs, addKeyPair, updateKeyPair, deleteKeyPair } = useKeyPairs();
  const { success, error: showError } = useToast();

  const {
    isAddingNew,
    newItem: newKeyPair,
    setNewItem: setNewKeyPair,
    startAdding,
    resetNew: resetNewKeyPair,
    editingId,
    editingItem: editingKeyPair,
    setEditingItem: setEditingKeyPair,
    toggleEdit,
    cancelEditing,
  } = useCrudState<KeyPair, Omit<KeyPair, "id">>({
    emptyItem: EMPTY_KEY_PAIR,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSec1Info, setShowSec1Info] = useState(false);
  const [createErrors, setCreateErrors] = useState<KeyPairValidationErrors>({});
  const [editErrors, setEditErrors] = useState<KeyPairValidationErrors>({});
  const [createFailedSubmits, setCreateFailedSubmits] = useState(0);
  const [editFailedSubmits, setEditFailedSubmits] = useState(0);

  // Focus targets. A handler asks for a focus move; it runs after the next render,
  // when the target exists (or is enabled again).
  const importInputRef = useRef<HTMLInputElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);
  const toggleRefs = useRef(new Map<string, HTMLButtonElement>());
  const editRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusRequest = useRef<(() => void) | null>(null);
  useEffect(() => {
    const run = focusRequest.current;
    focusRequest.current = null;
    run?.();
  });
  const trackRef =
    (refs: React.RefObject<Map<string, HTMLButtonElement>>, id: string) =>
    (el: HTMLButtonElement | null) => {
      if (el) refs.current.set(id, el);
      else refs.current.delete(id);
    };
  const focusNewButton = () => newButtonRef.current?.focus();

  const closeCreateForm = () => {
    resetNewKeyPair();
    setCreateErrors({});
    focusRequest.current = focusNewButton;
  };
  const closeEditForm = (id: string) => {
    cancelEditing();
    setEditErrors({});
    focusRequest.current = () => editRefs.current.get(id)?.focus();
  };

  const handleSave = async () => {
    const trimmedKeyPair = {
      name: newKeyPair.name.trim(),
      publicKey: newKeyPair.publicKey.trim(),
      privateKey: newKeyPair.privateKey.trim(),
    };

    const errors = validateKeyPair(trimmedKeyPair);
    if (hasValidationErrors(errors)) {
      setCreateErrors(errors);
      setCreateFailedSubmits((n) => n + 1);
      showError(getFirstError(errors) ?? "Validation failed");
      return;
    }

    try {
      addKeyPair(trimmedKeyPair);
      success("Key pair created successfully");
      closeCreateForm();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error saving key pair");
    }
  };

  // Runs only after the user confirms: move focus to the next card, else the previous, else the page controls.
  const removeKeyPair = (id: string) => {
    const index = keyPairs.findIndex((pair) => pair.id === id);
    const neighbor = keyPairs[index + 1] ?? keyPairs[index - 1];
    focusRequest.current = () => {
      const target = neighbor && toggleRefs.current.get(neighbor.id);
      if (target) target.focus();
      else if (newButtonRef.current && !newButtonRef.current.disabled) newButtonRef.current.focus();
      else addFormRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
    };
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) cancelEditing();
    deleteKeyPair(id);
  };

  const handleDelete = useConfirmedDelete(removeKeyPair, {
    confirmMessage: "Are you sure you want to delete this key pair?",
    successMessage: "Key pair deleted",
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleUpdateKey = () => {
    if (!editingKeyPair) return;

    const trimmedKeyPair = {
      name: editingKeyPair.name.trim(),
      publicKey: editingKeyPair.publicKey.trim(),
      privateKey: editingKeyPair.privateKey.trim(),
    };

    const errors = validateKeyPair(trimmedKeyPair);
    if (hasValidationErrors(errors)) {
      setEditErrors(errors);
      setEditFailedSubmits((n) => n + 1);
      showError(getFirstError(errors) ?? "Validation failed");
      return;
    }

    updateKeyPair(editingKeyPair.id, trimmedKeyPair);
    success("Key pair updated");
    closeEditForm(editingKeyPair.id);
  };

  const handleGenerateKeys = async () => {
    try {
      const generatedPair = await generateEC512KeyPair();
      setNewKeyPair({
        name: generatedPair.name,
        publicKey: generatedPair.publicKey,
        privateKey: generatedPair.privateKey,
        createdAt: generatedPair.createdAt,
      });
      success("Keys generated successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error generating key pair");
    }
  };

  const handleExport = async (pair: KeyPair) => {
    try {
      await exportKeyPairToZip(pair);
      success(`Exported ${pair.name}.zip`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error exporting key pair");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedPair = await importKeyPairFromZip(file);
      setNewKeyPair({
        ...importedPair,
        createdAt: new Date().toISOString(),
      });
      startAdding();
      success("Key pair imported - review and save");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error importing key pair");
    }

    // Reset the input
    event.target.value = "";
  };

  return (
    <div>
      <PageHeader
        title="Keys Management"
        description="Manage your key pairs. All keys should be in PKCS#8 PEM format."
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".zip"
              onChange={handleImport}
              className="hidden"
              id="import-key"
              tabIndex={-1}
              aria-label="Key pair ZIP file"
            />
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Import key pair from ZIP"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Import
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="w-80">
                  <div className="space-y-2">
                    <p className="font-medium">Import Key Pair</p>
                    <div className="text-sm">
                      <p>Upload a ZIP file containing:</p>
                      <ul className="list-disc list-inside mt-1">
                        <li>public_key.pem</li>
                        <li>private_key.pem</li>
                      </ul>
                      <p>The key pair name will be taken from the ZIP filename.</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button ref={newButtonRef} onClick={startAdding} disabled={isAddingNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New key pair
            </Button>
          </>
        }
      />

      <div className="mt-2 mb-6 text-left">
        <button
          type="button"
          onClick={() => setShowSec1Info((prev) => !prev)}
          aria-expanded={showSec1Info}
          aria-controls="sec1-info"
          className="flex min-h-8 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <ChevronRight
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${showSec1Info ? "rotate-90" : ""}`}
          />
          <span className="font-medium">Converting SEC1 PEM to PKCS#8</span>
        </button>

        {showSec1Info && (
          <div id="sec1-info" className="mt-2 p-4 bg-secondary/10 rounded-lg text-sm">
            <p className="mb-2">
              If you have a SEC1 PEM key (starting with "BEGIN EC PRIVATE KEY"), you can convert it
              to PKCS#8 format using this command:
            </p>
            <pre className=" p-3 pr-12 bg-muted border rounded-md font-mono text-sm break-all">
              openssl pkcs8 -topk8 -nocrypt -in sec1_ec_private_key.pem -out pkcs8_private_key.pem
            </pre>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {isAddingNew && (
          <Card className="mb-6">
            <CardContent ref={addFormRef} className="pt-6 space-y-6">
              <KeyPairForm
                mode="create"
                keyPair={newKeyPair}
                errors={createErrors}
                failedSubmits={createFailedSubmits}
                onChange={(e) => {
                  setCreateErrors((prev) => clearChangedErrors(prev, newKeyPair, e));
                  setNewKeyPair(e as KeyPair);
                }}
                onSave={handleSave}
                onCancel={closeCreateForm}
                onGenerateKeys={handleGenerateKeys}
              />
            </CardContent>
          </Card>
        )}

        {keyPairs.length > 0 && (
          <TooltipProvider>
            <ul aria-label="Key pairs" className="list-none space-y-4 p-0">
              {keyPairs.map((pair) => {
                const isEditing = editingId === pair.id;
                const isOpen = expandedId === pair.id || isEditing;
                const panelId = `key-details-${pair.id}`;
                return (
                  <li key={pair.id}>
                    <Card>
                      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 px-4 py-3 sm:px-6">
                        <CardTitle as="h2" className="min-w-0 flex-1 text-xl leading-normal">
                          <button
                            type="button"
                            ref={trackRef(toggleRefs, pair.id)}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            disabled={isEditing}
                            onClick={() => toggleExpand(pair.id)}
                            className="flex min-h-10 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-secondary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                          >
                            {isOpen ? (
                              <ChevronUp className="h-5 w-5 shrink-0" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />
                            )}
                            <span className="truncate">{pair.name}</span>
                          </button>
                        </CardTitle>

                        <div className="flex shrink-0 gap-1">
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Export key pair ${pair.name}`}
                                onClick={() => handleExport(pair)}
                              >
                                <Download className="h-5 w-5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="w-80">
                              <div className="space-y-2">
                                <p className="font-medium">Export Key Pair</p>
                                <div className="text-sm">
                                  <p>Downloads '{pair.name}.zip' containing:</p>
                                  <ul className="list-disc list-inside mt-1">
                                    <li>public_key.pem</li>
                                    <li>private_key.pem</li>
                                  </ul>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          {isEditing && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete key pair ${pair.name}`}
                              onClick={() => handleDelete(pair.id)}
                            >
                              <Trash2 className="h-5 w-5" aria-hidden="true" />
                            </Button>
                          )}
                          <Button
                            ref={trackRef(editRefs, pair.id)}
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit key pair ${pair.name}`}
                            aria-pressed={isEditing}
                            onClick={() => {
                              setEditErrors({});
                              toggleEdit(pair);
                            }}
                          >
                            <Pencil
                              className={`h-5 w-5 ${isEditing ? "text-primary" : ""}`}
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      </CardHeader>
                      {isOpen && (
                        <CardContent id={panelId} className="space-y-4 px-6 py-4">
                          {isEditing ? (
                            <KeyPairForm
                              mode="edit"
                              keyPair={editingKeyPair || {}}
                              errors={editErrors}
                              failedSubmits={editFailedSubmits}
                              onChange={(e) => {
                                setEditErrors((prev) =>
                                  clearChangedErrors(prev, editingKeyPair ?? {}, e),
                                );
                                setEditingKeyPair((prev) => (prev ? { ...prev, ...e } : null));
                              }}
                              onSave={handleUpdateKey}
                              onCancel={() => closeEditForm(pair.id)}
                            />
                          ) : (
                            <>
                              <div className="mb-12">
                                <KeyDisplay
                                  label="Public Key (PEM)"
                                  kind="public"
                                  value={pair.publicKey}
                                />
                              </div>
                              <KeyDisplay
                                label="Private Key (PEM)"
                                kind="private"
                                value={pair.privateKey}
                              />
                            </>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};

export default Keys;
