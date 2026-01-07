import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, Copy, Check, AlertTriangle, AlertCircle, ExternalLink } from 'lucide-react';
import { PageHeader } from '../ui/page-header';
import { useTemplates, AkTemplate } from '../../hooks/use-templates';
import { useToast } from '../../hooks/use-toast';
import { getJwtMetadata, validateActivationKeyFormat, AkValidationResult } from '../../utils/activationKey';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      success('Template created successfully');
      resetNewTemplate();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error saving template');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('Are you sure you want to delete this template?');
    if (confirmed) {
      deleteTemplate(id);
      success('Template deleted');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
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

  const getTemplatePreview = (activationKey: string): { text: string; isExpired: boolean } => {
    const metadata = getJwtMetadata(activationKey);
    if (!metadata) return { text: 'Invalid activation key', isExpired: false };
    const expired = isAkExpired(activationKey);
    const expiryText = metadata.expiresAt
      ? `${expired ? 'Expired' : 'Expires'}: ${metadata.expiresAt.toLocaleDateString()}`
      : 'No expiry';
    return {
      text: `${metadata.algorithm || 'Unknown'} • ${expiryText}`,
      isExpired: expired,
    };
  };

  // Check if an activation key is expired
  const isAkExpired = (activationKey: string): boolean => {
    const metadata = getJwtMetadata(activationKey);
    if (!metadata?.expiresAt) return false;
    return metadata.expiresAt < new Date();
  };

  // Load template in editor
  const loadInEditor = (templateId: string) => {
    localStorage.setItem(PENDING_TEMPLATE_KEY, templateId);
    navigate('/');
  };

  // Helper to render validation error
  const renderValidationError = (validation: ValidationState) => {
    if (!validation.touched || !validation.error || validation.error.isValid) return null;
    return (
      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-destructive">{validation.error.message}</p>
          {validation.error.details && (
            <p className="text-destructive/80 mt-1">{validation.error.details}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Activation Key Templates"
        description="Manage your activation key templates for quick access"
      />

      {/* Safety Information */}
      <div className="mt-4 mb-6 flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-200">Safety Notice</p>
          <p className="text-yellow-700 dark:text-yellow-300 mt-1">
            For security reasons, templates should only contain <strong>expired</strong> activation keys.
            This prevents accidental distribution of valid licenses. When you load a template,
            you can modify the expiry date and re-sign it with your keys to create a valid key.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew}
            size="icon"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isAddingNew && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g., ReadonlyREST Enterprise"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={newTemplate.description || ''}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="e.g., Template for enterprise licenses"
                />
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
                  placeholder="Paste your activation key here"
                  className={`font-mono text-xs min-h-[100px] ${newAkValidation.touched && newAkValidation.error && !newAkValidation.error.isValid ? 'border-destructive' : ''}`}
                />
                {renderValidationError(newAkValidation)}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetNewTemplate}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader
                className="relative cursor-pointer hover:bg-secondary/10 transition-colors px-6 py-4"
                onClick={() => toggleExpand(template.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="pointer-events-none p-0 hover:bg-transparent"
                    >
                      {expandedId === template.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                        {!getTemplatePreview(template.activationKey).isExpired && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                            Not Expired
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description || getTemplatePreview(template.activationKey).text}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadInEditor(template.id);
                      }}
                      title="Load in Editor"
                    >
                      <ExternalLink className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(template.activationKey, template.id);
                      }}
                      title="Copy to clipboard"
                    >
                      {copiedId === template.id ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </Button>
                    {editingId === template.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                        title="Delete template"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(template);
                      }}
                      title="Edit template"
                    >
                      <Pencil className={`h-5 w-5 ${editingId === template.id ? "text-primary" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(expandedId === template.id || editingId === template.id) && (
                <CardContent className="space-y-4 px-6 py-4">
                  {editingId === template.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`edit-name-${template.id}`}>Name</Label>
                        <Input
                          id={`edit-name-${template.id}`}
                          value={editingTemplate?.name || ''}
                          onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
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

                      <div className="space-y-2">
                        <Label htmlFor={`edit-activationKey-${template.id}`}>Activation Key</Label>
                        <Textarea
                          id={`edit-activationKey-${template.id}`}
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
                          className={`font-mono text-xs min-h-[100px] ${editAkValidation.touched && editAkValidation.error && !editAkValidation.error.isValid ? 'border-destructive' : ''}`}
                        />
                        {renderValidationError(editAkValidation)}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditingTemplate(null);
                            setEditAkValidation({ error: null, touched: false });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleUpdateTemplate}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Activation Key</Label>
                      <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
                        {template.activationKey}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}

          {templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No templates yet. Click the + button to create one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Templates;
