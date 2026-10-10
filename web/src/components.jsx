import { useEffect, useRef, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import logoUrl from './assets/logo-facil-wide.jpg';

export function Mark({ size = '' }) {
  return <Link className="logo-link" to="/" aria-label="Fácil, inicio"><img className={`logo-img ${size}`} src={logoUrl} alt="Fácil" /></Link>;
}

// Barra superior negra con el logo rojo. `narrow` la ajusta al ancho de las vistas de celular.
export function AppBar({ narrow = false, title, subtitle, children }) {
  return (
    <header className={`appbar ${narrow ? 'narrow' : ''}`}>
      <div className="appbar-in">
        <Mark />
        {(title || subtitle) && <div className="ctx">{title && <b>{title}</b>}{subtitle}</div>}
        {children && <div className="end">{children}</div>}
      </div>
    </header>
  );
}

export function initials(name) {
  return (name || '?').split(/\s+/).filter((w) => /\p{L}/u.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

export function Venue({ restaurant, subtitle = 'Club de clientes' }) {
  return (
    <div className="venue">
      <div className="logo" aria-hidden="true">{initials(restaurant?.name)}</div>
      <div><b>{restaurant?.name}</b><span className="muted">{subtitle}</span></div>
    </div>
  );
}

export function QrImage({ value, size = 240, alt = 'Código QR' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then((u) => alive && setSrc(u)).catch(() => {});
    return () => { alive = false; };
  }, [value, size]);
  return src ? <img src={src} alt={alt} width={size} height={size} /> : null;
}

export function Pass({ card, justStamped = false }) {
  const goal = card.restaurant.stampsGoal;
  return (
    <div className="pass">
      <div className="row between">
        <b style={{ fontSize: 17 }}>{card.restaurant.name}</b>
        <img className="brand" src={logoUrl} alt="" aria-hidden="true" />
      </div>
      <div className="row between">
        <div><small>Puntos</small><div className="big">{card.points.toLocaleString('es-CO')}</div></div>
        <div style={{ textAlign: 'right' }}><small>Sellos</small><div className="big">{card.stamps}/{goal}</div></div>
      </div>
      <div className="stamps" style={{ gridTemplateColumns: `repeat(${goal}, 1fr)` }} aria-label={`${card.stamps} de ${goal} sellos`}>
        {Array.from({ length: goal }, (_, i) => (
          <div key={i} className={`stamp ${i < card.stamps ? 'on' : ''} ${justStamped && i === card.stamps - 1 ? 'new' : ''}`} />
        ))}
      </div>
      <div className="row between" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
        <div style={{ fontSize: 13, lineHeight: 1.35 }}>
          Al completar {goal}: {card.restaurant.rewardText}
          <br /><span style={{ opacity: .85 }}>{card.name || 'Miembro del Club'} · ···{card.phoneLast4}</span>
        </div>
        <div className="qrbox"><QrImage value={card.token} size={160} alt="Código de tu tarjeta para mostrar en caja" /></div>
      </div>
    </div>
  );
}

export function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;
}

export function Stars({ value, onChange }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} estrellas`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [node, show];
}

export function Keypad({ onKey, action }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', action];
  return (
    <div className="keypad">
      {keys.map((k) => <button key={k} type="button" onClick={() => onKey(k)}>{k}</button>)}
    </div>
  );
}

// Pantalla de celular con la barra negra y el logo arriba.
export function Screen({ title, subtitle, children }) {
  return (
    <>
      <AppBar narrow title={title} subtitle={subtitle} />
      <main className="mobile">{children}</main>
    </>
  );
}
