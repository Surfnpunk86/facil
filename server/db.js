// Prisma 7 con el adaptador de PostgreSQL (sin motor binario en tiempo de ejecución).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) throw new Error('Falta la variable DATABASE_URL');

// En Vercel cada instancia serverless abre su propio pool: lo mantenemos pequeño para no agotar
// las conexiones de Neon (que además pasa por su pooler). En local/Render usamos el valor normal.
const max = process.env.VERCEL ? 3 : 10;

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max })
});
