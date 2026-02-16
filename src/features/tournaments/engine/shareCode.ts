// Uppercase alphanumeric, excluding ambiguous characters: 0/O, 1/I/L
export const SHARE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShareCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SHARE_CODE_CHARS[Math.floor(Math.random() * SHARE_CODE_CHARS.length)];
  }
  return code;
}
