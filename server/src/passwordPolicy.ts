// The password rule for new passwords. The client checks the same rule
// (client/src/components/form/validation.ts) so users see it before submitting;
// this is the check that can't be skipped.

const MIN_LENGTH = 8;
const PASSPHRASE_LENGTH = 12;
// bcrypt only reads the first 72 bytes of a password.
const MAX_BYTES = 72;

/** Returns why a new password isn't acceptable, or null if it's fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password) > MAX_BYTES) {
    return 'Password is too long.';
  }
  const isPassphrase = password.length > PASSPHRASE_LENGTH;
  const isMixed = /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
  if (!isPassphrase && !isMixed) {
    return `Use an uppercase letter, a lowercase letter, and a number, or more than ${PASSPHRASE_LENGTH} characters.`;
  }
  return null;
}
