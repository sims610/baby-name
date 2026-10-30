const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns an error message for an invalid email address, or undefined if it's fine. */
export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) {
    return "Please enter your email address.";
  }
  if (!EMAIL_PATTERN.test(value)) {
    return "Please enter a valid email address.";
  }
  return undefined;
}

// The password rule for new passwords. The server enforces the same rule
// (server/src/passwordPolicy.ts); checking here just gives faster feedback.
const MIN_PASSWORD_LENGTH = 8;
const PASSPHRASE_LENGTH = 12;

export const PASSWORD_HINT = `Use an uppercase letter, a lowercase letter, and a number, or more than ${PASSPHRASE_LENGTH} characters.`;

/**
 * Returns an error message for an unacceptable new password, or undefined if it's fine.
 * A password passes if it mixes character types (upper, lower, digit) or is long
 * enough to be a passphrase, where length alone provides the strength.
 */
export function validateNewPassword(password: string, emptyMessage = "Please create a password."): string | undefined {
  if (!password) {
    return emptyMessage;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const isPassphrase = password.length > PASSPHRASE_LENGTH;
  const isMixed = /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
  return isPassphrase || isMixed ? undefined : PASSWORD_HINT;
}

/** Returns an error message unless the confirmation matches the password. */
export function validateConfirmPassword(confirmation: string, password: string): string | undefined {
  if (!confirmation) {
    return "Please confirm your password.";
  }
  return confirmation === password ? undefined : "Passwords do not match.";
}

export const NETWORK_ERROR_MESSAGE = "Unable to reach the server. Check your connection and try again.";
