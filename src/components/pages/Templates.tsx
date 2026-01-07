import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Plus, Pencil, Trash2, Copy, Check, AlertCircle, ExternalLink, FileText, Info } from 'lucide-react';
import { useTemplates, AkTemplate } from '../../hooks/use-templates';
import { useToast } from '../../hooks/use-toast';
import { getJwtMetadata, validateActivationKeyFormat, AkValidationResult } from '../../utils/activationKey';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Key for storing template to load in editor
export const PENDING_TEMPLATE_KEY = 'pendingTemplateId';

const EMPTY_TEMPLATE: Omit<AkTemplate, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  activationKey: '',
};

interface ValidationState {
  error: AkValidationResult | null;
  touched: boolean;
}

const Templates = () => {
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { success, error: showError, confirm } = useToast();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Omit<AkTemplate, 'id' | 'createdAt'>>(EMPTY_TEMPLATE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<AkTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newAkValidation, setNewAkValidation] = useState<ValidationState>({ error: null, touched: false });
  const [editAkValidation, setEditAkValidation] = useState<ValidationState>({ error: null, touched: false });

  const resetNewTemplate = () => {
    setNewTemplate(EMPTY_TEMPLATE);
    setNewAkValidation({ error: null, touched: false });
    setIsAddingNew(false);
  };

  const validateTemplate = (template: Omit<AkTemplate, 'id' | 'createdAt'>): { nameError: string | null; akValidation: AkValidationResult | null } => {
    const nameError = !template.name.trim() ? 'Name is required' : null;
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
        showError(`${akValidation.message}${akValidation.details ? `: ${akValidation.details}` : ''}`);
      }
      return;
    }

    try {
      addTemplate({
        name: newTemplate.name.trim(),
        description: newTemplate.description?.trim(),
        activationKey: newTemplate.activationKey.trim(),
      });
      success('Template created');
      resetNewTemplate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error saving template');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Delete this template?');
    if (confirmed) {
      deleteTemplate(id);
      success('Template deleted');
    }
  };

  const handleEdit = (template: AkTemplate) => {
    if (editingId === template.id) {
      setEditingId(null);
      setEditingTemplate(null);
      setEditAkValidation({ error: null, touched: false });
    } else {
      setEditingId(template.id);
      setEditingTemplate(template);
      setEditAkValidation({ error: null, touched: false });
    }
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
        showError(`${akValidation.message}${akValidation.details ? `: ${akValidation.details}` : ''}`);
      }
      return;
    }

    updateTemplate(editingTemplate.id, {
      name: editingTemplate.name.trim(),
      description: editingTemplate.description?.trim(),
      activationKey: editingTemplate.activationKey.trim(),
    });
    success('Template updated');
    setEditingId(null);
    setEditingTemplate(null);
    setEditAkValidation({ error: null, touched: false });
  };

  const copyToClipboard = async (activationKey: string, id: string) => {
    await navigator.clipboard.writeText(activationKey);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTemplateMetadata = (activationKey: string) => {
    const metadata = getJwtMetadata(activationKey);
    if (!metadata) return { algorithm: 'Invalid', expiryText: '', isExpired: false };

    const isExpired = metadata.expiresAt ? metadata.expiresAt < new Date() : false;
    const expiryText = metadata.expiresAt
      ? metadata.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No expiry';

    return {
      algorithm: metadata.algorithm || 'Unknown',
      expiryText,
      isExpired,
    };
  };

  const loadInEditor = (templateId: string) => {
    localStorage.setItem(PENDING_TEMPLATE_KEY, templateId);
    navigate('/');
  };

  const renderValidationError = (validation: ValidationState) => {
    if (!validation.touched || !validation.error || validation.error.isValid) return null;
    return (
      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-destructive">{validation.error.message}</p>
          {validation.error.details && (
            <p className="text-destructive/70 mt-0.5 text-xs">{validation.error.details}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="text-muted-foreground mt-1">
              Reusable activation key configurations
            </p>
          </div>
          <Button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Add New Template Form */}
        {isAddingNew && (
          <Card className="mb-6 border-primary/20">
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Enterprise License"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    id="description"
                    value={newTemplate.description || ''}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Standard enterprise template"
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
                      setNewAkValidation({ error: validateActivationKeyFormat(e.target.value), touched: true });
                    }
                  }}
                  onBlur={() => {
                    if (newTemplate.activationKey.trim()) {
                      setNewAkValidation({ error: validateActivationKeyFormat(newTemplate.activationKey), touched: true });
                    }
                  }}
                  placeholder="Paste activation key..."
                  className={`font-mono text-xs h-24 resize-none ${newAkValidation.touched && newAkValidation.error && !newAkValidation.error.isValid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                {renderValidationError(newAkValidation)}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={resetNewTemplate}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Create Template
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates List */}
        {templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => {
              const meta = getTemplateMetadata(template.activationKey);
              const isEditing = editingId === template.id;

              return (
                <Card key={template.id} className={isEditing ? 'ring-1 ring-primary/30' : ''}>
                  <CardContent className="p-4">
                    {isEditing ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-name-${template.id}`}>Name</Label>
                            <Input
                              id={`edit-name-${template.id}`}
                              value={editingTemplate?.name || ''}
                              onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                              autoFocus
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-description-${template.id}`}>Description</Label>
                            <Input
                              id={`edit-description-${template.id}`}
                              value={editingTemplate?.description || ''}
                              onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, description: e.target.value } : null)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`edit-ak-${template.id}`}>Activation Key</Label>
                          <Textarea
                            id={`edit-ak-${template.id}`}
                            value={editingTemplate?.activationKey || ''}
                            onChange={(e) => {
                              setEditingTemplate(prev => prev ? { ...prev, activationKey: e.target.value } : null);
                              if (editAkValidation.touched) {
                                setEditAkValidation({ error: validateActivationKeyFormat(e.target.value), touched: true });
                              }
                            }}
                            onBlur={() => {
                              if (editingTemplate?.activationKey.trim()) {
                                setEditAkValidation({ error: validateActivationKeyFormat(editingTemplate.activationKey), touched: true });
                              }
                            }}
                            className={`font-mono text-xs h-24 resize-none ${editAkValidation.touched && editAkValidation.error && !editAkValidation.error.isValid ? 'border-destructive' : ''}`}
                          />
                          {renderValidationError(editAkValidation)}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditingTemplate(null);
                                setEditAkValidation({ error: null, touched: false });
                              }}
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleUpdateTemplate}>
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{template.name}</h3>
                            {!meta.isExpired && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">
                                    <Info className="h-3 w-3" />
                                    Active
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[200px]">This template contains a non-expired key. Consider using expired keys for safety.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate mt-0.5">
                            {template.description || (
                              <span className="font-mono text-xs">
                                {meta.algorithm} · {meta.isExpired ? 'Expired' : 'Expires'} {meta.expiryText}
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
                                onClick={() => loadInEditor(template.id)}
                              >
                                <ExternalLink className="h-4 w-4" />
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
                                onClick={() => copyToClipboard(template.activationKey, template.id)}
                              >
                                {copiedId === template.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy to Clipboard</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEdit(template)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          // Empty State
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create templates for quick access to your activation key configurations.
            </p>
            <Button onClick={() => setIsAddingNew(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first template
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Templates;
