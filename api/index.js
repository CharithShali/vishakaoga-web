// Vercel runs the Express API as one function from this file.
// (On your computer, and on any normal server, server/src/index.js is used instead.)
//
// vercel.json sends every /api/... request here; Vercel serves the built React
// pages (client/dist) itself.

import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/db.js';

const app = createApp();

// Connect once and reuse the connection while this function stays warm.
let connecting = null;
function ready() {
  connecting ??= connectDb().catch((err) => {
    connecting = null; // try again on the next request
    throw err;
  });
  return connecting;
}

export default async function handler(req, res) {
  try {
    await ready();
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'The website could not reach its database. Please try again in a minute.' }));
    return;
  }
  return app(req, res);
}
