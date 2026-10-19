import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { config } from '../config.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

// Timestamps are stored in UTC; shift them to the store's local day for reporting.
const offset = `${config.tzOffsetHours >= 0 ? '+' : ''}${config.tzOffsetHours} hours`;
const today = () => db.prepare("SELECT date('now', ?) AS d").get(offset).d;

router.get('/daily', (req, res) => {
  const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .default(today())
    .parse(req.query.date);

  const totals = db
    .prepare(`SELECT COUNT(DISTINCT s.id) AS salesCount,
                     COALESCE(SUM(si.qty * si.unit_price_cents), 0) AS revenueCents,
                     COALESCE(SUM(si.qty * (si.unit_price_cents - si.unit_cost_cents)), 0) AS profitCents
              FROM sales s JOIN sale_items si ON si.sale_id = s.id
              WHERE date(s.created_at, ?) = ?`)
    .get(offset, date);

  const topProducts = db
    .prepare(`SELECT si.product_id AS productId, si.name, SUM(si.qty) AS qtySold,
                     SUM(si.qty * si.unit_price_cents) AS revenueCents
              FROM sale_items si JOIN sales s ON s.id = si.sale_id
              WHERE date(s.created_at, ?) = ?
              GROUP BY si.product_id ORDER BY qtySold DESC LIMIT 5`)
    .all(offset, date);

  res.json({ date, ...totals, topProducts });
});

export default router;
