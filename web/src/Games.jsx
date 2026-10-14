// Bloques de juegos en la tarjeta del cliente: racha, retos, álbum de la zona y factura premiada.
import { cop } from './api.js';

const fmtDate = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

export function StreakBlock({ streak }) {
  const n = streak.weeks;
  // Seis casillas: las semanas de la racha terminan en la semana actual (o la anterior si esta aún no tiene compra).
  const cells = Array.from({ length: 6 }, (_, i) => {
    const fromEnd = 5 - i; // 0 = casilla de esta semana
    const on = streak.activeThisWeek ? fromEnd < n : fromEnd >= 1 && fromEnd <= n;
    return { on, now: fromEnd === 0, label: fromEnd === 0 ? 'Hoy' : `-${fromEnd}` };
  });
  return (
    <section className="game black" aria-label="Racha semanal">
      <div className="section-title">
        <h3>{n > 0 ? `Racha de ${n} ${n === 1 ? 'semana' : 'semanas'}` : 'Empieza tu racha'}</h3>
        <span className="badge red">Red Fácil</span>
      </div>
      <div className="weeks">
        {cells.map((c, i) => <div key={i} className={`week ${c.on ? 'on' : ''} ${c.now ? 'now' : ''}`}>{c.label}</div>)}
      </div>
      <p className="muted">
        {streak.activeThisWeek
          ? 'Esta semana ya cuenta. Vuelve la próxima a cualquier establecimiento de la red para no romperla.'
          : n > 0 ? 'Haz una compra esta semana en cualquier establecimiento de la red para mantenerla.' : 'Cada semana con al menos una compra validada suma a tu racha.'}
      </p>
    </section>
  );
}

const kindText = (c) =>
  c.kind === 'SPEND' ? `${cop(c.value)} de ${cop(c.target)}` : c.kind === 'STREAK_WEEKS' ? `${c.value} de ${c.target} semanas` : `${c.value} de ${c.target} visitas`;

export function ChallengesBlock({ challenges }) {
  if (!challenges.length) return null;
  return (
    <section className="game" aria-label="Retos">
      <h3>Retos</h3>
      {challenges.map((c) => (
        <div className="chall" key={c.id}>
          <div className="top">
            <b>{c.title}</b>
            <span className={`badge ${c.done ? 'ok' : 'red'}`}>{c.done ? 'Cumplido' : `+${c.bonusPoints.toLocaleString('es-CO')} pts`}</span>
          </div>
          {c.description && <p className="muted">{c.description}</p>}
          <div className={`meter ${c.done ? 'ok' : ''}`}><i style={{ width: `${Math.min(100, (c.value / c.target) * 100)}%` }} /></div>
          <p className="muted small">
            {kindText(c)} · hasta el {fmtDate(c.endsAt)}{c.scope === 'ZONE' ? ' · en toda la zona' : ''}{c.sponsorName ? ` · con ${c.sponsorName}` : ''}
          </p>
        </div>
      ))}
    </section>
  );
}

export function AlbumBlock({ album }) {
  if (!album) return null;
  const got = album.stickers.filter((s) => s.collected).length;
  return (
    <section className="game" aria-label="Álbum">
      <div className="section-title">
        <h3>Álbum · {album.zoneName}</h3>
        <span className="muted num">{got}/{album.stickers.length}</span>
      </div>
      <div className="album">
        {album.stickers.map((s) => (
          <div key={s.slug} className={`sticker ${s.collected ? 'got' : ''} ${s.here ? 'here' : ''}`} title={s.collected ? 'Lámina conseguida' : 'Te falta esta lámina'}>
            <span className="initial" aria-hidden="true">{s.name.charAt(0)}</span>
            {s.name}
          </div>
        ))}
      </div>
      <p className="muted">
        {album.completed
          ? `Completaste la página. Tu premio: ${album.rewardText}.`
          : `Gana la lámina de cada establecimiento con una compra. Página completa: ${album.rewardText}. Temporada hasta el ${fmtDate(album.seasonEnd)}.`}
      </p>
    </section>
  );
}

export function DrawsBlock({ draws }) {
  if (!draws.length) return null;
  return (
    <>
      {draws.map((d) => (
        <section className="ticket" key={d.id} aria-label="Factura premiada">
          <div className="section-title"><span className="eyebrow" style={{ color: '#fff' }}>Factura premiada</span><span className="small">Sorteo el {fmtDate(d.drawAt)}</span></div>
          <h2 style={{ color: '#fff' }}>{d.prizeText}</h2>
          <div>{d.ticketCount ? `Tienes ${d.ticketCount} ${d.ticketCount === 1 ? 'boleta' : 'boletas'}.` : 'Cada compra validada en la red te da una boleta.'}{d.sponsorName ? ` Premio de ${d.sponsorName}.` : ''}</div>
          {d.lastNumbers.length > 0 && <div className="nums">{d.lastNumbers.map((n) => <span className="num" key={n}>N.º {String(n).padStart(5, '0')}</span>)}</div>}
          <div className="legal">
            {d.authorization}. Participan compras hasta el {fmtDate(d.endsAt)}.{' '}
            {d.termsUrl && <a href={d.termsUrl} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>Términos y condiciones</a>}
          </div>
        </section>
      ))}
    </>
  );
}

// Lo que ganó con la compra, además de puntos y sello.
export function ExtrasList({ extras }) {
  if (!extras) return null;
  const items = [];
  for (const t of extras.tickets) items.push({ k: `t${t.number}`, dot: 'N.º', text: <>Boleta <b className="mono">{String(t.number).padStart(5, '0')}</b> para {t.drawName}: {t.prizeText}</> });
  if (extras.sticker?.isNew) items.push({ k: 'st', dot: '+1', black: true, text: <>Lámina nueva: <b>{extras.sticker.restaurantName}</b> · llevas {extras.sticker.collected} de {extras.sticker.total} en {extras.sticker.zoneName}</> });
  if (extras.albumCompleted) items.push({ k: 'al', dot: '★', text: <>¡Completaste la página {extras.albumCompleted.zoneName}! Premio: <b>{extras.albumCompleted.rewardText}</b></> });
  for (const c of extras.challenges) items.push({ k: `c${c.title}`, dot: '✓', black: true, text: <>Reto cumplido: <b>{c.title}</b> · +{c.bonusPoints.toLocaleString('es-CO')} puntos{c.sponsorName ? ` con ${c.sponsorName}` : ''}</> });
  if (!items.length) return null;
  return (
    <div className="won">
      {items.map((i) => <div className="won-item" key={i.k}><span className={`dot ${i.black ? 'black' : ''}`}>{i.dot}</span><span>{i.text}</span></div>)}
    </div>
  );
}
