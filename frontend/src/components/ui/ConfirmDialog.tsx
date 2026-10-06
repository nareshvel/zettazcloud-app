/**
 * ConfirmDialog — reusable confirmation modal built on Radix AlertDialog.
 *
 * IMPORTANT: Always use this component instead of window.confirm() for any
 * destructive action or user confirmation in this codebase. Never use the
 * browser's native confirm() dialog — it blocks the JS thread, can't be styled,
 * and is inconsistent across browsers.
 *
 * Usage (controlled):
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Delete customer?"
 *     description="This action cannot be undone."
 *     confirmLabel="Delete"
 *     variant="destructive"
 *     onConfirm={handleDelete}
 *   />
 *
 * Usage (inline trigger):
 *   <ConfirmDialog
 *     trigger={<Button variant="destructive">Delete</Button>}
 *     title="Delete customer?"
 *     description="This action cannot be undone."
 *     onConfirm={handleDelete}
 *   />
 */

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  /** Controlled open state. If provided, also provide onOpenChange. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** Optional trigger element (uncontrolled mode). */
  trigger?: React.ReactNode;

  /** Dialog title — short imperative phrase, e.g. "Delete customer?" */
  title: string;

  /** Supporting description with consequences. */
  description?: string;

  /** Label for the confirm button. Default: "Confirm" */
  confirmLabel?: string;

  /** Label for the cancel button. Default: "Cancel" */
  cancelLabel?: string;

  /** "destructive" renders the confirm button in red. Default: "default" */
  variant?: 'default' | 'destructive';

  /** Called when the user clicks confirm. */
  onConfirm: () => void;

  /** Called when the user clicks cancel (optional). */
  onCancel?: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const content = (
    <AlertDialogContent className="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && (
          <AlertDialogDescription>{description}</AlertDialogDescription>
        )}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          className={cn(
            variant === 'destructive' &&
              'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
          )}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );

  if (trigger) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        {content}
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {content}
    </AlertDialog>
  );
}

export default ConfirmDialog;
