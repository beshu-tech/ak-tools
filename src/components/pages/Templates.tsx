import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Plus, ChevronDown, ChevronUp, Pencil, Trash2, Copy, Check } from 'lucide-react';
import { PageHeader } from '../ui/page-header';
import { useTemplates, JwtTemplate } from '../../hooks/use-templates';
import { useToast } from '../../hooks/use-toast';
import { getJwtMetadata } from '../../utils/activationKey';

const EMPTY_TEMPLATE: Omit<JwtTemplate, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  jwt: '',
};

const Templates = () => {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const { success, error: showError, confirm } = useToast();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Omit<JwtTemplate, 'id' | 'createdAt'>>(EMPTY_TEMPLATE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<JwtTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const resetNewTemplate = () => {
    setNewTemplate(EMPTY_TEMPLATE);
    setIsAddingNew(false);
  };

  const validateTemplate = (template: Omit<JwtTemplate, 'id' | 'createdAt'>): string | null => {
    if (!template.name.trim()) {
      return 'Name is required';
    }
    if (!template.jwt.trim()) {
      return 'JWT is required';
    }
    // Validate JWT format
    const metadata = getJwtMetadata(template.jwt.trim());
    if (!metadata) {
      return 'Invalid JWT format';
    }
    return null;
  };

  const handleSave = () => {
    const error = validateTemplate(newTemplate);
    if (error) {
      showError(error);
      return;
    }

    try {
      addTemplate({
        name: newTemplate.name.trim(),
        description: newTemplate.description?.trim(),
        jwt: newTemplate.jwt.trim(),
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

  const handleEdit = (template: JwtTemplate) => {
    if (editingId === template.id) {
      setEditingId(null);
      setEditingTemplate(null);
    } else {
      setEditingId(template.id);
      setEditingTemplate(template);
    }
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;

    const error = validateTemplate(editingTemplate);
    if (error) {
      showError(error);
      return;
    }

    updateTemplate(editingTemplate.id, {
      name: editingTemplate.name.trim(),
      description: editingTemplate.description?.trim(),
      jwt: editingTemplate.jwt.trim(),
    });
    success('Template updated');
    setEditingId(null);
    setEditingTemplate(null);
  };

  const copyToClipboard = async (jwt: string, id: string) => {
    await navigator.clipboard.writeText(jwt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTemplatePreview = (jwt: string): string => {
    const metadata = getJwtMetadata(jwt);
    if (!metadata) return 'Invalid JWT';
    return `${metadata.algorithm || 'Unknown'} • Expires: ${metadata.expiresAt?.toLocaleDateString() || 'Never'}`;
  };

  return (
    <div className="p-6">
      <PageHeader
        title="JWT Templates"
        description="Manage your activation key templates for quick access"
      />

      <div className="space-y-4 mt-6">
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
                <Label htmlFor="jwt">Activation Key (JWT)</Label>
                <Textarea
                  id="jwt"
                  value={newTemplate.jwt}
                  onChange={(e) => setNewTemplate({ ...newTemplate, jwt: e.target.value })}
                  placeholder="Paste your JWT here"
                  className="font-mono text-xs min-h-[100px]"
                />
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
                      <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description || getTemplatePreview(template.jwt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(template.jwt, template.id);
                      }}
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
                        <Label htmlFor={`edit-jwt-${template.id}`}>Activation Key (JWT)</Label>
                        <Textarea
                          id={`edit-jwt-${template.id}`}
                          value={editingTemplate?.jwt || ''}
                          onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, jwt: e.target.value } : null)}
                          className="font-mono text-xs min-h-[100px]"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditingTemplate(null);
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
                        {template.jwt}
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
