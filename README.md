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

## Estado actual: datos de ejemplo

Hoy la app corre con datos de ejemplo en memoria (`lib/mock/`), con la misma
forma que las tablas de Prisma. Todas las lecturas pasan por `lib/data/*.ts` y
todas las escrituras por los `actions.ts` de cada sección, así que conectar la
base es reemplazar esas funciones por consultas con `getPrisma()` (`lib/db.ts`).

Los cambios que se hagan en la app se pierden al reiniciar el servidor.

## Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000. Para probar la instalación como app y el service
worker, usá `npm run build && npm start`.

## Conectar Neon (próximo paso)

1. Copiá `.env.example` a `.env` y completá `DATABASE_URL` (con `-pooler`) y `DIRECT_URL` (sin `-pooler`).
2. `npm run db:migrate` crea las tablas.
3. Pasar `lib/data/*.ts` y los `actions.ts` de `lib/mock` a Prisma.

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
