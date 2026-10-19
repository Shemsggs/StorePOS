import { useCallback, useEffect, useState } from 'react';
import { api, peso } from './api.js';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState({});
  const [payment, setPayment] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProducts(await api('/products'));
    } catch (error) {
      setMsg({ type: 'error', text: error.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = ['All', ...new Set(products.map((product) => product.category).filter(Boolean))];
  const query = search.trim().toLowerCase();
  const visible = products.filter((product) =>
    (category === 'All' || product.category === category) &&
    (!query ||
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query)),
  );
  const lines = Object.values(cart);
  const total = lines.reduce((sum, line) => sum + line.qty * line.product.priceCents, 0);
  const paymentAmount = Number(payment);
  const paid = Number.isFinite(paymentAmount) ? Math.round(paymentAmount * 100) : 0;
  const canCharge = lines.length > 0 && paid >= total && !busy;

  const add = (product) =>
    setCart((current) => {
      const qty = (current[product.id]?.qty ?? 0) + 1;
      return qty > product.stock
        ? current
        : { ...current, [product.id]: { product, qty } };
    });

  const step = (id, delta) =>
    setCart((current) => {
      const line = current[id];
      if (!line) return current;
      const qty = line.qty + delta;
      if (qty <= 0) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return qty > line.product.stock
        ? current
        : { ...current, [id]: { ...line, qty } };
    });

  const onSearchKey = (event) => {
    if (event.key !== 'Enter' || !query) return;
    const match =
      products.find((product) => product.sku.toLowerCase() === query) ??
      (visible.length === 1 ? visible[0] : null);
    if (match && match.stock > 0) {
      add(match);
      setSearch('');
    }
  };

  const charge = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const sale = await api('/sales', {
        method: 'POST',
        body: {
          items: lines.map((line) => ({ productId: line.product.id, qty: line.qty })),
          paymentCents: paid,
        },
      });
      setMsg({ type: 'ok', text: `Sale #${sale.id} done. Change: ${peso(sale.changeCents)}` });
      setCart({});
      setPayment('');
    } catch (error) {
      setMsg({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
      await load();
    }
  };

  return (
      <div className="pos">
        <section aria-label="Product catalog">
          <label className="sr-only" htmlFor="product-search">Search products</label>
          <input
            id="product-search"
            className="search"
            placeholder="Search name or SKU, or scan a barcode…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={onSearchKey}
          />
          <div className="chips" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                key={item}
                className={`chip ${category === item ? 'on' : ''}`}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="grid">
            {visible.map((product) => (
              <button
                key={product.id}
                className="product"
                disabled={product.stock === 0}
                onClick={() => add(product)}
              >
                <span className="p-name">{product.name}</span>
                <span className="p-price">{peso(product.priceCents)}</span>
                <span className={`badge ${product.stock === 0 ? 'out' : product.lowStock ? 'low' : ''}`}>
                  {product.stock === 0 ? 'Out of stock' : `${product.stock} left`}
                </span>
              </button>
            ))}
            {visible.length === 0 && <p className="muted">No products found.</p>}
          </div>
        </section>

        <aside className="cart card" aria-label="Current sale">
          <h2>Current sale</h2>
          <div className="lines">
            {lines.length === 0 && <p className="muted">Tap a product to add it.</p>}
            {lines.map(({ product, qty }) => (
              <div className="line" key={product.id}>
                <div>
                  <div className="l-name">{product.name}</div>
                  <div className="muted">{peso(product.priceCents)} each</div>
                </div>
                <div className="qty" aria-label={`Quantity of ${product.name}`}>
                  <button aria-label={`Remove one ${product.name}`} onClick={() => step(product.id, -1)}>−</button>
                  <span>{qty}</span>
                  <button
                    aria-label={`Add one ${product.name}`}
                    disabled={qty >= product.stock}
                    onClick={() => step(product.id, 1)}
                  >
                    +
                  </button>
                </div>
                <div className="l-total">{peso(qty * product.priceCents)}</div>
              </div>
            ))}
          </div>

          <div className="total">
            <span>Total</span>
            <strong>{peso(total)}</strong>
          </div>

          <label>
            Cash received (₱)
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={payment}
              onChange={(event) => setPayment(event.target.value)}
            />
          </label>
          <div className="quick" aria-label="Quick payment amounts">
            <button onClick={() => setPayment((total / 100).toFixed(2))} disabled={!total}>Exact</button>
            {[100, 500, 1000].map((amount) => (
              <button key={amount} onClick={() => setPayment(String(amount))}>₱{amount}</button>
            ))}
          </div>

          <div className="change">
            <span>Change</span>
            <strong>{total > 0 && paid >= total ? peso(paid - total) : '—'}</strong>
          </div>

          {msg && (
            <p className={msg.type === 'ok' ? 'success' : 'error'} role="status">
              {msg.text}
            </p>
          )}
          <button className="btn big" disabled={!canCharge} onClick={charge}>
            {busy ? 'Processing…' : 'Charge'}
          </button>
        </aside>
      </div>
  );
}
