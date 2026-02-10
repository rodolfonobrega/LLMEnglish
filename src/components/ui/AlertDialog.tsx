import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { cn } from '../../utils/cn';
import { Button } from './Button';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
}: AlertDialogProps) {
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop
          className="fixed inset-0 z-(--z-modal) bg-black/60 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150"
        />
        <BaseAlertDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-(--z-modal) -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-sm rounded-2xl bg-card p-6 border border-edge',
            'shadow-[var(--shadow-lg)]',
            'focus-visible:outline-none',
            'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
            'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
            'transition-[opacity,transform] duration-150',
          )}
        >
          <BaseAlertDialog.Title className="text-lg font-bold text-ink text-balance">
            {title}
          </BaseAlertDialog.Title>
          <BaseAlertDialog.Description className="text-sm text-ink-muted text-pretty mt-2">
            {description}
          </BaseAlertDialog.Description>
          <div className="flex justify-end gap-3 mt-6">
            <BaseAlertDialog.Close
              className={cn(
                'inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors',
                'bg-card-warm text-ink-secondary hover:bg-card-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
              )}
            >
              {cancelLabel}
            </BaseAlertDialog.Close>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}
