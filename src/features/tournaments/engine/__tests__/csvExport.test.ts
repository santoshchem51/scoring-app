import { describe, it, expect } from 'vitest';
import { registrationsToCsv, sanitizeCsvValue } from '../csvExport';

describe('sanitizeCsvValue', () => {
  it('prefixes = with single quote', () => {
    expect(sanitizeCsvValue('=CMD()')).toBe("'=CMD()");
  });
  it('prefixes + with single quote', () => {
    expect(sanitizeCsvValue('+1234')).toBe("'+1234");
  });
  it('prefixes - with single quote', () => {
    expect(sanitizeCsvValue('-test')).toBe("'-test");
  });
  it('prefixes @ with single quote', () => {
    expect(sanitizeCsvValue('@import')).toBe("'@import");
  });
  it('preserves normal values', () => {
    expect(sanitizeCsvValue('John Smith')).toBe('John Smith');
  });
  it('preserves names with internal dashes', () => {
    expect(sanitizeCsvValue('Li-Wei')).toBe('Li-Wei');
  });
  it('preserves email with @ in middle', () => {
    expect(sanitizeCsvValue('john@email.com')).toBe('john@email.com');
  });
  it('handles empty string', () => {
    expect(sanitizeCsvValue('')).toBe('');
  });
  it('handles null/undefined', () => {
    expect(sanitizeCsvValue(null as unknown as string)).toBe('');
    expect(sanitizeCsvValue(undefined as unknown as string)).toBe('');
  });
});

describe('registrationsToCsv', () => {
  it('generates CSV with header and data rows', () => {
    const regs = [
      { playerName: 'Alice', email: 'alice@test.com', skillRating: 3.5, status: 'confirmed', teamId: 'team-1', paymentStatus: 'paid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Email,Skill Rating,Status,Team,Payment Status,Registered At');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('alice@test.com');
  });

  it('escapes commas with double quotes', () => {
    const regs = [
      { playerName: 'Smith, John', email: '', skillRating: null, status: 'confirmed', teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain('"Smith, John"');
  });

  it('escapes double quotes in values', () => {
    const regs = [
      { playerName: 'The "Great" One', email: '', skillRating: null, status: 'confirmed', teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain('"The ""Great"" One"');
  });

  it('handles empty array', () => {
    expect(registrationsToCsv([])).toBe('Name,Email,Skill Rating,Status,Team,Payment Status,Registered At');
  });

  it('sanitizes formula triggers', () => {
    const regs = [
      { playerName: '=EVIL()', email: '', skillRating: null, status: 'confirmed', teamId: null, paymentStatus: 'unpaid', registeredAt: 1709942400000 },
    ];
    const csv = registrationsToCsv(regs);
    expect(csv).toContain("'=EVIL()");
  });
});
