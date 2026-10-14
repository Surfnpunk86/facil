// Autenticación del personal (caja y dueño) con JWT en el encabezado Authorization.
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { HttpError } from './lib/util.js';

export function signStaff(staff) {
  return jwt.sign({ sub: staff.id, rid: staff.restaurantId, role: staff.role }, config.jwtSecret, { expiresIn: '12h' });
}

export function requireStaff(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'unauthorized', 'Inicia sesión para continuar.'));
  try {
    const p = jwt.verify(token, config.jwtSecret);
    req.staff = { id: p.sub, restaurantId: p.rid, role: p.role };
    next();
  } catch {
    next(new HttpError(401, 'session_expired', 'Tu sesión venció. Vuelve a iniciar sesión.'));
  }
}

export function requireOwner(req, _res, next) {
  if (req.staff?.role !== 'OWNER') return next(new HttpError(403, 'forbidden', 'Solo el administrador del establecimiento puede ver esto.'));
  next();
}
