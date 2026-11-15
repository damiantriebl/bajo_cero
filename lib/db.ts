import "server-only";
import { connection } from "next/server";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Cliente de Prisma para Neon (driver serverless, ideal para Vercel).
// Local: .env apunta a la rama "desarrollo". Vercel: variables de la rama "main".

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crearCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL (conexión con pooler de Neon) en las variables de entorno.");
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

/** Cliente de Prisma (reutilizado entre requests y recargas de `next dev`). */
export function getPrisma(): PrismaClient {
  if (!globalParaPrisma.prisma) globalParaPrisma.prisma = crearCliente();
  return globalParaPrisma.prisma;
}

/**
 * Para LEER al renderizar (lib/data/*). Llama a connection(): la lectura queda
 * "por request" (nunca se ejecuta en el build) y el componente que la usa
 * tiene que estar dentro de <Suspense>.
 */
export async function leerDb(): Promise<PrismaClient> {
  await connection();
  return getPrisma();
}

/** Para ESCRIBIR en server actions. */
export function db(): PrismaClient {
  return getPrisma();
}

/** Momento actual para lógica de render. Llamar SOLO después de leerDb(). */
export function ahora(): Date {
  return new Date();
}
