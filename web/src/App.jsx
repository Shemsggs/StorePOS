import { useEffect, useState } from 'react';
import { getToken, setToken } from './api.js';
import Login from './Login.jsx';
import POS from './POS.jsx';
import Products from './Products.jsx';
import Reports from './Reports.jsx';

const USER_KEY = 'storepos_user';

const loadUser = () => {
  try {
    return getToken() ? JSON.parse(localStorage.getItem(USER_KEY)) : null;
  } catch {
    return null;
  }
};

export default function App() {
  const [user, setUser] = useState(loadUser);
  const [page, setPage] = useState('sell');

  const logout = () => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setPage('sell');
  };

  const onLogin = ({ token, user: signedInUser }) => {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(signedInUser));
    setUser(signedInUser);
  };

  useEffect(() => {
    window.addEventListener('auth:expired', logout);
    return () => window.removeEventListener('auth:expired', logout);
  }, []);

  if (!user) return <Login onLogin={onLogin} />;

  const tabs = [
    ...(user.role === 'admin'
      ? [['sell', 'Sell'], ['products', 'Products'], ['reports', 'Reports']]
      : []),
  ];

  return (
    <>
      <header className="topbar glass">
        <div className="brand">
          <span className="logo sm" aria-hidden="true">S</span>
          StorePOS
        </div>
        <nav className="tabs" aria-label="Main navigation">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              className={page === key ? 'on' : ''}
              aria-current={page === key ? 'page' : undefined}
              onClick={() => setPage(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="user">
          <span>{user.name} · {user.role}</span>
          <button className="btn sm ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="page">
        {page === 'sell' && <POS />}
        {page === 'products' && user.role === 'admin' && <Products />}
        {page === 'reports' && user.role === 'admin' && <Reports />}
      </main>
    </>
  );
}
