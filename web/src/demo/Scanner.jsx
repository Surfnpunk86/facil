// En la versión de revisión no hay cámara: el escáner muestra un visor de ejemplo y un botón que simula la lectura.
import { demoInvoiceQr } from './api.js';

export default function Scanner({ kind = 'invoice', onScan }) {
  const isPass = kind === 'pass';
  return (
    <div className="scanner demo-scanner">
      <div className="demo-viewfinder" aria-hidden="true"><span /></div>
      <p>{isPass ? 'Aquí se abre la cámara para leer el código de la tarjeta del cliente.' : 'Aquí se abre la cámara para leer el QR de la factura electrónica.'}</p>
      <button type="button" className="btn" onClick={() => onScan(isPass ? 'demo-valentina' : demoInvoiceQr())}>
        {isPass ? 'Simular lectura del pase de Valentina' : 'Simular escaneo de la factura'}
      </button>
    </div>
  );
}
