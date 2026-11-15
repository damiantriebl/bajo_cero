import "server-only";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { aInputFecha } from "@/lib/fechas";
import { sumaMontos } from "@/lib/calculos";
import { MEDIO_PAGO } from "@/lib/etiquetas";
import type { Empleado } from "@/lib/generated/prisma/client";
import { delPeriodo, resolverMes, type MesInfo } from "./reportes";
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

function resumen(s: Store, e: Empleado, desde: Date, hasta: Date): ResumenEmpleado {
  const jornadas = delPeriodo(
    s.jornadas.filter((j) => j.empleadoId === e.id),
    desde,
    hasta,
  );
  const pagos = delPeriodo(
    s.gastos.filter((g) => g.categoria === "PERSONAL" && g.empleadoId === e.id),
    desde,
    hasta,
  );
  const devengado = sumaMontos(jornadas);
  const pagado = sumaMontos(pagos);
  return {
    id: e.id,
    nombre: e.nombre,
    puesto: e.puesto,
    telefono: e.telefono,
    jornal: e.jornal,
    activo: e.activo,
    jornadas: jornadas.length,
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
  const s = await leerStore();
  const { info, desde, hasta } = resolverMes(clave, ahora());
  const todos = s.empleados
    .map((e) => resumen(s, e, desde, hasta))
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
  const s = await leerStore();
  const e = s.empleados.find((x) => x.id === id);
  if (!e) return null;
  const hoy = ahora();
  const { info, desde, hasta } = resolverMes(clave, hoy);

  const jornadas = delPeriodo(
    s.jornadas.filter((j) => j.empleadoId === id),
    desde,
    hasta,
  )
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .map((j) => {
      const t = j.trabajoId ? s.trabajos.find((x) => x.id === j.trabajoId) : undefined;
      return {
        id: j.id,
        fecha: j.fecha,
        horas: j.horas,
        monto: j.monto,
        notas: j.notas,
        trabajo: t ? { id: t.id, numero: t.numero, titulo: t.titulo } : null,
      };
    });

  const pagos = delPeriodo(
    s.gastos.filter((g) => g.categoria === "PERSONAL" && g.empleadoId === id),
    desde,
    hasta,
  )
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .map((g) => ({ id: g.id, fecha: g.fecha, descripcion: g.descripcion, medioLabel: MEDIO_PAGO[g.medio], monto: g.monto }));

  return {
    mes: info,
    empleado: resumen(s, e, desde, hasta),
    jornadas,
    pagos,
    trabajos: trabajosActivos(s),
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
  const s = await leerStore();
  const e = s.empleados.find((x) => x.id === id);
  if (!e) return null;
  return { id: e.id, nombre: e.nombre, puesto: e.puesto, telefono: e.telefono, jornal: e.jornal, activo: e.activo };
}
