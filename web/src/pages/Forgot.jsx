import { useState } from 'react';
import { api } from '../api.js';
import { Mark } from '../components.jsx';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api('/auth/forgot', { method: 'POST', body: { email } });
      setMsg(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mobile" style={{ justifyContent: 'center' }}>
      <div><Mark /></div>
      <h1>Recupera tu contraseña</h1>
      {msg ? (
        <div className="stack">
          <p>{msg}</p>
          <a className="btn ghost" href="/panel">Volver a iniciar sesión</a>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <p className="muted">Escribe el correo de tu cuenta y te enviamos un enlace para crear una contraseña nueva.</p>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Enviando…' : 'Enviar enlace'}</button>
          <p style={{ textAlign: 'center', margin: 0 }}><a className="muted" href="/panel">Volver</a></p>
        </form>
      )}
    </main>
  );
}
