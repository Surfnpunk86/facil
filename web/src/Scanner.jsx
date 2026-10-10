import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Lector de QR con la cámara trasera. Llama onScan una sola vez por lectura.
export default function Scanner({ onScan, onError }) {
  const id = useRef(`scan-${Math.random().toString(36).slice(2)}`).current;
  const done = useRef(false);
  useEffect(() => {
    const qr = new Html5Qrcode(id, { verbose: false });
    let started = false;
    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s }; } },
      (text) => {
        if (done.current) return;
        done.current = true;
        onScan(text);
      },
      () => {}
    ).then(() => { started = true; }).catch(() => onError?.('No pudimos abrir la cámara. Revisa el permiso de cámara del navegador.'));
    return () => { if (started) qr.stop().then(() => qr.clear()).catch(() => {}); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div id={id} className="scanner" />;
}
