import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { loadUser } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { branchesRouter } from './routes/branches.js';
import { usersRouter } from './routes/users.js';
import { registrationsRouter } from './routes/registrations.js';
import { membersRouter } from './routes/members.js';
import { eventsRouter } from './routes/events.js';
import { fundsRouter } from './routes/funds.js';
import { feesRouter } from './routes/fees.js';
import { notificationsRouter } from './routes/notifications.js';
import { postsRouter } from './routes/posts.js';
import { imagesRouter } from './routes/images.js';
import { historyRouter } from './routes/history.js';
import { batchesRouter } from './routes/batches.js';
import { exportsRouter } from './routes/exports.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

export function createApp() {
  const app = express();

  // Render runs the app behind a proxy; this makes rate limiting and secure cookies work.
  app.set('trust proxy', 1);

  const csp = helmet.contentSecurityPolicy.getDefaultDirectives();
  csp['img-src'] = ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'];
  // The gate scanner reads QR codes in a background worker made from a blob.
  csp['worker-src'] = ["'self'", 'blob:'];
  app.use(helmet({ contentSecurityPolicy: { directives: csp } }));

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ---- API ----
  app.use('/api', loadUser);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/branches', branchesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/registrations', registrationsRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/events', eventsRouter);
  app.use('/api/funds', fundsRouter);
  app.use('/api/fees', feesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/images', imagesRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/batches', batchesRouter);
  app.use('/api/exports', exportsRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // ---- Website (the built React app) ----
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // Any other page address is handled by React Router.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else if (!env.isProd) {
    app.get('/', (_req, res) =>
      res.send('API is running. In development, open the website at http://localhost:5173')
    );
  }

  // ---- Errors ----
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'value';
      return res.status(409).json({ error: `That ${field} is already used.` });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'The request was not valid JSON.' });
    }
    if (err?.name === 'MulterError') {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'The picture is too large. Please choose it again so it can be shrunk first.'
          : 'The picture could not be uploaded. Please try again.';
      return res.status(400).json({ error: message, field: err.field || 'photo' });
    }
    if (err?.status && err.status < 500) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  return app;
}
