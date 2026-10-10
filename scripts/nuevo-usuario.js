// Alta de un usuario del personal (caja o administrador) para un restaurante existente.
// Uso (en local o en el Shell de Render):
//   node scripts/nuevo-usuario.js --restaurante=arepa-y-brasa --nombre="Caja principal" \
//        --correo=caja@arepaybrasa.co --clave="una-clave-segura" --rol=caja
// --rol puede ser caja (por defecto) o admin.
import bcrypt from 'bcryptjs';
import { prisma } from '../server/db.js';

const a = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, ...v] = x.replace(/^--/, '').split('='); return [k, v.join('=')]; }));

async function main() {
  const missing = ['restaurante', 'nombre', 'correo', 'clave'].filter((k) => !a[k]);
  if (missing.length) throw new Error(`Faltan parámetros: ${missing.map((m) => '--' + m).join(', ')}`);
  if (a.clave.length < 10) throw new Error('La clave debe tener al menos 10 caracteres.');
  const role = (a.rol || 'caja').toLowerCase() === 'admin' ? 'OWNER' : 'CASHIER';
  const r = await prisma.restaurant.findUnique({ where: { slug: a.restaurante } });
  if (!r) throw new Error(`No existe el restaurante ${a.restaurante}`);
  try {
    await prisma.staff.create({
      data: { restaurantId: r.id, name: a.nombre, email: a.correo.toLowerCase(), passwordHash: await bcrypt.hash(a.clave, 10), role }
    });
  } catch (e) {
    if (e.code === 'P2002') throw new Error(`Ya existe un usuario con el correo ${a.correo}`);
    throw e;
  }
  console.log(`Usuario creado: ${a.correo} · ${role === 'OWNER' ? 'administrador' : 'caja'} de ${r.name}`);
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
