// Uppercase alphanumeric, excluding ambiguous characters: 0/O, 1/I/L
export const SHARE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 8): string {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SHARE_CODE_CHARS[values[i] % SHARE_CODE_CHARS.length];
  }
  return code;
}
