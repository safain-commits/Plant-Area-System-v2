'use client';
import { Button } from '@plant/ui';
export function PrintButton() {
  return (
    <Button
      className="primary"
      onClick={async () => {
        await document.fonts?.ready;
        window.print();
      }}
    >
      Cetak bukti
    </Button>
  );
}
