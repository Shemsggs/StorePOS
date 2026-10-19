import { useEffect, useState } from 'react';
import { api, peso } from './api.js';

export default function Reports() {
  const [date, setDate] = useState('');
  const [report, setReport] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [error, setError] = useState('');
  const [lowStockError, setLowStockError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    setReport(null);
    api(`/reports/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [date]);

  useEffect(() => {
    let active = true;
    api('/products?lowStock=true')
      .then((products) => {
        if (active) setLowStock(products);
      })
      .catch((loadError) => {
        if (active) setLowStockError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const topProducts = report?.topProducts ?? [];
  const maxQuantity = Math.max(1, ...topProducts.map((product) => product.qtySold));
  const averageSale = report?.salesCount
    ? Math.round(report.revenueCents / report.salesCount)
    : 0;

  return (
    <div className="stack">
      <div className="toolbar">
        <h2 className="title">Daily report{report ? ` · ${report.date}` : ''}</h2>
        <div className="row">
          <label className="sr-only" htmlFor="report-date">Report date</label>
          <input id="report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="btn ghost" onClick={() => setDate('')}>Today</button>
        </div>
      </div>

      {error && <p className="notice error" role="alert">{error}</p>}
      {!error && !report && <p className="muted" role="status">Loading report…</p>}

      {report && (
        <>
          <div className="stats">
            <div className="stat glass"><span className="muted">Sales</span><span className="v">{report.salesCount}</span></div>
            <div className="stat glass"><span className="muted">Revenue</span><span className="v">{peso(report.revenueCents)}</span></div>
            <div className="stat glass"><span className="muted">Profit</span><span className="v ok">{peso(report.profitCents)}</span></div>
            <div className="stat glass"><span className="muted">Average sale</span><span className="v">{peso(averageSale)}</span></div>
          </div>

          <div className="two">
            <section className="glass panel">
              <h3>Top products</h3>
              {topProducts.length === 0 && <p className="muted">No sales on this date.</p>}
              {topProducts.map((product) => (
                <div key={product.productId} className="bar-row">
                  <div className="row between">
                    <span className="strong">{product.name}</span>
                    <span className="muted">{product.qtySold} sold · {peso(product.revenueCents)}</span>
                  </div>
                  <div
                    className="bar"
                    role="img"
                    aria-label={`${product.name}: ${product.qtySold} sold`}
                  >
                    <i style={{ width: `${(product.qtySold / maxQuantity) * 100}%` }} />
                  </div>
                </div>
              ))}
            </section>

            <section className="glass panel">
              <h3>Needs restocking</h3>
              {lowStockError && <p className="error" role="alert">{lowStockError}</p>}
              {!lowStockError && lowStock.length === 0 && <p className="muted">All stocked up.</p>}
              {lowStock.slice(0, 8).map((product) => (
                <div key={product.id} className="row between low-row">
                  <span>{product.name}</span>
                  <span className={`badge ${product.stock === 0 ? 'out' : 'low'}`}>{product.stock} left</span>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
