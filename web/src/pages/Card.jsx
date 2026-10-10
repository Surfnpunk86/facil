// Tarjeta del cliente: /c/:token. Aquí se suma la compra (QR de la factura o código de domicilio),
// se ven los premios y se califica la visita.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, saveCard, cop } from '../api.js';
import Scanner from '../Scanner.jsx';
import { Screen, Pass, Stars, CheckIcon, useToast } from '../components.jsx';
import { StreakBlock, ChallengesBlock, AlbumBlock, DrawsBlock, ExtrasList } from '../Games.jsx';

const VIA = { nfc: 'NFC', qr: 'QR', wa: 'WHATSAPP', wallet: 'WALLET' };

export default function Card() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const door = VIA[params.get('via')] || 'QR';
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('home'); // home | scan | code | done | rate | thanks | optout
  const [result, setResult] = useState(null);
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [toastNode, toast] = useToast();

  useEffect(() => {
    api(`/c/${token}`)
      .then((c) => { setCard(c); saveCard(c.restaurant.slug, c.token); })
      .catch((e) => setError(e.message));
  }, [token]);

  async function claim(path, body) {
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/c/${token}/${path}`, { method: 'POST', body });
      setCard(res.card);
      setResult(res);
      setView('done');
    } catch (e) {
      setError(e.message);
      setView('home');
    } finally {
      setBusy(false);
    }
  }

  async function acceptConsent() {
    if (!consent) return toast('Marca la autorización para activar tu tarjeta.');
    try { setCard(await api(`/c/${token}/consent`, { method: 'POST', body: {} })); toast('Tarjeta activada'); } catch (e) { toast(e.message); }
  }

  async function sendRating() {
    setBusy(true);
    try {
      const res = await api(`/c/${token}/feedback`, { method: 'POST', body: { rating, comment: comment || undefined } });
      setResult((r) => ({ ...r, googleReviewUrl: res.googleReviewUrl }));
      setView('thanks');
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  async function optOut() {
    try { await api(`/c/${token}/optout`, { method: 'POST' }); setView('optout'); } catch (e) { toast(e.message); }
  }

  if (!card) {
    return <Screen>{error ? <div className="error">{error}</div> : <p className="muted">Cargando tu tarjeta…</p>}</Screen>;
  }
  const r = card.restaurant;

  if (view === 'scan') {
    return (
      <Screen title={r.name} subtitle="Tu tarjeta del Club">
        <button className="link" onClick={() => setView('home')}>← Volver</button>
        <h2>Escanea el QR de tu factura</h2>
        <p className="muted">Apunta al código de la factura electrónica o del tiquete POS. Leemos el total y confirmamos que sea de {r.name}.</p>
        <Scanner kind="invoice" onScan={(text) => claim('invoice', { qr: text, door })} onError={(m) => { setError(m); setView('home'); }} />
        {busy && <p className="muted center">Validando tu compra…</p>}
        <p className="muted small">¿Tu factura no tiene código QR? Pide en caja que confirmen tu compra con tu número de celular.</p>
      </Screen>
    );
  }

  if (view === 'code') {
    return (
      <Screen title={r.name} subtitle="Tu tarjeta del Club">
        <button className="link" onClick={() => setView('home')}>← Volver</button>
        <h2>Código de tu domicilio</h2>
        <p className="muted">Está en el sticker del empaque o en la factura de tu pedido.</p>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); claim('code', { code }); }}>
          <div className="field">
            <label htmlFor="code">Código</label>
            <input id="code" className="mono" style={{ fontSize: 20, letterSpacing: '.12em', textTransform: 'uppercase' }} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={10} autoComplete="off" />
          </div>
          <button className="btn" disabled={busy || code.length < 4}>{busy ? 'Validando…' : 'Sumar puntos'}</button>
        </form>
      </Screen>
    );
  }

  if (view === 'done' && result) {
    return (
      <Screen title={r.name} subtitle="Tu tarjeta del Club">
        <div className="success">
          <div className="ring"><CheckIcon /></div>
          <h1>¡Compra validada!</h1>
          <p className="muted">+{result.pointsAwarded} puntos y un sello nuevo</p>
        </div>
        <ExtrasList extras={result.extras} />
        {result.rewardUnlocked && (
          <div className="reward"><b>Completaste tu tarjeta.</b> Ganaste: {result.rewardUnlocked.description}. Muéstrala en caja para reclamarlo.</div>
        )}
        <Pass card={card} justStamped />
        <div className="panel" style={{ gap: 0, padding: '8px 16px' }}>
          <div className="kv"><span>Compra</span><b>{cop(result.amount)}</b></div>
          {result.invoiceNumber && <div className="kv"><span>Factura</span><b className="mono">{result.invoiceNumber}</b></div>}
          <div className="kv"><span>Te faltan para el premio</span><b>{r.stampsGoal - card.stamps} sellos</b></div>
        </div>
        <button className="btn dark" onClick={() => setView('rate')}>Cuéntanos cómo te fue</button>
        <button className="link" onClick={() => setView('home')}>Volver a mi tarjeta</button>
        {toastNode}
      </Screen>
    );
  }

  if (view === 'rate') {
    return (
      <Screen title={r.name} subtitle="Tu tarjeta del Club">
        <h1>¿Cómo te fue hoy en {r.name}?</h1>
        <Stars value={rating} onChange={setRating} />
        {rating > 0 && rating <= 3 && (
          <div className="field">
            <label htmlFor="comment">¿Qué pasó? El administrador lo lee hoy mismo</label>
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          </div>
        )}
        <button className="btn" disabled={!rating || busy} onClick={sendRating}>Enviar</button>
        <button className="link" onClick={() => setView('home')}>Ahora no</button>
        {toastNode}
      </Screen>
    );
  }

  if (view === 'thanks') {
    return (
      <Screen title={r.name} subtitle="Tu tarjeta del Club">
        <h1>¡Gracias por contarnos!</h1>
        <p className="muted">
          {rating >= 4 ? 'Si quieres, cuéntalo también en Google: les ayuda a otros a encontrarnos.' : 'Tu comentario ya le llegó al administrador. También puedes dejar tu opinión en Google.'}
        </p>
        {result?.googleReviewUrl && <a className={`btn ${rating >= 4 ? '' : 'ghost'}`} href={result.googleReviewUrl} target="_blank" rel="noreferrer">Dejar mi reseña en Google</a>}
        <button className="link" onClick={() => setView('home')}>Volver a mi tarjeta</button>
      </Screen>
    );
  }

  if (view === 'optout') {
    return (
      <Screen title={r.name} subtitle="Tu tarjeta del Club">
        <h1>Listo, no te enviaremos más promociones</h1>
        <p className="muted">Tu tarjeta y tus puntos siguen activos. Puedes volver a activar los mensajes aceptando la autorización en tu tarjeta.</p>
        <button className="link" onClick={() => setView('home')}>Volver a mi tarjeta</button>
      </Screen>
    );
  }

  return (
    <Screen title={r.name} subtitle="Tu tarjeta del Club">
      {params.get('nuevo') && <div className="note"><b>¡Bienvenido al Club!</b> Tu tarjeta quedó lista. Suma la compra de hoy escaneando el QR de tu factura cuando pagues.</div>}
      {card.needsConsent && (
        <div className="panel">
          <h3>Activa tu tarjeta</h3>
          <label className="check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Autorizo a {r.name} a tratar mis datos para el programa de fidelización y a escribirme por WhatsApp, según la Ley 1581 de 2012.</span>
          </label>
          <button className="btn" onClick={acceptConsent}>Activar</button>
        </div>
      )}
      <Pass card={card} />
      {card.rewards.map((rw) => (
        <div className="reward" key={rw.id}>
          <b>{rw.kind === 'BIRTHDAY' ? 'Regalo de cumpleaños' : rw.kind === 'ALBUM' ? 'Premio del álbum' : 'Premio listo'}:</b> {rw.description}.
          {rw.expiresAt && <> Válido hasta el {new Date(rw.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}.</>} Muestra esta tarjeta en caja.
        </div>
      ))}
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" onClick={() => { setError(null); setView('scan'); }}>Escanear mi factura</button>
      <button className="btn ghost" onClick={() => { setError(null); setView('code'); }}>Tengo un código de domicilio</button>
      {card.games && (
        <>
          <DrawsBlock draws={card.games.draws} />
          <StreakBlock streak={card.games.streak} />
          <ChallengesBlock challenges={card.games.challenges} />
          <AlbumBlock album={card.games.album} />
        </>
      )}
      {card.googleWalletUrl && <a className="btn dark" href={card.googleWalletUrl} target="_blank" rel="noreferrer">Guardar en Google Wallet</a>}
      <p className="muted small">¿Estás en caja? Muestra el código de tu tarjeta o di tu número y el cajero suma tu compra. Guarda esta página en tu pantalla de inicio para tenerla a mano.</p>
      <button className="link small" onClick={optOut}>No quiero recibir promociones</button>
      {toastNode}
    </Screen>
  );
}
