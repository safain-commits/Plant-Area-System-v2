'use client';
import { Button } from '@plant/ui';
export function PrintButton() {
  return (
    <Button className="primary" onClick={() => window.print()}>
      Cetak bukti
    </Button>
  );
}
