import type { TournamentRegistration } from '../../../data/types';

export function sanitizeCsvValue(value: string | null | undefined): string {
  if (!value) return '';
  if (/^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Sanitize and escape a value for CSV output. Non-string values are stringified first. */
function safeCsvCell(value: unknown): string {
  const str = value != null ? String(value) : '';
  return escapeCsv(sanitizeCsvValue(str));
}

/** Registration with possible extra fields (e.g. email) from Firestore docs */
type CsvRegistration = TournamentRegistration & Record<string, unknown>;

// NOTE: CSV export includes email/PII. This is admin-only functionality
// (gated by hasMinRole check on dashboard). No redaction needed.
export function registrationsToCsv(registrations: CsvRegistration[]): string {
  const headers = ['Name', 'Email', 'Skill Rating', 'Status', 'Team', 'Payment Status', 'Registered At'];
  const rows = registrations.map((r) => [
    safeCsvCell(r.playerName),
    safeCsvCell(r.email),
    r.skillRating != null ? String(r.skillRating) : '',
    safeCsvCell(r.status),
    safeCsvCell(r.teamId),
    safeCsvCell(r.paymentStatus),
    r.registeredAt ? new Date(r.registeredAt).toISOString() : '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
