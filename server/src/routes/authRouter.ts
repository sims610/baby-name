import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  addUser,
  verifyUser,
  createSession,
  getUserByToken,
  deleteSession,
  getUserByEmail,
  verifyPasswordById,
  setPassword,
  createPasswordResetToken,
  consumePasswordResetToken,
  isPasswordResetTokenValid,
  PASSWORD_RESET_TTL_MS,
} from '../database/database.ts';
import { appUrl, passwordChangedEmail, passwordResetEmail, sendEmail } from '../email.ts';
import { passwordProblem } from '../passwordPolicy.ts';
import type { User } from 'shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

const authRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'POST',
      path: '/api/auth',
      requiresAuth: false,
      description: 'Register a new user',
      example: `curl -X POST localhost:3000/api/auth -H 'Content-Type: application/json' -d '{"name":"Pat", "email":"pat@test.com", "password":"secret"}'`,
      response: { user: { id: '…', name: 'Pat', email: 'pat@test.com' }, token: 'abc123' },
    },
    {
      method: 'PUT',
      path: '/api/auth',
      requiresAuth: false,
      description: 'Login existing user',
      example: `curl -X PUT localhost:3000/api/auth -H 'Content-Type: application/json' -d '{"email":"pat@test.com", "password":"secret"}'`,
      response: { user: { id: '…', name: 'Pat', email: 'pat@test.com' }, token: 'abc123' },
    },
    {
      method: 'DELETE',
      path: '/api/auth',
      requiresAuth: true,
      description: 'Logout a user',
      example: `curl -X DELETE localhost:3000/api/auth -H 'Authorization: Bearer abc123'`,
      response: { message: 'logout successful' },
    },
    {
      method: 'POST',
      path: '/api/auth/forgot-password',
      requiresAuth: false,
      description:
        'Email a one-time password reset link. Always answers the same way, so it never reveals whether an email has an account.',
      example: `curl -X POST localhost:3000/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"pat@test.com"}'`,
      response: { message: 'If an account exists for that email, a reset link is on its way.' },
    },
    {
      method: 'POST',
      path: '/api/auth/reset-password/verify',
      requiresAuth: false,
      description:
        'Check whether a reset link can still be used (not used, replaced, or expired) without using it up. The token goes in the body so it stays out of server logs.',
      example: `curl -X POST localhost:3000/api/auth/reset-password/verify -H 'Content-Type: application/json' -d '{"token":"abc123"}'`,
      response: { valid: true },
    },
    {
      method: 'POST',
      path: '/api/auth/reset-password',
      requiresAuth: false,
      description: 'Set a new password using the token from a reset link. Signs the account out everywhere.',
      example: `curl -X POST localhost:3000/api/auth/reset-password -H 'Content-Type: application/json' -d '{"token":"abc123", "password":"NewPassword1"}'`,
      response: { message: 'Your password has been reset.' },
    },
    {
      method: 'PUT',
      path: '/api/auth/password',
      requiresAuth: true,
      description: 'Change your password. Signs you out on your other devices.',
      example: `curl -X PUT localhost:3000/api/auth/password -H 'Content-Type: application/json' -H 'Authorization: Bearer abc123' -d '{"currentPassword":"secret", "newPassword":"NewPassword1"}'`,
      response: { message: 'Your password has been changed.' },
    },
  ] as EndpointDoc[],
});

function readToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length).trim() || undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// bcrypt only reads the first 72 bytes of a password, so longer ones are rejected.
const MAX_LENGTH = { name: 100, email: 254, passwordBytes: 72 };

function tooLong(name: string | undefined, email: string, password: string): boolean {
  return (
    (name !== undefined && name.length > MAX_LENGTH.name) ||
    email.length > MAX_LENGTH.email ||
    Buffer.byteLength(password) > MAX_LENGTH.passwordBytes
  );
}

// Slows down password guessing: too many failed logins for one email from one
// address locks that pair out for a while. Kept in memory like everything else.
const MAX_FAILED_LOGINS = 10;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; resetAt: number }>(); // "ip|email" -> failures

function loginKey(req: Request, email: string): string {
  return `${req.ip}|${email.trim().toLowerCase()}`;
}

function isLockedOut(key: string): boolean {
  const entry = failedLogins.get(key);
  if (entry && entry.resetAt < Date.now()) {
    failedLogins.delete(key);
    return false;
  }
  return (entry?.count ?? 0) >= MAX_FAILED_LOGINS;
}

function recordFailedLogin(key: string): void {
  const entry = failedLogins.get(key) ?? { count: 0, resetAt: Date.now() + LOGIN_LOCKOUT_MS };
  entry.count += 1;
  failedLogins.set(key, entry);
}

// Attaches req.user and req.token when the request carries a valid session token.
function setAuthUser(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (token) {
    const user = getUserByToken(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
}

function authenticateToken(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: 'unauthorized' });
    return;
  }
  next();
}

// register
authRouter.post('/', async (req: Request, res: Response) => {
  const { name, email, password } = req.body ?? {};
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ message: 'name, email, and password are required' });
    return;
  }
  if (tooLong(name, email, password)) {
    res.status(400).json({ message: 'name, email, or password is too long' });
    return;
  }
  const user = await addUser(name.trim(), email, password);
  if (!user) {
    res.status(409).json({ message: 'email already registered' });
    return;
  }
  const token = createSession(user.id);
  res.status(201).json({ user, token });
});

// login
authRouter.put('/', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ message: 'email and password are required' });
    return;
  }
  if (tooLong(undefined, email, password)) {
    res.status(401).json({ message: 'invalid email or password' });
    return;
  }
  const key = loginKey(req, email);
  if (isLockedOut(key)) {
    res.status(429).json({ message: 'Too many failed attempts. Please wait 15 minutes and try again.' });
    return;
  }
  const user = await verifyUser(email, password);
  if (!user) {
    recordFailedLogin(key);
    res.status(401).json({ message: 'invalid email or password' });
    return;
  }
  failedLogins.delete(key);
  const token = createSession(user.id);
  res.json({ user, token });
});

// logout
authRouter.delete('/', authenticateToken, (req: Request, res: Response) => {
  deleteSession(req.token!);
  res.json({ message: 'logout successful' });
});

// ---- Passwords ----

// Stops the form being used to flood someone's inbox: at most this many reset
// emails per address in the window. Extra requests get the same reply but no email.
const MAX_RESET_EMAILS = 3;
const RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000;
const resetEmailsSent = new Map<string, { count: number; resetAt: number }>(); // email -> emails sent

function canSendResetEmail(email: string): boolean {
  const now = Date.now();
  const entry = resetEmailsSent.get(email);
  if (!entry || entry.resetAt < now) {
    resetEmailsSent.set(email, { count: 1, resetAt: now + RESET_EMAIL_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_RESET_EMAILS) {
    return false;
  }
  entry.count += 1;
  return true;
}

/** Sends without making the request wait, so the reply time doesn't hint whether the account exists. */
function sendInBackground(email: Parameters<typeof sendEmail>[0]): void {
  sendEmail(email).catch((error: unknown) => console.error('Could not send email:', error));
}

const FORGOT_PASSWORD_REPLY = { message: 'If an account exists for that email, a reset link is on its way.' };
const INVALID_RESET_LINK = {
  code: 'invalid_reset_link',
  message: 'This reset link is invalid or has expired. Please request a new one.',
};

// forgot password: email a reset link
authRouter.post('/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!isNonEmptyString(email) || email.length > MAX_LENGTH.email) {
    res.status(400).json({ message: 'a valid email is required' });
    return;
  }
  const user = getUserByEmail(email);
  if (user && canSendResetEmail(user.email)) {
    const token = createPasswordResetToken(user.id);
    const link = `${appUrl()}/reset-password?token=${token}`;
    sendInBackground(passwordResetEmail(user.email, user.name, link, PASSWORD_RESET_TTL_MS / 60_000));
  }
  // Same answer whether or not the account exists.
  res.status(202).json(FORGOT_PASSWORD_REPLY);
});

// check a reset link when the page opens, without using it up
authRouter.post('/reset-password/verify', (req: Request, res: Response) => {
  const { token } = req.body ?? {};
  if (!isNonEmptyString(token) || !isPasswordResetTokenValid(token)) {
    res.status(400).json(INVALID_RESET_LINK);
    return;
  }
  res.json({ valid: true });
});

// reset password: set a new one with the emailed token
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body ?? {};
  if (!isNonEmptyString(token) || !isNonEmptyString(password)) {
    res.status(400).json({ message: 'token and password are required' });
    return;
  }
  // Check the password before using up the token, so a weak password can be fixed and resubmitted.
  const problem = passwordProblem(password);
  if (problem) {
    res.status(400).json({ message: problem });
    return;
  }
  const userId = consumePasswordResetToken(token);
  if (!userId) {
    res.status(400).json(INVALID_RESET_LINK);
    return;
  }
  // Signs the account out everywhere: whoever had the old password is locked out.
  await setPassword(userId, password);
  res.json({ message: 'Your password has been reset.' });
});

// change password: signed-in users
authRouter.put('/password', authenticateToken, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!isNonEmptyString(currentPassword) || !isNonEmptyString(newPassword)) {
    res.status(400).json({ message: 'currentPassword and newPassword are required' });
    return;
  }
  const user = req.user!;
  if (Buffer.byteLength(currentPassword) > MAX_LENGTH.passwordBytes || !(await verifyPasswordById(user.id, currentPassword))) {
    res.status(403).json({ message: 'Your current password is incorrect.' });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ message: 'Choose a password different from your current one.' });
    return;
  }
  const problem = passwordProblem(newPassword);
  if (problem) {
    res.status(400).json({ message: problem });
    return;
  }
  await setPassword(user.id, newPassword, req.token);
  sendInBackground(passwordChangedEmail(user.email, user.name));
  res.json({ message: 'Your password has been changed.' });
});

export { authRouter, setAuthUser, authenticateToken };
