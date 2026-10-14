import { Link } from 'react-router-dom';
import { Mark } from '../components.jsx';

export default function Home({ notFound = false }) {
  return (
    <div className="hero">
      <div className="hero-top"><Mark size="xl" /></div>
      <main className="mobile">
        <h1>{notFound ? 'Esta página no existe' : 'Cada compra cuenta. En toda la red.'}</h1>
        <p className="muted" style={{ fontSize: 15 }}>
          {notFound
            ? 'Revisa el enlace o escanea de nuevo el código de la mesa.'
            : 'Fidelización para restaurantes, bares, cafés y panaderías: puntos, sellos, álbum, retos y factura premiada sobre compras validadas.'}
        </p>
        <div className="stack">
          <Link className="btn" to="/caja">Entrar a la caja</Link>
          <Link className="btn ghost" to="/panel">Entrar al panel del establecimiento</Link>
          <Link className="btn ghost" to="/registro">Crear cuenta del establecimiento</Link>
        </div>
      </main>
    </div>
  );
}
