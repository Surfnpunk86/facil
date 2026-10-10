// Entrada de la versión de revisión: la misma app, con navegación en memoria y una barra para saltar entre vistas.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import '../styles.css';
import './demo.css';
import Home from '../pages/Home.jsx';
import Entry from '../pages/Entry.jsx';
import Card from '../pages/Card.jsx';
import Caja from '../pages/Caja.jsx';
import Panel from '../pages/Panel.jsx';
import { resetDemo, clearDemoStorage, setStaffSession, getStaffSession, demoSession } from './api.js';

resetDemo();
clearDemoStorage();

const VIEWS = [
  { key: 'home', label: 'Inicio', path: '/' },
  { key: 'entry', label: 'Cliente nuevo en la mesa', path: '/r/arepa-y-brasa?t=MESA-7&via=nfc&m=LUIS', prep: () => clearDemoStorage() },
  { key: 'card', label: 'Tarjeta de un cliente', path: '/c/demo-valentina' },
  { key: 'caja', label: 'Caja', path: '/caja' },
  { key: 'panel', label: 'Panel del restaurante', path: '/panel' }
];

function ReviewBar() {
  const navigate = useNavigate();
  const loc = useLocation();
  const current = loc.pathname === '/' ? 'home' : loc.pathname.startsWith('/r/') ? 'entry' : loc.pathname.startsWith('/c/') ? 'card' : loc.pathname.slice(1);
  async function go(v) {
    if (v.prep) await v.prep();
    navigate(v.path, { replace: false });
    window.scrollTo(0, 0);
  }
  function reset() {
    resetDemo();
    clearDemoStorage();
    navigate('/');
    window.scrollTo(0, 0);
  }
  return (
    <nav className="review-bar" aria-label="Vistas de la revisión">
      <span className="review-tag">Revisión · datos de ejemplo</span>
      <div className="review-views">
        {VIEWS.map((v) => (
          <button key={v.key} type="button" aria-current={current === v.key ? 'page' : undefined} onClick={() => go(v)}>{v.label}</button>
        ))}
        <button type="button" className="review-reset" onClick={reset}>Reiniciar datos</button>
      </div>
    </nav>
  );
}

// En la revisión no se pide ingreso: la caja y el panel abren con la sesión de ejemplo que les corresponde.
function AsRole({ role, children }) {
  const current = getStaffSession();
  if (current?.staff?.role !== role) setStaffSession(demoSession(role));
  return children;
}

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <div className="review-app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:slug" element={<Entry />} />
          <Route path="/c/:token" element={<Card />} />
          <Route path="/caja" element={<AsRole role="CASHIER"><Caja /></AsRole>} />
          <Route path="/panel" element={<AsRole role="OWNER"><Panel /></AsRole>} />
          <Route path="*" element={<Home notFound />} />
        </Routes>
      </div>
      <ReviewBar />
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
