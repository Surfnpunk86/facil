import { useState } from 'react';
import { api } from '../api.js';
import { Mark } from '../components.jsx';

export default function Reset() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      const r = await api('/auth/reset', { method: 'POST', body: { token, password } });
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
      <h1>Crea una contraseña nueva</h1>
      {msg ? (
        <div className="stack">
          <p>{msg}</p>
          <a className="btn" href="/panel">Iniciar sesión</a>
        </div>
      ) : !token ? (
        <div className="stack">
          <div className="error" role="alert">Falta el enlace de restablecimiento. Pide uno nuevo.</div>
          <a className="btn ghost" href="/olvide">Pedir un enlace</a>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="pw">Contraseña nueva (mínimo 10 caracteres)</label>
            <input id="pw" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="pw2">Repite la contraseña</label>
            <input id="pw2" type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
        </form>
      )}
    </main>
  );
}
