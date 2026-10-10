// Cliente HTTP mínimo. Los errores de la API llegan con { error, message } y se lanzan como ApiError.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const STAFF_KEY = 'facil_staff';

export function getStaffSession() {
  try { return JSON.parse(localStorage.getItem(STAFF_KEY)) || null; } catch { return null; }
}
export function setStaffSession(s) {
  try { s ? localStorage.setItem(STAFF_KEY, JSON.stringify(s)) : localStorage.removeItem(STAFF_KEY); } catch { /* sin almacenamiento */ }
}

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const s = getStaffSession();
    if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'network', 'Sin conexión. Revisa tu internet e intenta de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) setStaffSession(null);
    throw new ApiError(res.status, data.error || 'error', data.message || 'Algo falló. Intenta de nuevo.');
  }
  return data;
}

// Tarjeta guardada en este celular, por restaurante.
const cardKey = (slug) => `facil_card_${slug}`;
export function savedCard(slug) {
  try { return localStorage.getItem(cardKey(slug)); } catch { return null; }
}
export function saveCard(slug, token) {
  try { localStorage.setItem(cardKey(slug), token); } catch { /* sin almacenamiento */ }
}

export const cop = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO');
export const formatPhone = (d) => d.replace(/\D/g, '').slice(0, 10).replace(/(\d{3})(\d{0,3})(\d{0,4})/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));
