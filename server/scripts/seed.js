// Dev-only sample data. Never run in production.
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const hash = bcrypt.hashSync('ChangeMe123!', 10);
const addUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
addUser.run('Demo Admin', 'admin@example.com', hash, 'admin');
addUser.run('Demo Cashier', 'cashier@example.com', hash, 'cashier');

// [sku, name, category, price, cost, stock] in pesos
const products = [
  ['NDL-001', 'Instant Noodles', 'Food', 15, 12, 100],
  ['CAN-001', 'Canned Sardines', 'Food', 25, 20, 60],
  ['RIC-001', 'Rice 1kg', 'Food', 55, 48, 40],
  ['OIL-001', 'Cooking Oil 1L', 'Pantry', 120, 105, 20],
  ['SOY-001', 'Soy Sauce 200ml', 'Pantry', 22, 17, 30],
  ['SUG-001', 'Sugar 1kg', 'Pantry', 85, 75, 25],
  ['COF-001', 'Coffee Sachet', 'Drinks', 8, 6, 200],
  ['WTR-001', 'Bottled Water 500ml', 'Drinks', 15, 10, 48],
  ['SOP-001', 'Bath Soap', 'Household', 35, 28, 4],
  ['SHP-001', 'Shampoo Sachet', 'Household', 7, 5, 150],
];

const addProduct = db.prepare(
  'INSERT OR IGNORE INTO products (sku, name, category, price_cents, cost_cents, stock) VALUES (?, ?, ?, ?, ?, ?)',
);
db.transaction(() => {
  for (const [sku, name, cat, price, cost, stock] of products) {
    addProduct.run(sku, name, cat, price * 100, cost * 100, stock);
  }
})();

console.log('Seeded. Login: admin@example.com / cashier@example.com, password: ChangeMe123!');
