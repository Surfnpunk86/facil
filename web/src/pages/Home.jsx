import { Mark } from '../components.jsx';

export default function Home({ notFound = false }) {
  return (
    <main className="mobile" style={{ justifyContent: 'center' }}>
      <div><Mark /></div>
      <h1>{notFound ? 'Esta página no existe' : 'Fidelización para restaurantes, bares, cafés y panaderías'}</h1>
      <p className="muted">
        {notFound
          ? 'Revisa el enlace o escanea de nuevo el código de la mesa.'
          : 'Tus clientes se identifican como prefieran, cada compra se valida y tu restaurante sabe quién vuelve y quién no.'}
      </p>
      <div className="stack">
        <a className="btn dark" href="/caja">Entrar a la caja</a>
        <a className="btn ghost" href="/panel">Entrar al panel del restaurante</a>
        <a className="btn ghost" href="/registro">Crear cuenta de restaurante</a>
      </div>
    </main>
  );
}
