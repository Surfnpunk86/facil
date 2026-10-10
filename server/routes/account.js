// Cuenta del restaurante: crear cuenta (registro), olvidé mi contraseña y restablecerla.
// Las rutas viven bajo /api/auth, así que comparten el límite de intentos del login.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { signStaff } from '../auth.js';
import { HttpError, normalizePhone, onlyDigits } from '../lib/util.js';
import { publicRestaurant } from '../lib/customers.js';
import { sendMail } from '../lib/mail.js';

const r = Router();

const password = z.string().min(10, 'La contraseña debe tener al menos 10 caracteres.').max(100);

function slugify(name) {
  const base = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' y ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 34);
  return base.length >= 3 ? base : `restaurante-${base || 'nuevo'}`.slice(0, 34);
}

async function freeSlug(name) {
  const base = slugify(name);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await prisma.restaurant.findUnique({ where: { slug } }))) return slug;
  }
  throw new HttpError(409, 'slug_taken', 'No pudimos asignar una dirección para tu restaurante. Intenta con otro nombre.');
}

r.post('/auth/register', async (req, res) => {
  if (!config.allowSignup) throw new HttpError(403, 'signup_closed', 'El registro está cerrado. Pide acceso al administrador de Fácil.');
  const body = z
    .object({
      restaurantName: z.string().trim().min(2, 'Escribe el nombre del restaurante.').max(80),
      nit: z.string().transform(onlyDigits).pipe(z.string().min(6, 'El NIT debe tener al menos 6 dígitos.').max(12)),
      city: z.string().trim().max(60).optional(),
      name: z.string().trim().min(2, 'Escribe tu nombre.').max(80),
      email: z.string().trim().email('Escribe un correo válido.'),
      password,
      phone: z.string().optional()
    })
    .parse(req.body || {});
  const email = body.email.toLowerCase();
  if (await prisma.staff.findUnique({ where: { email } })) {
    throw new HttpError(409, 'email_taken', 'Ya existe una cuenta con este correo. Inicia sesión o restablece tu contraseña.');
  }
  const phone = body.phone ? normalizePhone(body.phone) : null;
  if (body.phone && !phone) throw new HttpError(400, 'invalid_phone', 'Escribe los 10 dígitos del celular.');

  const slug = await freeSlug(body.restaurantName);
  const restaurant = await prisma.restaurant.create({
    data: { slug, name: body.restaurantName, nit: body.nit, city: body.city || null, ownerAlertPhone: phone }
  });
  await prisma.tag.createMany({
    data: [
      ...Array.from({ length: 10 }, (_, i) => ({ restaurantId: restaurant.id, code: `MESA-${i + 1}`, label: `Mesa ${i + 1}` })),
      { restaurantId: restaurant.id, code: 'CAJA-1', label: 'Mostrador' }
    ]
  });
  const staff = await prisma.staff.create({
    data: { restaurantId: restaurant.id, name: body.name, email, passwordHash: await bcrypt.hash(body.password, 10), role: 'OWNER' }
  });
  res.status(201).json({ token: signStaff(staff), staff: { name: staff.name, role: staff.role }, restaurant: publicRestaurant(restaurant) });
});

// El token de restablecimiento es un JWT de 30 minutos atado a la contraseña actual (últimos
// caracteres del hash): al cambiarla, el enlace deja de servir. No requiere tablas nuevas.
const resetToken = (staff) =>
  jwt.sign({ sub: staff.id, purpose: 'reset', ph: staff.passwordHash.slice(-12) }, config.jwtSecret, { expiresIn: '30m' });

r.post('/auth/forgot', async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email('Escribe un correo válido.') }).parse(req.body || {});
  const staff = await prisma.staff.findUnique({ where: { email: email.toLowerCase() } });
  if (staff) {
    const link = `${config.publicUrl}/restablecer?token=${resetToken(staff)}`;
    try {
      await sendMail({
        to: staff.email,
        subject: 'Restablece tu contraseña de Fácil',
        text: `Hola ${staff.name},\n\nPara crear una contraseña nueva abre este enlace (vale 30 minutos):\n${link}\n\nSi no lo pediste, ignora este correo.`,
        html: `<p>Hola ${staff.name.replace(/[<>&]/g, '')},</p><p>Para crear una contraseña nueva abre este enlace (vale 30 minutos):</p><p><a href="${link}">Restablecer contraseña</a></p><p>Si no lo pediste, ignora este correo.</p>`
      });
    } catch (e) {
      console.error('[forgot] no se pudo enviar el correo', e.message);
    }
  }
  // Misma respuesta exista o no el correo, para no revelar qué cuentas existen.
  res.json({ ok: true, message: 'Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa también el spam.' });
});

r.post('/auth/reset', async (req, res) => {
  const { token, password: newPassword } = z.object({ token: z.string().min(10), password }).parse(req.body || {});
  const invalid = new HttpError(400, 'invalid_token', 'El enlace venció o ya se usó. Pide uno nuevo.');
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret); } catch { throw invalid; }
  if (payload.purpose !== 'reset') throw invalid;
  const staff = await prisma.staff.findUnique({ where: { id: payload.sub } });
  if (!staff || staff.passwordHash.slice(-12) !== payload.ph) throw invalid;
  await prisma.staff.update({ where: { id: staff.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  res.json({ ok: true, message: 'Listo, tu contraseña se cambió. Ya puedes iniciar sesión.' });
});

export default r;
