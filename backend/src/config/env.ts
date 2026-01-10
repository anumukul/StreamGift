import { z } from 'zod';
import { config } from 'dotenv';
config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  PRIVY_APP_ID: z.string(),
  PRIVY_APP_SECRET: z.string(),
  MOVEMENT_NODE_URL: z.string().default('https://testnet.movementnetwork.xyz/v1'),
  CONTRACT_ADDRESS: z.string(),
  ADMIN_PRIVATE_KEY: z.string(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@streamgift.xyz'),
});

export const env = envSchema.parse(process.env);