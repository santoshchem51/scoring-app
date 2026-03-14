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

export function registrationsToCsv(registrations: Array<Record<string, unknown>>): string {
  const headers = ['Name', 'Email', 'Skill Rating', 'Status', 'Team', 'Payment Status', 'Registered At'];
  const rows = registrations.map((r) => [
    escapeCsv(sanitizeCsvValue(String(r.playerName ?? ''))),
    escapeCsv(sanitizeCsvValue(String(r.email ?? ''))),
    r.skillRating != null ? String(r.skillRating) : '',
    String(r.status ?? ''),
    String(r.teamId ?? ''),
    String(r.paymentStatus ?? ''),
    r.registeredAt ? new Date(r.registeredAt as number).toISOString() : '',
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
