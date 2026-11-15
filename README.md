# Bajo Cero — Gestión

App instalable (PWA) para Bajo Cero, instalación y service de aires acondicionados.
Pensada primero para el celular y usable también desde la computadora.

Módulos: agenda (turnero), clientes y cobros, trabajos y presupuestos, insumos,
proveedores y compras, gastos y personal, reportes mensuales.

## Stack

- Next.js 16 (App Router, Cache Components, Server Actions como backend)
- React 19, Tailwind CSS 4, lucide-react
- Prisma 7 + Neon (Postgres) — `prisma/schema.prisma`
- zod para validar formularios

## Base de datos (Neon)

El proyecto de Neon `bajo_cero` tiene dos ramas:

| Rama | Para qué | Datos |
|---|---|---|
| `main` | Producción (Vercel) | Reales. Arranca vacía. |
| `desarrollo` | Trabajar en local | De ejemplo (`npm run db:seed`) |

- `.env` local apunta a `desarrollo`. Las variables `PROD_*` guardan la conexión de `main` para cargarlas en Vercel.
- Lecturas: `lib/data/*.ts` con `leerDb()`. Escrituras: los `actions.ts` de cada sección con `db()` (`lib/db.ts`).
- Cambios de esquema: editar `prisma/schema.prisma` y crear una migración (`npm run db:migrate`). Nunca `migrate reset` ni `db push` sobre `main`; probar primero en `desarrollo`.
- Aplicar migraciones pendientes a producción: `DIRECT_URL=<PROD_DIRECT_URL> npx prisma migrate deploy`.

## Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000. Para probar la instalación como app y el service
worker, usá `npm run build && npm start`.

## Estructura

```
app/(app)/            pantallas (cada carpeta: page.tsx, actions.ts, _components/)
components/ui/        componentes visuales compartidos
components/shell/     navegación, botón "+", PWA (instalar, sin señal)
lib/data/             consultas por módulo (lo único que lee datos)
lib/mock/             datos de ejemplo y fábricas con forma de Prisma
lib/fechas.ts         fechas en hora de Argentina (el servidor corre en UTC)
prisma/schema.prisma  modelo de datos
```
