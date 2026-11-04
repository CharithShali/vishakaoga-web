import { env } from './config/env.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

try {
  await connectDb();
} catch (err) {
  console.error('Could not connect to MongoDB. Check MONGODB_URI in your .env file.');
  console.error(err.message);
  process.exit(1);
}

const app = createApp();
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
