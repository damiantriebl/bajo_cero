// Carga los datos de ejemplo (los mismos que usaba la app en memoria) en la base
// a la que apunta DATABASE_URL. Pensado para la rama "desarrollo" de Neon.
//
//   npm run db:seed
//
// Por seguridad NO corre si la base ya tiene clientes o si apunta a producción.
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../lib/generated/prisma/client";
import { crearDatosDeEjemplo } from "./datos-ejemplo/datos";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL.");
  if (process.env.PROD_DATABASE_URL && url === process.env.PROD_DATABASE_URL) {
    throw new Error("DATABASE_URL apunta a producción: no cargo datos de ejemplo ahí.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    if ((await prisma.cliente.count()) > 0) {
      console.log("La base ya tiene clientes: no cargo nada.");
      return;
    }

    const s = crearDatosDeEjemplo(new Date());

    await prisma.empresa.upsert({ where: { id: s.empresa.id }, create: s.empresa, update: s.empresa });
    await prisma.empleado.createMany({ data: s.empleados });
    await prisma.cliente.createMany({ data: s.clientes });
    await prisma.equipo.createMany({ data: s.equipos });
    await prisma.proveedor.createMany({ data: s.proveedores });
    await prisma.insumo.createMany({ data: s.insumos });
    await prisma.trabajo.createMany({ data: s.trabajos });
    await prisma.itemTrabajo.createMany({ data: s.items });
    await prisma.checklistItem.createMany({ data: s.checklist });
    if (s.fotos.length) await prisma.foto.createMany({ data: s.fotos });
    await prisma.turno.createMany({ data: s.turnos });
    for (const t of s.turnos) {
      const ids = s.turnoTecnicos.filter((x) => x.turnoId === t.id).map((x) => ({ id: x.empleadoId }));
      if (ids.length) await prisma.turno.update({ where: { id: t.id }, data: { tecnicos: { connect: ids } } });
    }
    await prisma.cobro.createMany({ data: s.cobros });
    await prisma.compra.createMany({ data: s.compras });
    await prisma.itemCompra.createMany({ data: s.itemsCompra });
    await prisma.pagoProveedor.createMany({ data: s.pagosProveedor });
    await prisma.movimientoStock.createMany({ data: s.movimientos });
    await prisma.jornada.createMany({ data: s.jornadas });
    await prisma.gasto.createMany({ data: s.gastos });

    // Los números de presupuesto se cargaron a mano: el próximo sigue desde el mayor.
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Trabajo"', 'numero'), (SELECT MAX("numero") FROM "Trabajo"))`,
    );

    console.log(
      `Listo: ${s.clientes.length} clientes, ${s.trabajos.length} trabajos, ${s.turnos.length} turnos, ` +
        `${s.cobros.length} cobros, ${s.gastos.length} gastos.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
