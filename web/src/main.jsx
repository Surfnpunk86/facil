import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles.css';

// Cada vista carga su propio código: el cliente en la mesa no descarga la caja ni el panel.
const Home = lazy(() => import('./pages/Home.jsx'));
const Entry = lazy(() => import('./pages/Entry.jsx'));
const Card = lazy(() => import('./pages/Card.jsx'));
const Caja = lazy(() => import('./pages/Caja.jsx'));
const Panel = lazy(() => import('./pages/Panel.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Forgot = lazy(() => import('./pages/Forgot.jsx'));
const Reset = lazy(() => import('./pages/Reset.jsx'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<main className="mobile"><p className="muted">Cargando…</p></main>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:slug" element={<Entry />} />
          <Route path="/c/:token" element={<Card />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/olvide" element={<Forgot />} />
          <Route path="/restablecer" element={<Reset />} />
          <Route path="*" element={<Home notFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
);
