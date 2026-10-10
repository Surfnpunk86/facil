// Puerta de entrada del cliente: /r/:slug?t=MESA-7&via=nfc|qr|wa&tel=3005551234
// La misma URL va grabada en el chip NFC y en el QR de la pieza; solo cambia `via`.
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, saveCard, savedCard, formatPhone } from '../api.js';
import { Screen, Venue } from '../components.jsx';

const VIA = { nfc: 'NFC', qr: 'QR', wa: 'WHATSAPP', wallet: 'WALLET' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function Entry() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const door = VIA[params.get('via')] || 'QR';
  const tag = params.get('t') || undefined;
  const waiter = params.get('m') || undefined;

  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('join'); // join | member | sent
  const [form, setForm] = useState({ name: '', phone: formatPhone(params.get('tel') || ''), month: '', day: '', consent: false });
  const [busy, setBusy] = useState(false);
  const existing = savedCard(slug);

  useEffect(() => {
    api(`/r/${slug}${tag ? `?t=${encodeURIComponent(tag)}` : ''}`)
      .then(setInfo)
      .catch((e) => setError(e.message));
    api(`/r/${slug}/entry`, { method: 'POST', body: { door, tag, cardToken: existing || undefined } }).catch(() => {});
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : k === 'phone' ? formatPhone(e.target.value) : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (mode === 'join' && !form.consent) return setError('Marca la autorización de datos para crear tu tarjeta.');
    setBusy(true);
    try {
      const birthday = form.month && form.day ? `${String(form.month).padStart(2, '0')}-${String(form.day).padStart(2, '0')}` : '';
      const res = mode === 'member'
        ? await api(`/r/${slug}/card-link`, { method: 'POST', body: { phone: form.phone } })
        : await api(`/r/${slug}/join`, { method: 'POST', body: { name: form.name, phone: form.phone, birthday, consent: true, door, tag, waiter } });
      if (res.status === 'created') {
        saveCard(slug, res.token);
        navigate(`/c/${res.token}?nuevo=1&via=${params.get('via') || 'qr'}`);
      } else {
        setMode('sent');
        if (res.devToken) saveCard(slug, res.devToken); // solo en desarrollo
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !info) {
    return <Screen><div className="error">{error}</div></Screen>;
  }
  if (!info) return <Screen><p className="muted">Cargando…</p></Screen>;
  const r = info.restaurant;

  if (existing && mode !== 'sent') {
    return (
      <Screen title={r.name} subtitle="Club de clientes">
        <Venue restaurant={r} subtitle={info.tag?.label || 'Club de clientes'} />
        <h1>Ya tienes tu tarjeta del Club</h1>
        <p className="muted">Ábrela para sumar la compra de hoy escaneando el QR de tu factura.</p>
        <button className="btn" onClick={() => navigate(`/c/${existing}?via=${params.get('via') || 'qr'}`)}>Abrir mi tarjeta</button>
      </Screen>
    );
  }

  if (mode === 'sent') {
    return (
      <Screen title={r.name} subtitle="Club de clientes">
        <Venue restaurant={r} />
        <h1>Te enviamos tu tarjeta por WhatsApp</h1>
        <p className="muted">Ese número ya está en el Club. Abre el enlace que te llegó al WhatsApp del {form.phone} para ver tus puntos y sumar la compra de hoy.</p>
        <button className="link" onClick={() => setMode('join')}>Usar otro número</button>
      </Screen>
    );
  }

  return (
    <Screen title={r.name} subtitle="Club de clientes">
      <Venue restaurant={r} subtitle={info.tag?.label ? `${info.tag.label} · Club de clientes` : 'Club de clientes'} />
      <div className="stack" style={{ gap: 4 }}>
        <h1>{mode === 'member' ? 'Recupera tu tarjeta' : 'Únete al Club y suma con esta visita'}</h1>
        <p className="muted">
          {mode === 'member'
            ? 'Escribe tu celular y te enviamos el enlace de tu tarjeta por WhatsApp.'
            : `Cada $1.000 suma ${r.pointsPerThousand === 1 ? '1 punto' : r.pointsPerThousand + ' puntos'} y cada compra un sello. Con ${r.stampsGoal} sellos: ${r.rewardText}. No tienes que instalar nada.`}
        </p>
      </div>

      <form className="stack" onSubmit={submit} noValidate>
        {mode === 'join' && (
          <div className="field">
            <label htmlFor="name">Nombre</label>
            <input id="name" autoComplete="name" value={form.name} onChange={set('name')} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="phone">Celular (WhatsApp)</label>
          <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="300 555 1234" value={form.phone} onChange={set('phone')} required />
        </div>
        {mode === 'join' && (
          <>
            <div className="field">
              <label htmlFor="month">Cumpleaños (opcional, para tu regalo)</label>
              <div className="pair">
                <select id="month" value={form.month} onChange={set('month')} aria-label="Mes">
                  <option value="">Mes</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select id="day" value={form.day} onChange={set('day')} aria-label="Día">
                  <option value="">Día</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
            </div>
            <label className="check">
              <input id="consent" type="checkbox" checked={form.consent} onChange={set('consent')} />
              <span>Autorizo a {r.name} a tratar mis datos para el programa de fidelización y a escribirme por WhatsApp, según la Ley 1581 de 2012. Puedo darme de baja cuando quiera respondiendo BAJA.</span>
            </label>
          </>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Un momento…' : mode === 'member' ? 'Enviarme mi tarjeta' : 'Crear mi tarjeta'}</button>
      </form>

      <button className="link" onClick={() => { setError(null); setMode(mode === 'join' ? 'member' : 'join'); }}>
        {mode === 'join' ? 'Ya soy del Club' : 'Soy nuevo, quiero unirme'}
      </button>
      <p className="muted small">¿Prefieres no usar el celular? Dile tu número al cajero y él suma tu compra.</p>
    </Screen>
  );
}
