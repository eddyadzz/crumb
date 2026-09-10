'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toCsvString } from '@/lib/csv';

/** Trigger a client-side CSV download — no server round-trip. */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const blob = new Blob([toCsvString(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({
  filename,
  header,
  rows,
  label,
}: {
  filename: string;
  header: string[];
  rows: unknown[][];
  label?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => downloadCsv(filename, header, rows)}
    >
      <Download className="h-3.5 w-3.5" />
      {label ?? 'Export'}
    </Button>
  );
}
