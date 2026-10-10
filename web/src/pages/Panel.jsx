// Panel del administrador del restaurante.
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, getStaffSession, setStaffSession, cop } from '../api.js';
import { Screen, AppBar, QrImage, useToast } from '../components.jsx';
import Juegos from './Juegos.jsx';
import Login from '../Login.jsx';

const DOOR_NAMES = { NFC: 'NFC', QR: 'QR', WHATSAPP: 'WhatsApp', WALLET: 'Pase de billetera', CASHIER: 'Celular en caja', DELIVERY_CODE: 'Código domicilio' };
const TABS = [['resumen', 'Resumen'], ['juegos', 'Juegos y red'], ['opiniones', 'Opiniones'], ['piezas', 'Piezas de mesa'], ['config', 'Configuración']];

export default function Panel() {
  const [session, setSession] = useState(getStaffSession());
  const logout = () => { setStaffSession(null); setSession(null); };
  if (!session) return <Login title="Panel del restaurante" onLogin={setSession} allowSignup />;
  if (session.staff.role !== 'OWNER') {
    return (
      <Screen><h1>Este usuario es de caja</h1><p className="muted">El panel es solo para el administrador del restaurante.</p>
        <Link className="btn dark" to="/caja">Ir a la caja</Link><button className="link" onClick={logout}>Entrar con otro usuario</button></Screen>
    );
  }
  return <Dashboard session={session} onLogout={logout} />;
}

function useLoad(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    api(path, { auth: true }).then(setData).catch((e) => setError(e.message));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return [data, error, load, setData];
}

function Dashboard({ session, onLogout }) {
  const [tab, setTab] = useState('resumen');
  const [toastNode, toast] = useToast();
  return (
    <>
    <AppBar title={session.restaurant.name} subtitle="Panel del restaurante">
      <nav className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      <button className="sm on-dark" onClick={onLogout}>Salir</button>
    </AppBar>
    <main className="desk">
      {tab === 'resumen' && <Resumen toast={toast} />}
      {tab === 'juegos' && <Juegos toast={toast} />}
      {tab === 'opiniones' && <Opiniones toast={toast} />}
      {tab === 'piezas' && <Piezas toast={toast} />}
      {tab === 'config' && <Config toast={toast} />}
      {toastNode}
    </main>
    </>
  );
}

function Resumen({ toast }) {
  const [s, err] = useLoad('/panel/summary?days=30');
  const [doors] = useLoad('/panel/doors?days=30');
  const [risk, , , setRisk] = useLoad('/panel/at-risk');
  const [autos, , , setAutos] = useLoad('/panel/automations');

  async function invite(c) {
    try {
      await api(`/panel/customers/${c.id}/invite`, { method: 'POST', auth: true });
      setRisk((r) => ({ customers: r.customers.map((x) => (x.id === c.id ? { ...x, lastInvitedAt: new Date().toISOString() } : x)) }));
      toast(`Invitación enviada a ${c.name.split(' ')[0]} por WhatsApp`);
    } catch (e) { toast(e.message); }
  }
  async function toggle(a, enabled) {
    try {
      await api(`/panel/automations/${a.key}`, { method: 'PUT', body: { enabled }, auth: true });
      setAutos((x) => ({ automations: x.automations.map((y) => (y.key === a.key ? { ...y, enabled } : y)) }));
      toast(`${a.title}: ${enabled ? 'activado' : 'desactivado'}`);
    } catch (e) { toast(e.message); }
  }

  if (err) return <div className="error">{err}</div>;
  if (!s) return <p className="muted">Cargando…</p>;
  const maxDoor = Math.max(1, ...(doors?.doors || []).map((d) => d.purchases));
  const recentInvite = (d) => d && Date.now() - new Date(d).getTime() < 7 * 86400000;

  return (
    <>
      <div className="row between">
        <div><div className="eyebrow">Últimos {s.days} días</div><h1>Así va tu Club</h1></div>
      </div>
      <div className="kpis">
        <div className="kpi"><small>Clientes inscritos</small><b>{s.enrolled.toLocaleString('es-CO')}</b><span>+{s.newMembers} en el periodo</span></div>
        <div className="kpi"><small>Ventas validadas del Club</small><b>{cop(s.validatedSales)}</b><span>{s.purchases} compras · ticket {cop(s.avgTicket)}</span></div>
        <div className="kpi"><small>Visitas por cliente activo</small><b>{s.visitsPerActive.toLocaleString('es-CO')}</b><span>{s.activeMembers} clientes compraron</span></div>
        <div className="kpi"><small>En riesgo de no volver</small><b>{s.atRisk}</b><span>{s.atRiskHigh} de alto valor</span></div>
      </div>
      <div className="grid2">
        <section className="panel">
          <div className="row between"><h3>Compras por puerta de entrada</h3><span className="muted">{s.purchases} validadas</span></div>
          <div className="bars">
            {(doors?.doors || []).map((d) => (
              <div className="bar" key={d.door}>
                <span>{DOOR_NAMES[d.door]}</span>
                <div className="track"><div className={`fill ${d.door === 'NFC' ? 'alt' : ''}`} style={{ width: `${(d.purchases / maxDoor) * 100}%` }} /></div>
                <em>{d.purchases}</em>
              </div>
            ))}
          </div>
          <p className="muted small">Todas las puertas distintas a NFC son clientes que con un sistema solo NFC no estarían en tu Club.</p>
        </section>
        <section className="panel">
          <div className="row between"><h3>Clientes para invitar</h3><span className="muted">ordenados por lo que han gastado</span></div>
          {!risk ? <p className="muted">Cargando…</p> : risk.customers.length === 0 ? <p className="muted">Nadie en riesgo por ahora.</p> : (
            <div>
              {risk.customers.slice(0, 12).map((c) => (
                <div className="li" key={c.id}>
                  <div>
                    <b>{c.name}</b><span className={`pill ${c.level === 'ALTO' ? 'hi' : 'md'}`}>{c.level === 'ALTO' ? 'Alto valor' : 'Medio'}</span>
                    <p>{c.visits} visitas · ticket {cop(c.avgTicket)} · {c.daysSince} días sin venir</p>
                  </div>
                  {!c.canMessage ? <span className="muted small">Sin autorización</span>
                    : recentInvite(c.lastInvitedAt) ? <button className="sm done" disabled>Invitado</button>
                    : <button className="sm" onClick={() => invite(c)}>Invitar</button>}
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h3>Mensajes automáticos</h3>
          {autos?.automations.map((a) => (
            <div className="li" key={a.key}>
              <div><b>{a.title}</b><p>{a.detail}</p></div>
              <label className="switch"><input type="checkbox" id={`auto-${a.key}`} checked={a.enabled} onChange={(e) => toggle(a, e.target.checked)} aria-label={a.title} /><span /></label>
            </div>
          ))}
          <p className="muted small">Se envían por WhatsApp solo a clientes que autorizaron sus datos.</p>
        </section>
        <section className="panel">
          <h3>Premios</h3>
          <div className="kv"><span>Premios canjeados en el periodo</span><b>{s.rewardsRedeemed}</b></div>
          <div className="kv"><span>Premio de la tarjeta</span><b>{s.restaurant.rewardText}</b></div>
          <div className="kv"><span>Sellos para completarla</span><b>{s.restaurant.stampsGoal}</b></div>
        </section>
      </div>
    </>
  );
}

function Opiniones({ toast }) {
  const [data, err, , setData] = useLoad('/panel/feedback');
  async function handled(f) {
    try {
      await api(`/panel/feedback/${f.id}/handled`, { method: 'POST', auth: true });
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === f.id ? { ...x, handledAt: new Date().toISOString() } : x)) }));
    } catch (e) { toast(e.message); }
  }
  if (err) return <div className="error">{err}</div>;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <section className="panel">
      <div className="row between">
        <h2>Opiniones de tus clientes</h2>
        <span className="muted">{data.average30d ? `${data.average30d.toLocaleString('es-CO')} ★ promedio en 30 días · ${data.count30d} opiniones` : 'Sin opiniones en 30 días'}</span>
      </div>
      {data.items.length === 0 && <p className="muted">Aún no hay opiniones.</p>}
      {data.items.map((f) => (
        <div className="li" key={f.id}>
          <div>
            <b>{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</b>
            {f.rating <= 3 && !f.handledAt && <span className="pill hi">Por atender</span>}
            {f.handledAt && <span className="pill ok">Atendida</span>}
            <p>{f.comment || 'Sin comentario'} · {f.customer ? `${f.customer.name || 'Cliente'} (${f.customer.phone})` : 'Anónimo'} · {f.daysAgo === 0 ? 'hoy' : `hace ${f.daysAgo} días`}</p>
          </div>
          {f.rating <= 3 && !f.handledAt && <button className="sm" onClick={() => handled(f)}>Marcar atendida</button>}
        </div>
      ))}
    </section>
  );
}

function Piezas({ toast }) {
  const [data, err, reload] = useLoad('/panel/tags');
  const [code, setCode] = useState('');
  async function add(e) {
    e.preventDefault();
    try {
      await api('/panel/tags', { method: 'POST', body: { code, label: code.replace('-', ' ') }, auth: true });
      setCode(''); reload(); toast('Pieza creada');
    } catch (e2) { toast(e2.message); }
  }
  if (err) return <div className="error">{err}</div>;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <section className="panel">
      <div className="stack" style={{ gap: 4 }}>
        <h2>Piezas de mesa y caja</h2>
        <p className="muted">Cada pieza lleva un chip NFC y un QR impreso. Graba en el chip la URL NFC y usa el QR de abajo para la impresión.</p>
      </div>
      <form className="row" onSubmit={add}>
        <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="newtag">Nuevo código (ej. MESA-9)</label>
          <input id="newtag" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} pattern="[A-Za-z0-9-]{2,20}" /></div>
        <button className="btn auto" style={{ alignSelf: 'flex-end' }} disabled={code.length < 2}>Crear pieza</button>
      </form>
      <div className="tags">
        {data.tags.map((t) => (
          <div className="tagcard" key={t.id}>
            <QrImage value={t.qrUrl} size={240} alt={`QR de ${t.code}`} />
            <b>{t.label || t.code}</b>
            <span className="mono small">{t.code}</span>
            <button className="sm" onClick={() => navigator.clipboard?.writeText(t.nfcUrl).then(() => toast('URL NFC copiada')).catch(() => toast(t.nfcUrl))}>Copiar URL NFC</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Config({ toast }) {
  const [data, err] = useLoad('/panel/settings');
  const [f, setF] = useState(null);
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  if (err) return <div className="error">{err}</div>;
  if (!f) return <p className="muted">Cargando…</p>;
  const set = (k, num) => (e) => setF((x) => ({ ...x, [k]: num ? Number(e.target.value) : e.target.value }));
  async function save(e) {
    e.preventDefault();
    try {
      const body = {
        name: f.name, pointsPerThousand: f.pointsPerThousand, stampsGoal: f.stampsGoal, rewardText: f.rewardText,
        birthdayRewardText: f.birthdayRewardText, googleReviewUrl: f.googleReviewUrl || null, ownerAlertPhone: f.ownerAlertPhone || null,
        maxClaimsPerDay: f.maxClaimsPerDay, invoiceMaxAgeHours: f.invoiceMaxAgeHours
      };
      const res = await api('/panel/settings', { method: 'PUT', body, auth: true });
      setF(res.settings); toast('Configuración guardada');
    } catch (e2) { toast(e2.message); }
  }
  const field = (k, label, props = {}) => (
    <div className="field"><label htmlFor={`cfg-${k}`}>{label}</label><input id={`cfg-${k}`} value={f[k] ?? ''} onChange={set(k, props.type === 'number')} {...props} /></div>
  );
  return (
    <form className="panel" onSubmit={save} style={{ maxWidth: 640 }}>
      <h2>Reglas del Club</h2>
      {field('name', 'Nombre del restaurante')}
      <div className="pair">
        {field('pointsPerThousand', 'Puntos por cada $1.000', { type: 'number', min: 0, max: 100 })}
        {field('stampsGoal', 'Sellos para el premio', { type: 'number', min: 2, max: 20 })}
      </div>
      {field('rewardText', 'Premio al completar la tarjeta')}
      {field('birthdayRewardText', 'Regalo de cumpleaños')}
      <div className="pair">
        {field('maxClaimsPerDay', 'Compras por cliente al día', { type: 'number', min: 1, max: 10 })}
        {field('invoiceMaxAgeHours', 'Antigüedad máxima de factura (horas)', { type: 'number', min: 1, max: 720 })}
      </div>
      {field('googleReviewUrl', 'Enlace para reseñas en Google', { type: 'url', placeholder: 'https://g.page/r/…/review' })}
      {field('ownerAlertPhone', 'WhatsApp para alertas de calificaciones bajas', { placeholder: '+573001112233' })}
      <p className="muted small">NIT registrado: <span className="mono">{f.nit}</span>. Las facturas con otro NIT no suman puntos.</p>
      <button className="btn auto">Guardar</button>
    </form>
  );
}
