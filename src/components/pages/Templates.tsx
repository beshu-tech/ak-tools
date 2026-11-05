import { useEffect, useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { PageHeader } from "../ui/page-header";
import { Label } from "../ui/label";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  FileText,
  Info,
} from "lucide-react";
import { useTemplates, AkTemplate } from "../../hooks/use-templates";
import { useToast } from "../../hooks/use-toast";
import { useConfirmedDelete } from "../../hooks/use-confirmed-delete";
import { useCrudState } from "../../hooks/use-crud-state";
import {
  getJwtMetadata,
  validateActivationKeyFormat,
  AkValidationResult,
} from "../../utils/activationKey";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

// Key for storing template to load in editor
export const PENDING_TEMPLATE_KEY = "pendingTemplateId";

const EMPTY_TEMPLATE: Omit<AkTemplate, "id" | "createdAt"> = {
  name: "",
  description: "",
  activationKey: "",
};

interface ValidationState {
  error: AkValidationResult | null;
  touched: boolean;
}

const Templates = () => {
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { success, error: showError } = useToast();

  const {
    isAddingNew,
    newItem: newTemplate,
    setNewItem: setNewTemplate,
    startAdding,
    resetNew,
    editingId,
    editingItem: editingTemplate,
    setEditingItem: setEditingTemplate,
    toggleEdit,
    cancelEditing,
  } = useCrudState<AkTemplate, Omit<AkTemplate, "id" | "createdAt">>({
    emptyItem: EMPTY_TEMPLATE,
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Focus targets. A handler asks for a focus move; it runs after the next render,
  // when the target exists (or is enabled again).
  const newButtonRef = useRef<HTMLButtonElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);
  const titleRefs = useRef(new Map<string, HTMLHeadingElement>());
  const editRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusRequest = useRef<(() => void) | null>(null);
  useEffect(() => {
    const run = focusRequest.current;
    focusRequest.current = null;
    run?.();
  });
  const trackRef =
    <E extends HTMLElement>(refs: RefObject<Map<string, E>>, id: string) =>
    (el: E | null) => {
      if (el) refs.current.set(id, el);
      else refs.current.delete(id);
    };
  const [newAkValidation, setNewAkValidation] = useState<ValidationState>({
    error: null,
    touched: false,
  });
  const [editAkValidation, setEditAkValidation] = useState<ValidationState>({
    error: null,
    touched: false,
  });

  const resetNewTemplate = () => {
    resetNew();
    setNewAkValidation({ error: null, touched: false });
    focusRequest.current = () => newButtonRef.current?.focus();
  };

  const validateTemplate = (
    template: Omit<AkTemplate, "id" | "createdAt">,
  ): { nameError: string | null; akValidation: AkValidationResult | null } => {
    const nameError = !template.name.trim() ? "Name is required" : null;
    const akValidation = validateActivationKeyFormat(template.activationKey);
    return { nameError, akValidation };
  };

  const handleSave = () => {
    const { nameError, akValidation } = validateTemplate(newTemplate);

    if (nameError) {
      showError(nameError);
      return;
    }

    if (!akValidation || !akValidation.isValid) {
      setNewAkValidation({ error: akValidation, touched: true });
      if (akValidation && !akValidation.isValid) {
        showError(
          `${akValidation.message}${akValidation.details ? `: ${akValidation.details}` : ""}`,
        );
      }
      return;
    }

    try {
      addTemplate({
        name: newTemplate.name.trim(),
        description: newTemplate.description?.trim(),
        activationKey: newTemplate.activationKey.trim(),
      });
      success("Template created");
      resetNewTemplate();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Error saving template");
    }
  };

  const handleCancelEditingState = () => {
    cancelEditing();
    setEditAkValidation({ error: null, touched: false });
  };

  // Runs only after the user confirms: move focus to the next template, else the previous, else the page controls.
  const removeTemplate = (id: string) => {
    const index = templates.findIndex((template) => template.id === id);
    const neighbor = templates[index + 1] ?? templates[index - 1];
    focusRequest.current = () => {
      const target = neighbor && titleRefs.current.get(neighbor.id);
      if (target) target.focus();
      else if (newButtonRef.current && !newButtonRef.current.disabled) newButtonRef.current.focus();
      else addFormRef.current?.querySelector<HTMLElement>("input, textarea")?.focus();
    };
    if (editingId === id) handleCancelEditingState();
    deleteTemplate(id);
  };

  const handleDelete = useConfirmedDelete(removeTemplate, {
    confirmMessage: "Delete this template?",
    successMessage: "Template deleted",
  });

  const handleToggleEdit = (template: AkTemplate) => {
    toggleEdit(template);
    setEditAkValidation({ error: null, touched: false });
  };

  // Closing the edit form sends focus back to the template's Edit button.
  const handleCancelEditing = (id: string) => {
    handleCancelEditingState();
    focusRequest.current = () => editRefs.current.get(id)?.focus();
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;

    const { nameError, akValidation } = validateTemplate(editingTemplate);

    if (nameError) {
      showError(nameError);
      return;
    }

    if (!akValidation || !akValidation.isValid) {
      setEditAkValidation({ error: akValidation, touched: true });
      if (akValidation && !akValidation.isValid) {
        showError(
          `${akValidation.message}${akValidation.details ? `: ${akValidation.details}` : ""}`,
        );
      }
      return;
    }

    updateTemplate(editingTemplate.id, {
      name: editingTemplate.name.trim(),
      description: editingTemplate.description?.trim(),
      activationKey: editingTemplate.activationKey.trim(),
    });
    success("Template updated");
    handleCancelEditing(editingTemplate.id);
  };

  const copyToClipboard = async (activationKey: string, id: string) => {
    await navigator.clipboard.writeText(activationKey);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTemplateMetadata = (activationKey: string) => {
    const metadata = getJwtMetadata(activationKey);
    if (!metadata) return { algorithm: "Invalid", expiryText: "", isExpired: false };

    const isExpired = metadata.expiresAt ? metadata.expiresAt < new Date() : false;
    const expiryText = metadata.expiresAt
      ? metadata.expiresAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "No expiry";

    return {
      algorithm: metadata.algorithm || "Unknown",
      expiryText,
      isExpired,
    };
  };

  const loadInEditor = (templateId: string) => {
    localStorage.setItem(PENDING_TEMPLATE_KEY, templateId);
    navigate("/");
  };

  const hasAkError = (validation: ValidationState) =>
    validation.touched && !!validation.error && !validation.error.isValid;

  const renderValidationError = (validation: ValidationState, id: string) => {
    const error = validation.touched ? validation.error : null;
    if (!error || error.isValid) return null;
    return (
      <div
        id={id}
        role="alert"
        className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
      >
        <AlertCircle
          className="h-4 w-4 text-red-700 dark:text-red-300 mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="text-sm">
          <p className="font-medium text-red-700 dark:text-red-300">{error.message}</p>
          {error.details && (
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">{error.details}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div>
        {/* Live region for the copy confirmation; it must exist before its text changes. */}
        <div role="status" className="sr-only">
          {copiedId
            ? `Activation key copied: ${templates.find((t) => t.id === copiedId)?.name ?? ""}`
            : ""}
        </div>
        <PageHeader
          title="Templates"
          description="Reusable activation key configurations"
          actions={
            <Button
              ref={newButtonRef}
              onClick={startAdding}
              disabled={isAddingNew}
              className="gap-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Template
            </Button>
          }
        />

        {/* Add New Template Form */}
        {isAddingNew && (
          <Card className="mb-6 border-primary/20">
            <CardContent ref={addFormRef} className="pt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Enterprise License"
                    required
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="description"
                    value={newTemplate.description || ""}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, description: e.target.value })
                    }
                    placeholder="Standard enterprise template"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activationKey">Activation Key</Label>
                <Textarea
                  id="activationKey"
                  value={newTemplate.activationKey}
                  onChange={(e) => {
                    setNewTemplate({ ...newTemplate, activationKey: e.target.value });
                    if (newAkValidation.touched) {
                      setNewAkValidation({
                        error: validateActivationKeyFormat(e.target.value),
                        touched: true,
                      });
                    }
                  }}
                  onBlur={() => {
                    if (newTemplate.activationKey.trim()) {
                      setNewAkValidation({
                        error: validateActivationKeyFormat(newTemplate.activationKey),
                        touched: true,
                      });
                    }
                  }}
                  placeholder="Paste activation key..."
                  required
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={hasAkError(newAkValidation) || undefined}
                  aria-describedby={hasAkError(newAkValidation) ? "new-ak-error" : undefined}
                  className={`font-mono text-xs h-24 resize-none ${hasAkError(newAkValidation) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {renderValidationError(newAkValidation, "new-ak-error")}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={resetNewTemplate}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>Create Template</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates List */}
        {templates.length > 0 ? (
          <ul aria-label="Templates" className="list-none space-y-3 p-0">
            {templates.map((template) => {
              const meta = getTemplateMetadata(template.activationKey);
              const isEditing = editingId === template.id;

              return (
                <li key={template.id}>
                  <Card className={isEditing ? "ring-1 ring-primary/30" : ""}>
                    <CardContent className="p-4">
                      {isEditing ? (
                        // Edit Mode
                        <div
                          role="group"
                          aria-label={`Edit template ${template.name}`}
                          className="space-y-4"
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-name-${template.id}`}>Name</Label>
                              <Input
                                id={`edit-name-${template.id}`}
                                value={editingTemplate?.name || ""}
                                onChange={(e) =>
                                  setEditingTemplate((prev) =>
                                    prev ? { ...prev, name: e.target.value } : null,
                                  )
                                }
                                required
                                autoComplete="off"
                                autoFocus
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-description-${template.id}`}>Description</Label>
                              <Input
                                id={`edit-description-${template.id}`}
                                autoComplete="off"
                                value={editingTemplate?.description || ""}
                                onChange={(e) =>
                                  setEditingTemplate((prev) =>
                                    prev ? { ...prev, description: e.target.value } : null,
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-ak-${template.id}`}>Activation Key</Label>
                            <Textarea
                              id={`edit-ak-${template.id}`}
                              value={editingTemplate?.activationKey || ""}
                              onChange={(e) => {
                                setEditingTemplate((prev) =>
                                  prev ? { ...prev, activationKey: e.target.value } : null,
                                );
                                if (editAkValidation.touched) {
                                  setEditAkValidation({
                                    error: validateActivationKeyFormat(e.target.value),
                                    touched: true,
                                  });
                                }
                              }}
                              onBlur={() => {
                                if (editingTemplate?.activationKey.trim()) {
                                  setEditAkValidation({
                                    error: validateActivationKeyFormat(
                                      editingTemplate.activationKey,
                                    ),
                                    touched: true,
                                  });
                                }
                              }}
                              required
                              autoComplete="off"
                              spellCheck={false}
                              aria-invalid={hasAkError(editAkValidation) || undefined}
                              aria-describedby={
                                hasAkError(editAkValidation)
                                  ? `edit-ak-error-${template.id}`
                                  : undefined
                              }
                              className={`font-mono text-xs h-24 resize-none ${hasAkError(editAkValidation) ? "border-destructive" : ""}`}
                            />
                            {renderValidationError(
                              editAkValidation,
                              `edit-ak-error-${template.id}`,
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-700 hover:bg-destructive/10 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                              aria-label={`Delete template ${template.name}`}
                              onClick={() => handleDelete(template.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
                              Delete
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => handleCancelEditing(template.id)}
                              >
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateTemplate}>Save Changes</Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h2
                                ref={trackRef(titleRefs, template.id)}
                                tabIndex={-1}
                                className="font-medium truncate focus-visible:outline-hidden"
                              >
                                {template.name}
                              </h2>
                              {!meta.isExpired && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex min-h-6 items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-300"
                                    >
                                      <Info className="h-3 w-3" aria-hidden="true" />
                                      Active
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs max-w-[200px]">
                                      This template contains a non-expired key. Consider using
                                      expired keys for safety.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {template.description || (
                                <span className="font-mono text-xs">
                                  {meta.algorithm} · {meta.isExpired ? "Expired" : "Expires"}{" "}
                                  {meta.expiryText}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Open template ${template.name} in the editor`}
                                  onClick={() => loadInEditor(template.id)}
                                >
                                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open in Editor</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Copy activation key of ${template.name}`}
                                  onClick={() =>
                                    copyToClipboard(template.activationKey, template.id)
                                  }
                                >
                                  {copiedId === template.id ? (
                                    <Check
                                      className="h-4 w-4 text-green-700 dark:text-green-400"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Copy className="h-4 w-4" aria-hidden="true" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy to Clipboard</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  ref={trackRef(editRefs, template.id)}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label={`Edit template ${template.name}`}
                                  onClick={() => handleToggleEdit(template)}
                                >
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        ) : (
          // Empty State
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <h2 className="font-medium mb-1">No templates yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create templates for quick access to your activation key configurations.
            </p>
            <Button onClick={startAdding} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create your first template
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Templates;
