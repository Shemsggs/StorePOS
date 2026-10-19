import { useCallback, useEffect, useState } from 'react';
import { api, peso, toCents, toPesos } from './api.js';

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal glass" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ProductForm({ product, categories, onSaved, onClose }) {
  const editing = Boolean(product);
  const [form, setForm] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    category: product?.category ?? '',
    price: product ? toPesos(product.priceCents) : '',
    cost: product ? toPesos(product.costCents) : '0.00',
    stock: '0',
    reorderLevel: String(product?.reorderLevel ?? 5),
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      sku: form.sku,
      name: form.name,
      category: form.category || null,
      priceCents: toCents(form.price),
      costCents: toCents(form.cost),
      reorderLevel: Number(form.reorderLevel),
      ...(!editing && { stock: Number(form.stock) }),
    };

    try {
      await api(editing ? `/products/${product.id}` : '/products', {
        method: editing ? 'PUT' : 'POST',
        body,
      });
      await onSaved(editing ? 'Product updated' : 'Product added');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit product' : 'Add product'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            SKU / Barcode
            <input value={form.sku} onChange={update('sku')} required autoFocus maxLength="50" />
          </label>
          <label>
            Name
            <input value={form.name} onChange={update('name')} required maxLength="200" />
          </label>
          <label>
            Category
            <input value={form.category} onChange={update('category')} list="product-categories" maxLength="100" />
            <datalist id="product-categories">
              {categories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </label>
          <label>
            Low-stock alert at
            <input type="number" min="0" step="1" value={form.reorderLevel} onChange={update('reorderLevel')} required />
          </label>
          <label>
            Selling price (₱)
            <input type="number" min="0" step="0.01" value={form.price} onChange={update('price')} required />
          </label>
          <label>
            Cost (₱)
            <input type="number" min="0" step="0.01" value={form.cost} onChange={update('cost')} required />
          </label>
          {!editing && (
            <label>
              Starting stock
              <input type="number" min="0" step="1" value={form.stock} onChange={update('stock')} required />
            </label>
          )}
        </div>
        {editing && <p className="muted">To change stock, use the Stock button so every change is recorded.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function StockForm({ product, onSaved, onClose }) {
  const [mode, setMode] = useState('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('restock');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const quantity = Number(qty);
  const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
  const delta = mode === 'add' ? quantity : -quantity;
  const nextStock = product.stock + (validQuantity ? delta : 0);

  const submit = async (event) => {
    event.preventDefault();
    if (!validQuantity || (mode === 'remove' && nextStock < 0)) return;
    setBusy(true);
    setError('');
    try {
      const updatedProduct = await api(`/products/${product.id}/adjust`, {
        method: 'POST',
        body: { delta, reason },
      });
      await onSaved(`${product.name}: stock is now ${updatedProduct.stock}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Stock · ${product.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'add' ? 'on' : ''} aria-pressed={mode === 'add'} onClick={() => {
            setMode('add');
            setReason('restock');
          }}>
            + Add stock
          </button>
          <button type="button" className={mode === 'remove' ? 'on' : ''} aria-pressed={mode === 'remove'} onClick={() => {
            setMode('remove');
            setReason('damaged');
          }}>
            − Remove
          </button>
        </div>
        <label>
          Quantity
          <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(event.target.value)} required autoFocus />
        </label>
        <label>
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {mode === 'add' ? (
              <option value="restock">Restock</option>
            ) : (
              <>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="lost">Lost</option>
              </>
            )}
          </select>
        </label>
        <p className="muted">
          Current: <b>{product.stock}</b> → New: <b className={nextStock < 0 ? 'error' : ''}>{nextStock}</b>
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || !validQuantity || nextStock < 0}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setProducts(await api('/products'));
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saved = async (text) => {
    setModal(null);
    setMessage({ type: 'ok', text });
    await load();
  };

  const remove = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? Past sales are kept.`)) return;
    setMessage(null);
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      setMessage({ type: 'ok', text: 'Product deleted' });
      await load();
    } catch (deleteError) {
      setMessage({ type: 'error', text: deleteError.message });
    }
  };

  const query = search.trim().toLowerCase();
  const rows = products.filter((product) =>
    !query ||
    product.name.toLowerCase().includes(query) ||
    product.sku.toLowerCase().includes(query),
  );
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];
  const lowCount = products.filter((product) => product.lowStock).length;
  const stockValue = products.reduce((sum, product) => sum + product.stock * product.costCents, 0);

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat glass"><span className="muted">Products</span><span className="v">{products.length}</span></div>
        <div className="stat glass"><span className="muted">Low / out of stock</span><span className={`v ${lowCount ? 'warn' : ''}`}>{lowCount}</span></div>
        <div className="stat glass"><span className="muted">Inventory value (cost)</span><span className="v">{peso(stockValue)}</span></div>
      </div>

      <div className="toolbar">
        <label className="sr-only" htmlFor="products-search">Search products</label>
        <input id="products-search" className="search" placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="btn" onClick={() => setModal({ type: 'form' })}>+ Add product</button>
      </div>

      {error && <p className="notice error" role="alert">{error}</p>}
      {message && <p className={`notice ${message.type}`} role="status">{message.text}</p>}

      <div className="table-wrap glass">
        <table>
          <thead>
            <tr>
              <th>Product</th><th>Category</th>
              <th className="r">Price</th><th className="r">Cost</th><th className="r">Stock</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => (
              <tr key={product.id}>
                <td><div className="strong">{product.name}</div><div className="muted">{product.sku}</div></td>
                <td>{product.category ?? '—'}</td>
                <td className="r">{peso(product.priceCents)}</td>
                <td className="r">{peso(product.costCents)}</td>
                <td className="r">
                  <span className={`badge ${product.stock === 0 ? 'out' : product.lowStock ? 'low' : ''}`}>{product.stock}</span>
                </td>
                <td>
                  <div className="actions">
                    <button className="btn sm" onClick={() => setModal({ type: 'stock', product })}>Stock</button>
                    <button className="btn sm ghost" onClick={() => setModal({ type: 'form', product })}>Edit</button>
                    <button className="btn sm ghost danger" onClick={() => remove(product)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="6" className="muted center">No products found. Click “Add product” to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'form' && (
        <ProductForm
          product={modal.product}
          categories={categories}
          onSaved={saved}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'stock' && (
        <StockForm
          product={modal.product}
          onSaved={saved}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
