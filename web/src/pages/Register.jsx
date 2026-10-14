import { useState } from 'react';
import { api, setStaffSession, formatPhone } from '../api.js';
import { Mark } from '../components.jsx';

export default function Register() {
  const [f, setF] = useState({ restaurantName: '', nit: '', city: '', name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { ...f, city: f.city || undefined, phone: f.phone || undefined };
      const s = await api('/auth/register', { method: 'POST', body });
      setStaffSession(s);
      window.location.assign('/panel');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="mobile" style={{ justifyContent: 'center' }}>
      <div><Mark /></div>
      <h1>Crea la cuenta de tu establecimiento</h1>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="rn">Nombre del establecimiento</label>
          <input id="rn" value={f.restaurantName} onChange={set('restaurantName')} required maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="nit">NIT (sin dígito de verificación)</label>
          <input id="nit" inputMode="numeric" value={f.nit} onChange={set('nit')} required />
        </div>
        <div className="field">
          <label htmlFor="city">Ciudad (opcional)</label>
          <input id="city" value={f.city} onChange={set('city')} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="name">Tu nombre</label>
          <input id="name" autoComplete="name" value={f.name} onChange={set('name')} required maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="username" value={f.email} onChange={set('email')} required />
        </div>
        <div className="field">
          <label htmlFor="phone">Celular para alertas (opcional)</label>
          <input id="phone" inputMode="tel" value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: formatPhone(e.target.value) }))} />
        </div>
        <div className="field">
          <label htmlFor="pw">Contraseña (mínimo 10 caracteres)</label>
          <input id="pw" type="password" autoComplete="new-password" minLength={10} value={f.password} onChange={set('password')} required />
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Creando…' : 'Crear cuenta'}</button>
        <p style={{ textAlign: 'center', margin: 0 }}><a className="muted" href="/panel">Ya tengo cuenta · Iniciar sesión</a></p>
      </form>
    </main>
  );
}
