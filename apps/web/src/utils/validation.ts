/**
 * Enterprise Validation Utilities for Phone Numbers and Email Addresses
 * Digital Guru Franchise Operating System
 */

// RFC 5322 standard email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates whether the given string is a valid email address.
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Filters out illegal characters from phone input as the user types,
 * only allowing digits, leading '+', spaces, and hyphens.
 */
export function sanitizePhoneInput(input: string): string {
  if (!input) return '';
  // Remove all characters except digits, plus, spaces, and hyphens
  const cleaned = input.replace(/[^\d+\s-]/g, '');
  // Ensure '+' can only appear at index 0
  const hasLeadingPlus = cleaned.startsWith('+');
  const digitsAndSpaces = cleaned.replace(/\+/g, '');
  return hasLeadingPlus ? `+${digitsAndSpaces}` : digitsAndSpaces;
}

/**
 * Validates whether the given string is a valid phone number.
 * Supports:
 * - 10-digit Indian numbers (starting with 6, 7, 8, 9)
 * - With +91, 91, or 0 prefix
 * - Standard international numbers with country codes (10 to 15 digits)
 */
export function isValidPhone(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  
  // Must not contain letters or illegal symbols
  if (/[a-zA-Z]/.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, '');

  // Total digits must be between 10 and 15
  if (digits.length < 10 || digits.length > 15) {
    return false;
  }

  // If 10 digits, must start with 6, 7, 8, 9
  if (digits.length === 10) {
    return /^[6-9]\d{9}$/.test(digits);
  }

  // If 11 digits starting with 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) {
    return /^[6-9]\d{9}$/.test(digits.slice(1));
  }

  // If 12 digits starting with 91 (e.g. 919876543210 or +91 9876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(digits.slice(2));
  }

  // International format: 10 to 15 digits
  return /^[1-9]\d{9,14}$/.test(digits);
}

/**
 * Returns detailed validation message for phone fields.
 */
export function getPhoneValidationError(phone?: string | null, required = false): string | null {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    return required ? 'Phone number is required.' : null;
  }
  if (/[a-zA-Z]/.test(trimmed)) {
    return 'Phone number cannot contain letters.';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) {
    return `Phone number is too short (${digits.length}/10 digits).`;
  }
  if (digits.length > 15) {
    return `Phone number cannot exceed 15 digits (${digits.length}/15).`;
  }
  if (digits.length === 10 && !/^[6-9]/.test(digits)) {
    return '10-digit mobile number must start with 6, 7, 8, or 9.';
  }
  if (!isValidPhone(trimmed)) {
    return 'Please enter a valid phone number (e.g. 9876543210 or +91 9876543210).';
  }
  return null;
}

/**
 * Returns detailed validation message for email fields.
 */
export function getEmailValidationError(email?: string | null, required = false): string | null {
  const trimmed = (email || '').trim();
  if (!trimmed) {
    return required ? 'Email address is required.' : null;
  }
  if (!isValidEmail(trimmed)) {
    return 'Please enter a valid email address (e.g. user@example.com).';
  }
  return null;
}

