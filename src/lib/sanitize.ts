// Input sanitization utilities

export function sanitizeString(input: string | undefined | null, maxLength: number = 255): string {
  if (!input) return '';

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

export function sanitizeNumber(input: unknown, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number | null {
  const num = Number(input);
  if (isNaN(num) || num < min || num > max) {
    return null;
  }
  return num;
}

export function sanitizeEmail(input: string | undefined | null): string {
  if (!input) return '';

  const sanitized = sanitizeString(input, 254);
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

export function sanitizeUUID(input: string | undefined | null): string | null {
  if (!input) return null;

  const sanitized = sanitizeString(input, 36);
  // Basic UUID validation (allowing various formats)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sanitized) ? sanitized : null;
}
