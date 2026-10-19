import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError, idParam } from '../lib/errors.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const COLS = `id, sku, name, category, price_cents AS priceCents, cost_cents AS costCents,
              stock, reorder_level AS reorderLevel`;

const withFlag = (p) => ({ ...p, lowStock: p.stock <= p.reorderLevel });
const findProduct = (id) => db.prepare(`SELECT ${COLS} FROM products WHERE id = ? AND active = 1`).get(id);

const productSchema = z.object({
  sku: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).nullish(),
  priceCents: z.number().int().min(0),
  costCents: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(5),
});

router.get('/', (req, res) => {
  const like = `%${String(req.query.search ?? '').trim()}%`;
  const lowOnly = req.query.lowStock === 'true' ? 'AND stock <= reorder_level' : '';
  const rows = db
    .prepare(`SELECT ${COLS} FROM products WHERE active = 1 AND (name LIKE ? OR sku LIKE ?) ${lowOnly} ORDER BY name`)
    .all(like, like);
  res.json(rows.map(withFlag));
});

router.get('/:id', (req, res) => {
  const product = findProduct(idParam(req));
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(withFlag(product));
});

router.post('/', requireRole('admin'), (req, res) => {
  const p = productSchema.parse(req.body);
  const id = db.transaction(() => {
    const info = db
      .prepare(`INSERT INTO products (sku, name, category, price_cents, cost_cents, stock, reorder_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(p.sku, p.name, p.category ?? null, p.priceCents, p.costCents, p.stock, p.reorderLevel);
    const productId = Number(info.lastInsertRowid);
    if (p.stock > 0) {
      db.prepare('INSERT INTO stock_movements (product_id, delta, reason, user_id) VALUES (?, ?, ?, ?)')
        .run(productId, p.stock, 'initial stock', Number(req.user.sub));
    }
    return productId;
  })();
  res.status(201).json(withFlag(findProduct(id)));
});

// Stock is excluded here on purpose: change it through /adjust so every change is logged.
router.put('/:id', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  const p = productSchema.omit({ stock: true }).parse(req.body);
  const info = db
    .prepare(`UPDATE products SET sku = ?, name = ?, category = ?, price_cents = ?, cost_cents = ?,
              reorder_level = ?, updated_at = datetime('now') WHERE id = ? AND active = 1`)
    .run(p.sku, p.name, p.category ?? null, p.priceCents, p.costCents, p.reorderLevel, id);
  if (info.changes === 0) throw new HttpError(404, 'Product not found');
  res.json(withFlag(findProduct(id)));
});

// Soft delete keeps old sales records valid.
router.delete('/:id', requireRole('admin'), (req, res) => {
  const info = db
    .prepare("UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ? AND active = 1")
    .run(idParam(req));
  if (info.changes === 0) throw new HttpError(404, 'Product not found');
  res.status(204).end();
});

// Restock (+) or remove damaged/expired items (-).
router.post('/:id/adjust', requireRole('admin'), (req, res) => {
  const id = idParam(req);
  const { delta, reason } = z
    .object({
      delta: z.number().int().refine((n) => n !== 0, 'delta must not be 0'),
      reason: z.string().trim().min(1).max(200),
    })
    .parse(req.body);

  db.transaction(() => {
    if (!findProduct(id)) throw new HttpError(404, 'Product not found');
    const info = db
      .prepare("UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ? AND stock + ? >= 0")
      .run(delta, id, delta);
    if (info.changes === 0) throw new HttpError(409, 'Stock cannot go below 0');
    db.prepare('INSERT INTO stock_movements (product_id, delta, reason, user_id) VALUES (?, ?, ?, ?)')
      .run(id, delta, reason, Number(req.user.sub));
  })();
  res.json(withFlag(findProduct(id)));
});

export default router;
