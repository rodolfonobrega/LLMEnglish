import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { cn } from '../../utils/cn';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop
          className="fixed inset-0 z-(--z-modal) bg-black/60 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-opacity duration-150"
        />
        <BaseDialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-(--z-modal) -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-lg rounded-2xl bg-card p-6 border border-edge',
            'shadow-[var(--shadow-lg)]',
            'focus-visible:outline-none',
            'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
            'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
            'transition-[opacity,transform] duration-150',
          )}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

Dialog.Title = function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Title className={cn('text-lg font-bold text-ink text-balance', className)}>
      {children}
    </BaseDialog.Title>
  );
};

Dialog.Description = function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseDialog.Description className={cn('text-sm text-ink-muted text-pretty mt-1', className)}>
      {children}
    </BaseDialog.Description>
  );
};

Dialog.Close = BaseDialog.Close;
