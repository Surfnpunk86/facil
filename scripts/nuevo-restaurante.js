// Alta de un restaurante real con su administrador y sus piezas de mesa.
// Uso (en local o en el Shell de Render):
//   node scripts/nuevo-restaurante.js --slug=la-esquina --nombre="La Esquina" --nit=900123456 \
//     --ciudad=Barranquilla --admin=dueno@laesquina.co --clave="una-clave-segura" --mesas=12 --premio="Postre de la casa"
import bcrypt from 'bcryptjs';
import { prisma } from '../server/db.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  })
);

const required = ['slug', 'nombre', 'nit', 'admin', 'clave'];
const missing = required.filter((k) => !args[k]);
if (missing.length) {
  console.error(`Faltan parámetros: ${missing.map((m) => '--' + m).join(', ')}`);
  process.exit(1);
}
if (!/^[a-z0-9-]{3,40}$/.test(args.slug)) {
  console.error('El slug solo admite minúsculas, números y guiones (3 a 40 caracteres).');
  process.exit(1);
}
if (args.clave.length < 10) {
  console.error('La clave del administrador debe tener al menos 10 caracteres.');
  process.exit(1);
}

const mesas = Math.min(200, Math.max(0, Number(args.mesas || 10)));
const r = await prisma.restaurant.create({
  data: {
    slug: args.slug,
    name: args.nombre,
    nit: args.nit.replace(/\D/g, ''),
    city: args.ciudad || null,
    rewardText: args.premio || 'Premio del Club',
    stampsGoal: Number(args.sellos || 8)
  }
});
await prisma.tag.createMany({
  data: [
    ...Array.from({ length: mesas }, (_, i) => ({ restaurantId: r.id, code: `MESA-${i + 1}`, label: `Mesa ${i + 1}` })),
    { restaurantId: r.id, code: 'CAJA-1', label: 'Mostrador' }
  ]
});
await prisma.staff.create({
  data: { restaurantId: r.id, name: 'Administrador', email: args.admin.toLowerCase(), passwordHash: await bcrypt.hash(args.clave, 10), role: 'OWNER' }
});
console.log(`Restaurante creado: /r/${r.slug} · ${mesas} mesas + mostrador · administrador ${args.admin}`);
await prisma.$disconnect();
