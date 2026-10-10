// Configuración de Prisma 7.
// - DATABASE_URL: conexión de la app (en Neon, la URL "pooled").
// - DIRECT_URL (opcional): conexión directa, sin pooler, que Prisma usa para las migraciones
//   (`prisma migrate deploy`). Si no existe, se usa DATABASE_URL.
// Se lee con process.env (no con env() de prisma/config) para que `prisma generate` no falle en el
// build cuando la variable aún no está disponible.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.js' },
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL }
});
