import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError, idParam } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const saleSchema = z.object({
  items: z
    .array(z.object({ productId: z.number().int().positive(), qty: z.number().int().positive() }))
    .min(1)
    .max(100),
  paymentCents: z.number().int().min(0),
});

router.post('/', (req, res) => {
  const { items, paymentCents } = saleSchema.parse(req.body);

  // Merge duplicate lines so the stock check is accurate.
  const wanted = new Map();
  for (const { productId, qty } of items) wanted.set(productId, (wanted.get(productId) ?? 0) + qty);

  // Atomic: any thrown error rolls back every stock deduction.
  const createSale = db.transaction(() => {
    const getProduct = db.prepare('SELECT id, name, price_cents, cost_cents FROM products WHERE id = ? AND active = 1');
    const deduct = db.prepare(
      "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?",
    );

    const lines = [];
    let total = 0;
    for (const [productId, qty] of wanted) {
      const p = getProduct.get(productId);
      if (!p) throw new HttpError(404, `Product ${productId} not found`);
      if (deduct.run(qty, productId, qty).changes === 0) {
        throw new HttpError(409, `Insufficient stock for ${p.name}`);
      }
      lines.push({ productId, name: p.name, qty, unitPriceCents: p.price_cents, unitCostCents: p.cost_cents });
      total += qty * p.price_cents;
    }
    if (paymentCents < total) throw new HttpError(400, 'Payment is less than the total');

    const changeCents = paymentCents - total;
    const saleId = Number(
      db
        .prepare('INSERT INTO sales (cashier_id, total_cents, payment_cents, change_cents) VALUES (?, ?, ?, ?)')
        .run(Number(req.user.sub), total, paymentCents, changeCents).lastInsertRowid,
    );

    const addItem = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, name, qty, unit_price_cents, unit_cost_cents) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const addMove = db.prepare('INSERT INTO stock_movements (product_id, delta, reason, user_id) VALUES (?, ?, ?, ?)');
    for (const l of lines) {
      addItem.run(saleId, l.productId, l.name, l.qty, l.unitPriceCents, l.unitCostCents);
      addMove.run(l.productId, -l.qty, `sale #${saleId}`, Number(req.user.sub));
    }
    return { id: saleId, totalCents: total, paymentCents, changeCents, items: lines };
  });

  res.status(201).json(createSale());
});

router.get('/', (req, res) => {
  const { limit, offset } = z
    .object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .parse(req.query);
  const rows = db
    .prepare(`SELECT id, cashier_id AS cashierId, total_cents AS totalCents, payment_cents AS paymentCents,
                     change_cents AS changeCents, created_at AS createdAt
              FROM sales ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(limit, offset);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const sale = db
    .prepare(`SELECT id, cashier_id AS cashierId, total_cents AS totalCents, payment_cents AS paymentCents,
                     change_cents AS changeCents, created_at AS createdAt FROM sales WHERE id = ?`)
    .get(idParam(req));
  if (!sale) throw new HttpError(404, 'Sale not found');
  const items = db
    .prepare(`SELECT product_id AS productId, name, qty, unit_price_cents AS unitPriceCents
              FROM sale_items WHERE sale_id = ?`)
    .all(sale.id);
  res.json({ ...sale, items });
});

export default router;
