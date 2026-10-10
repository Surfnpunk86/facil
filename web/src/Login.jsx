import { useState } from 'react';
import { api, setStaffSession } from './api.js';
import { Mark } from './components.jsx';

export default function Login({ title, onLogin, allowSignup = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api('/auth/login', { method: 'POST', body: { email, password } });
      setStaffSession(s);
      onLogin(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile" style={{ justifyContent: 'center' }}>
      <div><Mark /></div>
      <h1>{title}</h1>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <p style={{ textAlign: 'center', margin: 0 }}>
          <a className="muted" href="/olvide">¿Olvidaste tu contraseña?</a>
        </p>
      </form>
      {allowSignup && (
        <div className="stack">
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>¿Tu restaurante aún no está en Fácil?</p>
          <a className="btn ghost" href="/registro">Crear cuenta</a>
        </div>
      )}
    </main>
  );
}
