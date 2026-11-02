import mongoose from 'mongoose';
const globalDb = globalThis as typeof globalThis & { _mongoose?: Promise<typeof mongoose> };
export async function db() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');
  if (!globalDb._mongoose) globalDb._mongoose = mongoose.connect(uri).catch(e => { globalDb._mongoose = undefined; throw e; });
  return globalDb._mongoose;
}
