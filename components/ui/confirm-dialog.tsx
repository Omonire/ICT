'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from './button';
import { Dialog } from './dialog';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  loading,
  destructive,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={
            destructive
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50'
              : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50'
          }
        >
          <AlertTriangle className={destructive ? 'h-4.5 w-4.5 text-red-500' : 'h-4.5 w-4.5 text-amber-500'} />
        </div>
        <p className="text-[13px] leading-relaxed text-slate-600">{description}</p>
      </div>
    </Dialog>
  );
}
