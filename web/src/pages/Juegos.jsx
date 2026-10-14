// Panel · Juegos y red: ranking de meseros, retos del restaurante, álbum de la zona y factura premiada.
import { useCallback, useEffect, useState } from 'react';
import { api, cop } from '../api.js';
import { QrImage } from '../components.jsx';

const KIND = { VISITS: 'Visitas', SPEND: 'Gasto acumulado', STREAK_WEEKS: 'Semanas seguidas' };
const STATUS = { ACTIVE: ['Activo', 'ok'], CLOSED: ['Cerrado', 'md'], DRAWN: ['Sorteado', 'off'], DRAFT: ['Borrador', 'off'] };
const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() - 5 * 3600000 + n * 86400000).toISOString().slice(0, 10);

export default function Juegos({ toast }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api('/panel/games', { auth: true }).then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <>
      <div><div className="eyebrow">Juegos y red</div><h1>Lo que hace volver a tus clientes</h1></div>
      <div className="grid2">
        <Meseros data={data} reload={load} toast={toast} />
        <Retos data={data} reload={load} toast={toast} />
        <Zona zone={data.zone} />
        <Sorteos draws={data.draws} />
      </div>
    </>
  );
}

function Meseros({ data, reload, toast }) {
  const [form, setForm] = useState({ name: '', code: '' });
  const [qr, setQr] = useState(null);
  async function add(e) {
    e.preventDefault();
    try { await api('/panel/waiters', { method: 'POST', body: form, auth: true }); setForm({ name: '', code: '' }); reload(); toast('Mesero agregado'); } catch (err) { toast(err.message); }
  }
  async function toggle(w) {
    try { await api(`/panel/waiters/${w.id}`, { method: 'PUT', body: { active: !w.active }, auth: true }); reload(); } catch (err) { toast(err.message); }
  }
  return (
    <section className="panel">
      <div className="section-title"><h3>Ranking de meseros</h3><span className="muted">inscritos en 30 días</span></div>
      {data.ranking.length === 0 && <p className="muted">Agrega a tus meseros: cada uno tiene un código y un QR propio, y los clientes que inscribe cuentan para su ranking.</p>}
      <div>
        {data.ranking.map((w, i) => (
          <div className="rank" key={w.id}>
            <span className="pos">{i + 1}</span>
            <div>
              <b>{w.name}</b> <span className="mono small">{w.code}</span>{!w.active && <span className="pill off">Inactivo</span>}
              <p className="muted small">{w.enrolled30d} inscritos en 30 días · {w.returned} volvieron · {cop(w.sales)} en compras</p>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="sm" onClick={() => setQr(qr === w.id ? null : w.id)}>{qr === w.id ? 'Ocultar QR' : 'Ver QR'}</button>
              <button className="sm" onClick={() => toggle(w)}>{w.active ? 'Pausar' : 'Activar'}</button>
            </div>
            {qr === w.id && (
              <div className="tagcard" style={{ gridColumn: '1 / -1' }}>
                <QrImage value={w.qrUrl} size={240} alt={`QR de ${w.name}`} />
                <span className="small">QR personal de {w.name}. Quien se inscriba con él queda a su nombre.</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <form className="row" onSubmit={add} style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '2 1 160px' }}><label htmlFor="w-name">Nombre</label><input id="w-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field" style={{ flex: '1 1 100px' }}><label htmlFor="w-code">Código</label><input id="w-code" className="mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={12} /></div>
        <button className="btn auto" disabled={form.name.length < 2 || form.code.length < 2}>Agregar</button>
      </form>
      <p className="muted small">Define con tu equipo el premio mensual del primer puesto. El ranking mide inscritos y, sobre todo, cuántos vuelven.</p>
    </section>
  );
}

function Retos({ data, reload, toast }) {
  const [f, setF] = useState({ title: '', kind: 'VISITS', target: 3, bonusPoints: 150, startsAt: today(), endsAt: plusDays(30) });
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  async function add(e) {
    e.preventDefault();
    try {
      await api('/panel/challenges', {
        method: 'POST', auth: true,
        body: { ...f, startsAt: `${f.startsAt}T00:00:00-05:00`, endsAt: `${f.endsAt}T23:59:59-05:00` }
      });
      setF({ ...f, title: '' }); reload(); toast('Reto creado');
    } catch (err) { toast(err.message); }
  }
  async function toggle(c) {
    try { await api(`/panel/challenges/${c.id}`, { method: 'PUT', body: { active: !c.active }, auth: true }); reload(); } catch (err) { toast(err.message); }
  }
  const targetLabel = f.kind === 'SPEND' ? 'Meta en pesos' : f.kind === 'STREAK_WEEKS' ? 'Semanas seguidas' : 'Número de visitas';
  return (
    <section className="panel">
      <h3>Retos</h3>
      {data.challenges.length === 0 && <p className="muted">Aún no hay retos. Un buen primer reto: tres visitas en el mes, con puntos extra.</p>}
      <div>
        {data.challenges.map((c) => (
          <div className="li" key={c.id}>
            <div>
              <b>{c.title}</b>
              {c.scope === 'ZONE' ? <span className="pill hi">Red{c.sponsorName ? ` · ${c.sponsorName}` : ''}</span> : !c.active && <span className="pill off">Pausado</span>}
              <p>{KIND[c.kind]}: {c.kind === 'SPEND' ? cop(c.target) : c.target} · +{c.bonusPoints} puntos · {fmtDate(c.startsAt)} a {fmtDate(c.endsAt)} · {c.completions} lo cumplieron</p>
            </div>
            {c.editable && <button className="sm" onClick={() => toggle(c)}>{c.active ? 'Pausar' : 'Activar'}</button>}
          </div>
        ))}
      </div>
      <form className="stack" onSubmit={add}>
        <div className="field"><label htmlFor="c-title">Nuevo reto</label><input id="c-title" placeholder="Ej. Tres almuerzos en octubre" value={f.title} onChange={set('title')} /></div>
        <div className="pair">
          <div className="field"><label htmlFor="c-kind">Tipo</label>
            <select id="c-kind" value={f.kind} onChange={set('kind')}>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="field"><label htmlFor="c-target">{targetLabel}</label><input id="c-target" type="number" min="1" value={f.target} onChange={set('target', true)} /></div>
        </div>
        <div className="pair">
          <div className="field"><label htmlFor="c-pts">Puntos extra</label><input id="c-pts" type="number" min="1" value={f.bonusPoints} onChange={set('bonusPoints', true)} /></div>
          <div className="field"><label htmlFor="c-end">Termina</label><input id="c-end" type="date" value={f.endsAt} onChange={set('endsAt')} /></div>
        </div>
        <button className="btn" disabled={f.title.length < 3}>Crear reto</button>
      </form>
    </section>
  );
}

function Zona({ zone }) {
  return (
    <section className="panel">
      <h3>Álbum de la zona</h3>
      {!zone ? (
        <p className="muted">Tu establecimiento aún no está en una zona del álbum. El equipo de Fácil asigna las zonas cuando hay suficientes locales cercanos en la red.</p>
      ) : (
        <>
          <div className="kv"><span>Zona</span><b>{zone.name}</b></div>
          <div className="kv"><span>Establecimientos en la página</span><b>{zone.restaurants.length}</b></div>
          <div className="kv"><span>Álbumes completos en la temporada</span><b>{zone.completions}</b></div>
          <div className="kv"><span>Completados en tu establecimiento</span><b>{zone.completedHere}</b></div>
          <div className="kv"><span>Premio de la página</span><b>{zone.rewardText}</b></div>
          <p className="muted small">Temporada del {fmtDate(zone.seasonStart)} al {fmtDate(zone.seasonEnd)}. Cuando un cliente completa la página en tu local, el premio se crea aquí y lo canjeas en caja.</p>
          <div className="chips">{zone.restaurants.map((n) => <span className="chip" key={n}>{n}</span>)}</div>
        </>
      )}
    </section>
  );
}

function Sorteos({ draws }) {
  return (
    <section className="panel">
      <h3>Factura premiada</h3>
      {draws.length === 0 ? (
        <p className="muted">No hay sorteos activos en tu zona. Los sorteos los opera Fácil con autorización de Coljuegos y premio de un patrocinador; cada compra validada en tu local da una boleta al cliente.</p>
      ) : draws.map((d) => (
        <div className="li" key={d.id}>
          <div>
            <b>{d.name}</b><span className={`pill ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
            <p>{d.prizeText}{d.sponsorName ? ` · premio de ${d.sponsorName}` : ''} · sorteo el {fmtDate(d.drawAt)}</p>
            <p>{d.ticketsHere} boletas desde tu local de {d.ticketsTotal} en toda la red · {d.authorization}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
