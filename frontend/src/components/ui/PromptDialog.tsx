/**
 * PromptDialog — reusable single-text-input modal built on Radix Dialog.
 *
 * IMPORTANT: Always use this component instead of window.prompt() when asking
 * the user for a short text value (e.g. renaming or naming a copy). Never use
 * the browser's native prompt() — it blocks the JS thread, can't be styled,
 * and is inconsistent across browsers.
 *
 * Usage (controlled):
 *   const [open, setOpen] = useState(false);
 *   <PromptDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Duplicate template"
 *     label="New template name"
 *     defaultValue={`${template.name} Copy`}
 *     confirmLabel="Duplicate"
 *     onSubmit={(value) => handleDuplicate(value)}
 *   />
 */

import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label = 'Name',
  placeholder,
  defaultValue = '',
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  onSubmit,
}: PromptDialogProps) {
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="prompt-dialog-input">{label}</Label>
          <Input
            id="prompt-dialog-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{cancelLabel}</Button>
          <Button onClick={handleSubmit} disabled={!value.trim()}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDialog;
