'use client';
import { createContext, useContext, useState, useRef } from 'react';
import { Overlay } from './overlay';

export interface ConfirmationOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
}

export type ConfirmFunction = (text: string, options?: ConfirmationOptions) => Promise<boolean>;

const Confirmation = createContext<ConfirmFunction>(async () => false);

export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    message: string;
    title: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: 'primary' | 'danger';
  } | null>(null);
  const resolve = useRef<((value: boolean) => void) | null>(null);

  const finish = (value: boolean) => {
    resolve.current?.(value);
    resolve.current = null;
    setDialogState(null);
  };

  return (
    <Confirmation.Provider
      value={(text, options) =>
        new Promise<boolean>((done) => {
          resolve.current?.(false);
          resolve.current = done;
          setDialogState({
            message: text,
            title: options?.title || 'Konfirmasi perubahan',
            confirmLabel: options?.confirmLabel || 'Lanjutkan',
            cancelLabel: options?.cancelLabel || 'Batal',
            variant: options?.variant || 'danger',
          });
        })
      }
    >
      {children}
      <Overlay
        open={!!dialogState}
        onClose={() => finish(false)}
        title={dialogState?.title || 'Konfirmasi perubahan'}
      >
        <p>{dialogState?.message}</p>
        <div className="form-actions">
          <button type="button" className="secondary" autoFocus onClick={() => finish(false)}>
            {dialogState?.cancelLabel || 'Batal'}
          </button>
          <button type="button" className={dialogState?.variant || 'danger'} onClick={() => finish(true)}>
            {dialogState?.confirmLabel || 'Lanjutkan'}
          </button>
        </div>
      </Overlay>
    </Confirmation.Provider>
  );
}
export const useConfirmation = () => useContext(Confirmation);
