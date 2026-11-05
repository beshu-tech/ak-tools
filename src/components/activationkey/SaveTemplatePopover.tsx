import { AlertTriangle, Save } from "lucide-react";
import type { SaveTemplateState } from "../../hooks/use-save-template";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export function SaveTemplatePopover({ saveTemplate: s }: { saveTemplate: SaveTemplateState }) {
  return (
    <Popover open={s.open} onOpenChange={s.setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={s.openDialog}>
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

          {s.showExpiryWarning && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <div className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Notice:</strong> This activation key is not expired. For safety reasons,
                  templates should contain expired keys only.
                </div>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="checkbox"
                  id="save-as-expired"
                  checked={s.saveAsExpired}
                  onChange={(e) => s.setSaveAsExpired(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-yellow-600 text-yellow-600 focus:ring-yellow-500"
                />
                <label
                  htmlFor="save-as-expired"
                  className="text-xs text-yellow-800 dark:text-yellow-200 cursor-pointer"
                >
                  Save as expired (set expiry to 24h ago)
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-name" className="text-sm">
              Name *
            </Label>
            <Input
              id="template-name"
              value={s.name}
              onChange={(e) => s.setName(e.target.value)}
              placeholder="e.g., ReadonlyREST Enterprise"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description" className="text-sm">
              Description (optional)
            </Label>
            <Input
              id="template-description"
              value={s.description}
              onChange={(e) => s.setDescription(e.target.value)}
              placeholder="e.g., Template for enterprise licenses"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => s.setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={s.save}>
              {s.isUpdate ? "Update Template" : "Save Template"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
