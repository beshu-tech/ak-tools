import { Link } from "react-router-dom";
import { Check, ChevronDown, Circle, Plus } from "lucide-react";
import type { AkTemplate } from "../../hooks/use-templates";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface TemplateSwitcherProps {
  templates: AkTemplate[];
  /** Template the current key was loaded from, if any. */
  sourceTemplateId: string | null;
  /** The editor holds changes that switching would discard. */
  isDirty: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitch: (templateId: string) => void;
}

export function TemplateSwitcher({
  templates,
  sourceTemplateId,
  isDirty,
  open,
  onOpenChange,
  onSwitch,
}: TemplateSwitcherProps) {
  const currentTemplateName = templates.find((t) => t.id === sourceTemplateId)?.name;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex-1 justify-between h-10">
          <span className="truncate">{currentTemplateName || "No template"}</span>
          <div className="flex items-center gap-1.5">
            {isDirty && <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />}
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
                onClick={() => onSwitch(template.id)}
                className={`w-full px-3 py-2 text-left hover:bg-secondary/50 transition-colors ${
                  template.id === sourceTemplateId ? "bg-secondary/30" : ""
                }`}
              >
                <div className="text-sm font-medium flex items-center gap-2">
                  {template.name}
                  {template.id === sourceTemplateId && <Check className="h-3 w-3 text-primary" />}
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
  );
}
