import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRouter, setAuthUser } from './routes/authRouter.ts';
import { nameRouter } from './routes/nameRouter.ts';
import { contactRouter } from './routes/contactRouter.ts';
import { wikitreeRouter } from './routes/wikitreeRouter.ts';
import { partnerRouter } from './routes/partnerRouter.ts';
import { settingsRouter } from './routes/settingsRouter.ts';

interface HttpError extends Error {
  statusCode?: number;
  /** Set by Express's body parser on client errors whose message is safe to show. */
  expose?: boolean;
}

// Browsers may call the API only from these origins. In development the Vite
// proxy makes requests same-origin, so this matters for other setups.
// Set CLIENT_ORIGINS (comma-separated) to change it.
const ALLOWED_ORIGINS = new Set(
  (process.env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(setAuthUser);

const apiRouter = express.Router();
app.use('/api', apiRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/name', nameRouter);
apiRouter.use('/contact', contactRouter);
apiRouter.use('/wikitree', wikitreeRouter);
apiRouter.use('/partner', partnerRouter);
apiRouter.use('/settings', settingsRouter);

apiRouter.use('/docs', (req: Request, res: Response) => {
  res.json({
    endpoints: [
      ...authRouter.docs,
      ...nameRouter.docs,
      ...partnerRouter.docs,
      ...settingsRouter.docs,
      ...contactRouter.docs,
      ...wikitreeRouter.docs,
    ],
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'welcome to LittleRoots',
  });
});

// Express 5 no longer accepts '*' as a path, so a path-less handler catches everything unmatched.
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: 'unknown endpoint',
  });
});

// Default error handler. Details stay in the server log; clients get a safe message.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  const status = err.statusCode ?? 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ message: err.expose ? err.message : 'Something went wrong. Please try again.' });
});

export default app;
