// Administración de la red Fácil (operador de la plataforma): zonas del álbum, retos patrocinados y factura premiada.
// Se ejecuta en local o en el Shell de Render. Ejemplos:
//
//   node scripts/red.js zona --slug=ruta-del-prado --nombre="Ruta del Prado" --ciudad=Barranquilla \
//        --premio="Cena para 2 en un restaurante de la ruta" --desde=2026-10-15 --hasta=2027-01-31
//   node scripts/red.js asignar --zona=ruta-del-prado --restaurantes=arepa-y-brasa,la-esquina
//   node scripts/red.js reto --zona=ruta-del-prado --titulo="Ruta completa de octubre" --tipo=VISITS --meta=4 \
//        --puntos=300 --patrocinador="Marca patrocinadora" --desde=2026-10-15 --hasta=2026-10-31
//   node scripts/red.js sorteo --nombre="Factura premiada de noviembre" --premio="Moto eléctrica" \
//        --patrocinador="Marca patrocinadora" --desde=2026-11-01 --hasta=2026-11-30 --fecha-sorteo=2026-12-05 [--zona=ruta-del-prado]
//   node scripts/red.js activar --sorteo=<id> --autorizacion="Coljuegos No. 1234 de 2026" --terminos=https://...
//   node scripts/red.js cerrar --sorteo=<id>
//   node scripts/red.js exportar --sorteo=<id> > boletas.csv
//   node scripts/red.js sortear --sorteo=<id>
//   node scripts/red.js estado
import { prisma } from '../server/db.js';
import { runDraw } from '../server/lib/games.js';

const [cmd, ...rest] = process.argv.slice(2);
const a = Object.fromEntries(rest.map((x) => { const [k, ...v] = x.replace(/^--/, '').split('='); return [k, v.join('=')]; }));

// Fechas en hora de Colombia: --desde es inicio del día, --hasta es fin del día.
const startOf = (d) => new Date(`${d}T00:00:00-05:00`);
const fmt = (d) => d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' });
const endOf = (d) => new Date(`${d}T23:59:59-05:00`);
function need(...keys) {
  const miss = keys.filter((k) => !a[k]);
  if (miss.length) fail(`Faltan parámetros: ${miss.map((k) => '--' + k).join(', ')}`);
}
function fail(msg) { console.error(msg); process.exit(1); }
async function zoneBySlug(slug) {
  const z = await prisma.zone.findUnique({ where: { slug } });
  if (!z) fail(`No existe la zona ${slug}`);
  return z;
}

async function main() {
  switch (cmd) {
    case 'zona': {
      need('slug', 'nombre', 'desde', 'hasta');
      const z = await prisma.zone.create({
        data: { slug: a.slug, name: a.nombre, city: a.ciudad || null, rewardText: a.premio || undefined, seasonStart: startOf(a.desde), seasonEnd: endOf(a.hasta) }
      });
      console.log(`Zona creada: ${z.name} (${z.slug}), temporada ${a.desde} a ${a.hasta}`);
      break;
    }
    case 'asignar': {
      need('zona', 'restaurantes');
      const z = await zoneBySlug(a.zona);
      const slugs = a.restaurantes.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await prisma.restaurant.updateMany({ where: { slug: { in: slugs } }, data: { zoneId: z.id } });
      console.log(`${r.count} de ${slugs.length} restaurantes asignados a ${z.name}`);
      break;
    }
    case 'reto': {
      need('zona', 'titulo', 'tipo', 'meta', 'puntos', 'desde', 'hasta');
      if (!['VISITS', 'SPEND', 'STREAK_WEEKS'].includes(a.tipo)) fail('--tipo debe ser VISITS, SPEND o STREAK_WEEKS');
      const z = await zoneBySlug(a.zona);
      const c = await prisma.challenge.create({
        data: {
          zoneId: z.id, title: a.titulo, description: a.descripcion || null, kind: a.tipo, target: Number(a.meta), bonusPoints: Number(a.puntos),
          sponsorName: a.patrocinador || null, startsAt: startOf(a.desde), endsAt: endOf(a.hasta)
        }
      });
      console.log(`Reto de zona creado: ${c.title} (${c.id})`);
      break;
    }
    case 'sorteo': {
      need('nombre', 'premio', 'desde', 'hasta', 'fecha-sorteo');
      const zone = a.zona ? await zoneBySlug(a.zona) : null;
      const d = await prisma.draw.create({
        data: {
          name: a.nombre, prizeText: a.premio, sponsorName: a.patrocinador || null, zoneId: zone?.id || null,
          startsAt: startOf(a.desde), endsAt: endOf(a.hasta), drawAt: new Date(`${a['fecha-sorteo']}T18:00:00-05:00`)
        }
      });
      console.log(`Sorteo creado en borrador: ${d.name} (${d.id}). No emite boletas hasta activarlo con el número de autorización de Coljuegos.`);
      break;
    }
    case 'activar': {
      need('sorteo', 'autorizacion');
      const d = await prisma.draw.findUnique({ where: { id: a.sorteo } });
      if (!d) fail('Sorteo no encontrado');
      if (d.status !== 'DRAFT') fail(`El sorteo está en estado ${d.status}`);
      await prisma.draw.update({ where: { id: d.id }, data: { status: 'ACTIVE', coljuegosAuthorization: a.autorizacion, termsUrl: a.terminos || null } });
      console.log(`Sorteo activo: ${d.name}. Cada compra validada entre el ${fmt(d.startsAt)} y el ${fmt(d.endsAt)} genera una boleta.`);
      break;
    }
    case 'cerrar': {
      need('sorteo');
      const d = await prisma.draw.update({ where: { id: a.sorteo }, data: { status: 'CLOSED' } });
      console.log(`Sorteo cerrado: ${d.name}. Ya no emite boletas.`);
      break;
    }
    case 'exportar': {
      need('sorteo');
      const t = await prisma.drawTicket.findMany({ where: { drawId: a.sorteo }, orderBy: { number: 'asc' }, include: { purchase: { include: { restaurant: true } } } });
      console.log('numero,celular,restaurante,fecha_compra,valor,factura');
      for (const x of t) console.log([x.number, x.phone, `"${x.purchase.restaurant.name}"`, x.purchase.createdAt.toISOString(), x.purchase.amount, x.purchase.invoiceNumber || ''].join(','));
      break;
    }
    case 'sortear': {
      need('sorteo');
      const { winner, total, fingerprint } = await runDraw(a.sorteo);
      console.log(`Boletas en el sorteo: ${total}`);
      console.log(`Huella SHA-256 de la lista: ${fingerprint}`);
      console.log(`Boleta ganadora: ${winner.number} · celular ${winner.phone}`);
      console.log('Registra el resultado en el acta con el delegado de Coljuegos o el notario.');
      break;
    }
    case 'estado': {
      const zones = await prisma.zone.findMany({ include: { _count: { select: { restaurants: true, completions: true } } } });
      for (const z of zones) console.log(`Zona ${z.slug}: ${z._count.restaurants} restaurantes, ${z._count.completions} álbumes completos`);
      const draws = await prisma.draw.findMany({ include: { _count: { select: { tickets: true } } }, orderBy: { createdAt: 'desc' } });
      for (const d of draws) console.log(`Sorteo ${d.id} · ${d.name} · ${d.status} · ${d._count.tickets} boletas${d.coljuegosAuthorization ? ' · ' + d.coljuegosAuthorization : ''}`);
      break;
    }
    default:
      fail('Comandos: zona, asignar, reto, sorteo, activar, cerrar, exportar, sortear, estado (ver encabezado del archivo)');
  }
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
