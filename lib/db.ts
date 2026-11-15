import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Cliente de Prisma para Neon (driver serverless, ideal para Vercel).
// Todavía NO se usa: hoy los datos salen de lib/mock/store.ts.
// Para pasar a la base real, cada lib/data/*.ts reemplaza leerStore()/escribirStore() por `prisma`.

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crearCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL (conexión con pooler de Neon) en las variables de entorno.");
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

export function getPrisma(): PrismaClient {
  if (!globalParaPrisma.prisma) globalParaPrisma.prisma = crearCliente();
  return globalParaPrisma.prisma;
}
