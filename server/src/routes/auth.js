import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const userSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});

async function createUser({ name, email, password }, role) {
  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, role);
  return { id: Number(info.lastInsertRowid), name, email, role };
}

// One-time setup: creates the first admin. Disabled once any user exists.
router.post('/setup', async (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) throw new HttpError(409, 'Setup already completed');
  res.status(201).json(await createUser(userSchema.parse(req.body), 'admin'));
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().trim().toLowerCase(), password: z.string() })
    .parse(req.body);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  const token = jwt.sign({ role: user.role, name: user.name }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: '8h',
  });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Admin creates staff accounts.
router.post('/users', authenticate, requireRole('admin'), async (req, res) => {
  const role = z.enum(['admin', 'cashier']).default('cashier').parse(req.body?.role);
  res.status(201).json(await createUser(userSchema.parse(req.body), role));
});

export default router;
