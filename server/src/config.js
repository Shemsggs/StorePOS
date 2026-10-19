import 'dotenv/config';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('Missing env var: JWT_SECRET (copy .env.example to .env)');

export const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || './data/storepos.db',
  jwtSecret,
  tzOffsetHours: Number.parseInt(process.env.TZ_OFFSET_HOURS ?? '8', 10),
  corsOrigin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean),
};
