import { config } from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { User } from '../src/models/User';

config({ path: '.env.local' });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 6) {
    throw new Error('Set SEED_ADMIN_EMAIL and a 6+ character SEED_ADMIN_PASSWORD');
  }
  await db();
  if (await User.exists({ role: 'SUPER_ADMIN' })) {
    throw new Error('Super Admin already exists. Seed disabled.');
  }
  await User.create({
    name: 'Super Admin',
    email,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'SUPER_ADMIN',
  });
  console.log('Super Admin account created');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
