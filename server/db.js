// Prisma 7 con el adaptador de PostgreSQL (sin motor binario en tiempo de ejecución).
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) throw new Error('Falta la variable DATABASE_URL');

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
