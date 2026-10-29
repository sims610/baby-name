import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { addUser, verifyUser, createSession, getUserByToken, deleteSession } from '../database/database.ts';
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

export { authRouter, setAuthUser, authenticateToken };
