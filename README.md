# StorePOS

Free, open-source inventory and point-of-sale (POS) system for small stores (sari-sari stores, mini-marts, small shops).

> **Status:** backend API and web POS frontend are available.

## Features

- Web POS with category filters, barcode/SKU entry, cart, and change computation
- Admin product management: add, edit, search, soft-delete, and adjust stock
- Stock adjustments with a full audit trail (restock, damaged, expired)
- Admin daily reports: sales, revenue, profit, top products, and low-stock alerts
- Roles: `admin` and `cashier`
- Atomic transactions, so a failed sale never leaves stock half-updated
- Money stored as integer centavos (no floating-point errors)

## Tech stack

Node.js 20+, Express 5, SQLite (better-sqlite3), Zod validation, JWT auth.

## Quick start

Start the backend in one terminal:

```bash
cd server
npm install
cp .env.example .env        # then set a long random JWT_SECRET
npm run seed                # optional: sample products and demo users (dev only)
npm run dev                 # http://localhost:3000
npm test
```

Start the web frontend in a second terminal:

```bash
cd web
npm install
npm run dev
```

Open the frontend URL printed by Vite (usually `http://localhost:5173`). It proxies API requests to the backend at `http://localhost:3000`.

Demo login after seeding: `admin@example.com` / `cashier@example.com`, password `ChangeMe123!`. **Change or delete these before real use.**

First-time setup without seeding:

```bash
curl -X POST localhost:3000/api/auth/setup -H "content-type: application/json" \
  -d '{"name":"Owner","email":"owner@shop.com","password":"a-strong-password"}'
```

## API

All routes except `/health`, `/auth/setup`, and `/auth/login` need `Authorization: Bearer <token>`.
Amounts are in **centavos** (₱25.00 = `2500`).

| Method | Route | Role | Description |
|---|---|---|---|
| POST | `/api/auth/setup` | none | Create first admin (works once) |
| POST | `/api/auth/login` | none | Get a token |
| POST | `/api/auth/users` | admin | Create admin or cashier account |
| GET | `/api/products?search=&lowStock=true` | any | List products |
| GET | `/api/products/:id` | any | One product |
| POST | `/api/products` | admin | Create product |
| PUT | `/api/products/:id` | admin | Update product details |
| DELETE | `/api/products/:id` | admin | Soft delete |
| POST | `/api/products/:id/adjust` | admin | `{ "delta": 20, "reason": "restock" }` |
| POST | `/api/sales` | any | `{ "items": [{ "productId": 1, "qty": 2 }], "paymentCents": 10000 }` |
| GET | `/api/sales?limit=&offset=` | any | Sales history |
| GET | `/api/sales/:id` | any | Sale with items |
| GET | `/api/reports/daily?date=YYYY-MM-DD` | admin | Daily summary |

## Deployment notes

- Set a strong `JWT_SECRET` and `NODE_ENV=production`.
- Set `CORS_ORIGIN` to your frontend URL.
- Run behind HTTPS (Caddy, Nginx, or a platform like Render).
- Back up the SQLite file in `DB_PATH` regularly.

## Roadmap

- [ ] Receipt printing / PDF
- [ ] Customer credit ("utang") tracking
- [ ] Suppliers and purchase orders
- [ ] CSV import/export
- [ ] PostgreSQL option
- [ ] Offline-capable PWA

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [MIT](LICENSE).