// App de caja: identificar al cliente (celular o pase), confirmar el monto, canjear premios y
// generar códigos para domicilios.
import { useState } from 'react';
import { api, getStaffSession, setStaffSession, cop, formatPhone } from '../api.js';
import Scanner from '../Scanner.jsx';
import { AppBar, Keypad, initials, useToast } from '../components.jsx';
import Login from '../Login.jsx';

export default function Caja() {
  const [session, setSession] = useState(getStaffSession());
  if (!session) return <Login title="Caja" onLogin={setSession} />;
  return <Pos session={session} onLogout={() => { setStaffSession(null); setSession(null); }} />;
}

function Pos({ session, onLogout }) {
  const [mode, setMode] = useState('cel'); // cel | pase | domicilio
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [customer, setCustomer] = useState(null); // perfil o { new: true, phone }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [toastNode, toast] = useToast();

  const reset = () => { setPhone(''); setAmount(''); setCustomer(null); setError(null); setDelivery(null); };
  const handle = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { if (e.status === 401) onLogout(); setError(e.message); } finally { setBusy(false); }
  };

  const lookupPhone = () => handle(async () => {
    const res = await api(`/staff/customers/lookup?phone=${phone}`, { auth: true });
    setCustomer(res.found ? res.customer : { new: true, phone: res.phone });
  });
  const lookupCard = (token) => handle(async () => {
    const res = await api(`/staff/customers/lookup?card=${encodeURIComponent(token)}`, { auth: true });
    setCustomer({ ...res.customer, viaPass: true });
    setMode('cel');
  });
  const confirm = () => handle(async () => {
    const body = customer.new
      ? { phone, amount: Number(amount) }
      : { customerId: customer.id, amount: Number(amount), door: customer.viaPass ? 'WALLET' : 'CASHIER' };
    const res = await api('/staff/purchases', { method: 'POST', body, auth: true });
    const who = res.customer.name ? res.customer.name.split(' ')[0] : 'Cliente';
    const ex = res.extras || {};
    const bonus = [
      ex.tickets?.length ? `${ex.tickets.length === 1 ? '1 boleta' : ex.tickets.length + ' boletas'} para la factura premiada` : null,
      ex.sticker?.isNew ? 'lámina nueva del álbum' : null,
      ...(ex.challenges || []).map((c) => `reto "${c.title}" (+${c.bonusPoints})`)
    ].filter(Boolean);
    toast(res.newCustomer
      ? `Compra sumada. ${who} recibirá su tarjeta por WhatsApp.`
      : `${who}: +${res.pointsAwarded} puntos y 1 sello${bonus.length ? ', ' + bonus.join(', ') : ''}.`);
    if (ex.albumCompleted) toast(`¡${who} completó el álbum ${ex.albumCompleted.zoneName}! Premio: ${ex.albumCompleted.rewardText}`);
    if (res.rewardUnlocked) toast(`¡Completó la tarjeta! Premio: ${res.rewardUnlocked.description}`);
    setCustomer(res.customer);
    setAmount('');
  });
  const redeem = (reward) => handle(async () => {
    await api(`/staff/rewards/${reward.id}/redeem`, { method: 'POST', auth: true });
    setCustomer((c) => ({ ...c, rewards: c.rewards.filter((x) => x.id !== reward.id) }));
    toast(`Premio canjeado: ${reward.description}`);
  });
  const makeCode = () => handle(async () => {
    setDelivery(await api('/staff/delivery-codes', { method: 'POST', body: { amount: Number(amount) }, auth: true }));
    setAmount('');
  });

  const target = mode === 'domicilio' || customer ? 'amount' : 'phone';
  function onKey(k) {
    if (k === 'Buscar') return phone.replace(/\D/g, '').length === 10 ? lookupPhone() : setError('Escribe los 10 dígitos del celular.');
    if (k === '000') return amount && amount.length <= 5 && setAmount(amount + '000');
    if (target === 'phone') setPhone((p) => (k === '⌫' ? p.slice(0, -1) : p.length < 10 ? p + k : p));
    else setAmount((a) => (k === '⌫' ? a.slice(0, -1) : a.length < 8 ? (a === '' && k === '0' ? a : a + k) : a));
  }

  return (
    <>
    <AppBar title={session.restaurant.name} subtitle={`Caja · ${session.staff.name}`}>
      <button className="sm on-dark" onClick={onLogout}>Salir</button>
    </AppBar>
    <main className="desk">

      <div className="grid2">
        <section className="panel">
          <div className="seg" role="group" aria-label="Acción">
            {[['cel', 'Número de celular'], ['pase', 'Escanear pase'], ['domicilio', 'Código domicilio']].map(([k, l]) => (
              <button key={k} aria-pressed={mode === k} onClick={() => { reset(); setMode(k); }}>{l}</button>
            ))}
          </div>

          {mode === 'pase' && !customer && (
            <>
              <Scanner kind="pass" onScan={lookupCard} onError={setError} />
              <p className="muted small">Pide al cliente que abra su tarjeta y apunta al código QR.</p>
            </>
          )}

          {(mode !== 'pase' || customer) && (
            <>
              <div className={`display ${(target === 'phone' ? phone : amount) ? '' : 'empty'}`} aria-live="polite">
                {target === 'phone' ? (phone ? formatPhone(phone) : 'Celular del cliente') : amount ? cop(Number(amount)) : mode === 'domicilio' ? 'Valor del pedido' : 'Monto de la compra'}
              </div>
              <Keypad onKey={onKey} action={target === 'phone' ? 'Buscar' : '000'} />
              {target === 'amount' && mode !== 'domicilio' && customer && (
                <button className="btn" disabled={busy || !amount} onClick={confirm}>{busy ? 'Confirmando…' : 'Confirmar compra'}</button>
              )}
              {mode === 'domicilio' && (
                <button className="btn" disabled={busy || !amount} onClick={makeCode}>Generar código para el empaque</button>
              )}
            </>
          )}
          {error && <div className="error" role="alert">{error}</div>}
        </section>

        <section className="panel" aria-live="polite">
          <div className="eyebrow">{mode === 'domicilio' ? 'Código de domicilio' : 'Ficha del cliente'}</div>
          {mode === 'domicilio' ? (
            delivery ? (
              <div className="stack center">
                <div className="bigcode">{delivery.code}</div>
                <p className="muted">Pedido de {cop(delivery.amount)} · vence el {new Date(delivery.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}</p>
                <p className="small">Escríbelo en el sticker del empaque. El cliente lo ingresa en su tarjeta para sumar la compra.</p>
              </div>
            ) : <p className="muted">Escribe el valor del pedido y genera un código de un solo uso para pegar en el empaque.</p>
          ) : !customer ? (
            <p className="muted">Busca el celular o escanea el pase para ver quién es, sus premios y qué ofrecerle.</p>
          ) : customer.new ? (
            <div className="stack">
              <div className="row"><div className="avatar">+</div><div><b style={{ fontSize: 18 }}>Cliente nuevo</b><div className="muted">{customer.phone}</div></div></div>
              <div className="suggest"><b>Primera compra:</b> al confirmarla, el cliente recibe por WhatsApp su tarjeta del Club con el primer sello y acepta allí la autorización de datos.</div>
              <button className="btn ghost" onClick={reset}>Atender a otro cliente</button>
            </div>
          ) : (
            <div className="stack">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className="avatar">{initials(customer.name)}</div>
                <div><b style={{ fontSize: 18 }}>{customer.name || 'Sin nombre'}</b>
                  <div className="muted">{customer.phone} · {customer.visits} visitas{customer.avgTicket ? ` · ticket ${cop(customer.avgTicket)}` : ''}</div></div>
              </div>
              <div className="panel" style={{ padding: '6px 14px', gap: 0 }}>
                <div className="kv"><span>Sellos</span><b>{customer.stamps}/{customer.stampsGoal}</b></div>
                <div className="kv"><span>Puntos</span><b>{customer.points.toLocaleString('es-CO')}</b></div>
              </div>
              {customer.tags.length > 0 && <div className="chips">{customer.tags.map((t) => <span className="chip hot" key={t}>{t}</span>)}</div>}
              {!customer.hasConsent && <div className="chips"><span className="chip">Aún no activa su tarjeta</span></div>}
              <div className="suggest"><b>Sugerencia:</b> {customer.suggestion}</div>
              {customer.rewards.map((rw) => (
                <div className="reward row between" key={rw.id}>
                  <span><b>{rw.kind === 'ALBUM' ? 'Premio del álbum' : rw.kind === 'BIRTHDAY' ? 'Cumpleaños' : 'Premio'}:</b> {rw.description}</span>
                  <button className="sm" disabled={busy} onClick={() => redeem(rw)}>Canjear</button>
                </div>
              ))}
              <button className="btn ghost" onClick={reset}>Atender a otro cliente</button>
            </div>
          )}
        </section>
      </div>
      {toastNode}
    </main>
    </>
  );
}
