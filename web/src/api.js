const KEY = 'storepos_token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(KEY, token) : localStorage.removeItem(KEY);

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });

  let data = null;
  if (res.status !== 204) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else if (!res.ok) {
      throw new Error(`Server request failed (${res.status})`);
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event('auth:expired'));
    }
    const detail = data?.details?.map((item) => `${item.path}: ${item.message}`).join(', ');
    throw new Error(detail || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const peso = (cents) =>
  '₱' +
  (cents / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const toCents = (pesos) => {
  const value = Number(pesos);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};

export const toPesos = (cents) => (cents / 100).toFixed(2);
