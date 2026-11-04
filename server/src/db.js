import mongoose from 'mongoose';
import { env } from './config/env.js';

export async function connectDb() {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to MongoDB (database: ${mongoose.connection.name})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
