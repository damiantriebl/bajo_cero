import "server-only";
import { ahora, leerDb } from "@/lib/db";
import { aInputFecha } from "@/lib/fechas";
import { sumaMontos } from "@/lib/calculos";
import { MEDIO_PAGO } from "@/lib/etiquetas";
import type { Empleado } from "@/lib/generated/prisma/client";
import { enRango, resolverMes, type MesInfo } from "./reportes";
import { trabajosActivos, type OpcionTrabajo } from "./gastos";

export type ResumenEmpleado = {
  id: string;
  nombre: string;
  puesto: string;
  telefono: string | null;
  jornal: number;
  activo: boolean;
  /** Días trabajados en el mes. */
  jornadas: number;
  /** Suma de las jornadas del mes (lo que se le debe por lo trabajado). */
  devengado: number;
  /** Pagos y adelantos del mes (gastos PERSONAL de esta persona). */
  pagado: number;
  /** devengado − pagado: positivo = le debés; negativo = está adelantado. */
  saldo: number;
};

type DatosEmpleado = Pick<Empleado, "id" | "nombre" | "puesto" | "telefono" | "jornal" | "activo">;

const camposEmpleado = {
  id: true,
  nombre: true,
  puesto: true,
  telefono: true,
  jornal: true,
  activo: true,
} as const;

function resumen(e: DatosEmpleado, jornadas: number, devengado: number, pagado: number): ResumenEmpleado {
  return {
    id: e.id,
    nombre: e.nombre,
    puesto: e.puesto,
    telefono: e.telefono,
    jornal: e.jornal,
    activo: e.activo,
    jornadas,
    devengado,
    pagado,
    saldo: devengado - pagado,
  };
}

export type PersonalDelMes = {
  mes: MesInfo;
  /** Activos primero, después los que tuvieron movimiento aunque estén inactivos. */
  empleados: ResumenEmpleado[];
  inactivos: ResumenEmpleado[];
  totales: { jornadas: number; devengado: number; pagado: number; saldo: number };
};

export async function personalDelMes(clave: string | undefined): Promise<PersonalDelMes> {
  const prisma = await leerDb();
  const { info, desde, hasta } = resolverMes(clave, ahora());
  const delMes = enRango(desde, hasta);

  // Empleados: tabla chica, entera. Jornadas y pagos del mes: sumados en la base por persona.
  const [lista, jornadas, pagos] = await Promise.all([
    prisma.empleado.findMany({ select: camposEmpleado }),
    prisma.jornada.groupBy({
      by: ["empleadoId"],
      where: { fecha: delMes },
      _sum: { monto: true },
      _count: { _all: true },
    }),
    prisma.gasto.groupBy({
      by: ["empleadoId"],
      where: { fecha: delMes, categoria: "PERSONAL", empleadoId: { not: null } },
      _sum: { monto: true },
    }),
  ]);

  const jornadasDe = new Map(jornadas.map((j) => [j.empleadoId, { dias: j._count._all, monto: j._sum.monto ?? 0 }]));
  const pagadoA = new Map(pagos.map((p) => [p.empleadoId, p._sum.monto ?? 0]));

  const todos = lista
    .map((e) => {
      const j = jornadasDe.get(e.id);
      return resumen(e, j?.dias ?? 0, j?.monto ?? 0, pagadoA.get(e.id) ?? 0);
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const empleados = todos.filter((e) => e.activo);
  const inactivos = todos.filter((e) => !e.activo);
  return {
    mes: info,
    empleados,
    inactivos,
    totales: {
      jornadas: todos.reduce((acc, e) => acc + e.jornadas, 0),
      devengado: sumaMontos(todos.map((e) => ({ monto: e.devengado }))),
      pagado: sumaMontos(todos.map((e) => ({ monto: e.pagado }))),
      saldo: sumaMontos(todos.map((e) => ({ monto: e.saldo }))),
    },
  };
}

export type JornadaFila = {
  id: string;
  fecha: Date;
  horas: number | null;
  monto: number;
  notas: string | null;
  trabajo: { id: string; numero: number; titulo: string } | null;
};

export type PagoFila = { id: string; fecha: Date; descripcion: string; medioLabel: string; monto: number };

export type EmpleadoDelMes = {
  mes: MesInfo;
  empleado: ResumenEmpleado;
  jornadas: JornadaFila[];
  pagos: PagoFila[];
  trabajos: OpcionTrabajo[];
  /** Hoy en Argentina (value de <input type="date">). */
  hoy: string;
};

export async function empleadoDelMes(id: string, clave: string | undefined): Promise<EmpleadoDelMes | null> {
  const prisma = await leerDb();
  const hoy = ahora();
  const { info, desde, hasta } = resolverMes(clave, hoy);
  const delMes = enRango(desde, hasta);

  // Todo en paralelo: si la persona no existe se descarta lo demás (caso raro).
  const [e, jornadas, pagos, trabajos] = await Promise.all([
    prisma.empleado.findUnique({ where: { id }, select: camposEmpleado }),
    prisma.jornada.findMany({
      where: { empleadoId: id, fecha: delMes },
      orderBy: [{ fecha: "desc" }, { id: "asc" }],
      select: {
        id: true,
        fecha: true,
        horas: true,
        monto: true,
        notas: true,
        trabajo: { select: { id: true, numero: true, titulo: true } },
      },
    }),
    prisma.gasto.findMany({
      where: { empleadoId: id, categoria: "PERSONAL", fecha: delMes },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      select: { id: true, fecha: true, descripcion: true, medio: true, monto: true },
    }),
    trabajosActivos(prisma),
  ]);
  if (!e) return null;

  return {
    mes: info,
    empleado: resumen(e, jornadas.length, sumaMontos(jornadas), sumaMontos(pagos)),
    jornadas,
    pagos: pagos.map((g) => ({
      id: g.id,
      fecha: g.fecha,
      descripcion: g.descripcion,
      medioLabel: MEDIO_PAGO[g.medio],
      monto: g.monto,
    })),
    trabajos,
    hoy: aInputFecha(hoy),
  };
}

export type EmpleadoEditable = {
  id: string;
  nombre: string;
  puesto: string;
  telefono: string | null;
  jornal: number;
  activo: boolean;
};

export async function empleadoParaEditar(id: string): Promise<EmpleadoEditable | null> {
  const prisma = await leerDb();
  return prisma.empleado.findUnique({ where: { id }, select: camposEmpleado });
}
