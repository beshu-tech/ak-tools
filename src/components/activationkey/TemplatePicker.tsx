import { Link } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import type { AkTemplate } from "../../hooks/use-templates";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface TemplatePickerProps {
  templates: AkTemplate[];
  onPick: (template: AkTemplate) => void;
}

/** "Use template" popover shown while no key is loaded. */
export function TemplatePicker({ templates, onPick }: TemplatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText aria-hidden="true" className="h-4 w-4" />
          Use template
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" aria-label="Select a template">
        <div className="p-2 border-b">
          <p className="text-sm font-medium">Select a template</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {templates.length > 0 ? (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onPick(template)}
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
          <Button asChild variant="ghost" size="sm" className="w-full gap-2">
            <Link to="/templates">
              <Plus aria-hidden="true" className="h-4 w-4" />
              Manage templates
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
