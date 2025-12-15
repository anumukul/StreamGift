import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  MOVEMENT_NODE_URL: z.string(),
  CONTRACT_ADDRESS: z.string(),
  ADMIN_PRIVATE_KEY: z.string(),
  PRIVY_APP_ID: z.string(),
  PRIVY_APP_SECRET: z.string(),
  SHINAMI_ACCESS_KEY: z.string(),
  RESEND_API_KEY: z.string(),
  FRONTEND_URL: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;