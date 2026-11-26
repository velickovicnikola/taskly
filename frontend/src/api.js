const TOKEN_KEY = 'taskly_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Called when the server rejects the saved token (expired or invalid)
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
    // Ignore failed logins and late responses that belong to an older token
  if (res.status === 401 && path !== '/auth/login' && token && token === getToken()) {
    clearToken();
    onUnauthorized();
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}