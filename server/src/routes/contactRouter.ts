import express from 'express';
import type { Request, Response } from 'express';
import { addContactMessage } from '../database/database.ts';

interface EndpointDoc {
  method: string;
  path: string;
  requiresAuth: boolean;
  description: string;
  example: string;
  response: unknown;
}

// Anyone can post here, so cap each field to keep the in-memory store from growing without bound.
const MAX_LENGTH = { name: 100, email: 254, phone: 30, message: 5000 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactRouter = Object.assign(express.Router(), {
  docs: [
    {
      method: 'POST',
      path: '/api/contact',
      requiresAuth: false,
      description: 'Send a message through the Contact form. Phone is optional.',
      example: `curl -X POST localhost:3000/api/contact -H 'Content-Type: application/json' -d '{"name":"Pat", "email":"pat@test.com", "message":"Love the app!"}'`,
      response: { message: 'message received' },
    },
  ] as EndpointDoc[],
});

function readField(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}

// send a contact message
contactRouter.post('/', (req: Request, res: Response) => {
  const body = req.body ?? {};
  const name = readField(body.name, MAX_LENGTH.name);
  const email = readField(body.email, MAX_LENGTH.email);
  const message = readField(body.message, MAX_LENGTH.message);
  // Phone is optional, so a missing or blank one is fine; anything else must be a valid field.
  const phoneBlank = body.phone === undefined || (typeof body.phone === 'string' && body.phone.trim() === '');
  const phone = phoneBlank ? undefined : readField(body.phone, MAX_LENGTH.phone);

  if (!name) {
    res.status(400).json({ message: `name is required (up to ${MAX_LENGTH.name} characters)` });
    return;
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    res.status(400).json({ message: 'a valid email is required' });
    return;
  }
  if (phone === null) {
    res.status(400).json({ message: `phone must be up to ${MAX_LENGTH.phone} characters` });
    return;
  }
  if (!message) {
    res.status(400).json({ message: `message is required (up to ${MAX_LENGTH.message} characters)` });
    return;
  }

  addContactMessage({ name, email, message, ...(phone ? { phone } : {}) }, req.user?.id);
  res.status(201).json({ message: 'message received' });
});

export { contactRouter };
