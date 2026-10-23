'use client';
import { createContext, useContext, useState, useRef } from 'react';
import { Overlay } from './overlay';
const Confirmation = createContext<(message: string) => Promise<boolean>>(async () => false);
export function ConfirmationProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState(''),
    resolve = useRef<((value: boolean) => void) | null>(null);
  const finish = (value: boolean) => {
    resolve.current?.(value);
    resolve.current = null;
    setMessage('');
  };
  return (
    <Confirmation.Provider
      value={(text) =>
        new Promise<boolean>((done) => {
          resolve.current?.(false);
          resolve.current = done;
          setMessage(text);
        })
      }
    >
      {children}
      <Overlay open={!!message} onClose={() => finish(false)} title="Konfirmasi perubahan">
        <p>{message}</p>
        <div className="form-actions">
          <button type="button" className="secondary" autoFocus onClick={() => finish(false)}>
            Batal
          </button>
          <button type="button" className="danger" onClick={() => finish(true)}>
            Lanjutkan
          </button>
        </div>
      </Overlay>
    </Confirmation.Provider>
  );
}
export const useConfirmation = () => useContext(Confirmation);
