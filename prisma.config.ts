import "dotenv/config";
import { defineConfig } from "prisma/config";

// La CLI (migraciones) usa la conexión directa de Neon (sin "-pooler").
// La app en runtime usa DATABASE_URL (con pooler) desde lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
