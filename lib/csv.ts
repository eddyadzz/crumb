/**
 * Minimal CSV serializer for data ownership exports. Pure — no server/DB
 * imports — so pages can build the download client-side.
 */

/** RFC 4180: quote fields containing commas, quotes, or newlines. */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsvString(
  headerRow: string[],
  rows: unknown[][],
): string {
  const lines = [
    headerRow.map((h) => escapeCell(h)).join(','),
    ...rows.map((r) => r.map((cell) => escapeCell(cell)).join(',')),
  ];
  // BOM + CRLF so Excel opens it cleanly with UTF-8 text intact.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
