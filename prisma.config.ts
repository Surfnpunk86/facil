// Configuración de Prisma 7: la URL de la base de datos sale de DATABASE_URL (en Render la inyecta la base enlazada).
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.js' },
  datasource: { url: env('DATABASE_URL') }
});
