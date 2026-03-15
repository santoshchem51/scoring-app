// Uppercase alphanumeric, excluding ambiguous characters: 0/O, 1/I/L
export const SHARE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateShareCode(length = 8): string {
  const maxValid = Math.floor(256 / SHARE_CODE_CHARS.length) * SHARE_CODE_CHARS.length;
  const bytes = new Uint8Array(length * 2); // over-provision for rejections
  crypto.getRandomValues(bytes);

  let code = '';
  let i = 0;
  while (code.length < length) {
    if (i >= bytes.length) {
      crypto.getRandomValues(bytes);
      i = 0;
    }
    if (bytes[i] < maxValid) {
      code += SHARE_CODE_CHARS[bytes[i] % SHARE_CODE_CHARS.length];
    }
    i++;
  }
  return code;
}
