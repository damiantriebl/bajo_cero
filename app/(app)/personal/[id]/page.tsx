import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Pencil, Phone } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  List,
  ListLinkRow,
  ListSkeleton,
  Money,
  PageHeader,
  SectionTitle,
  Skeleton,
  Stat,
  buttonClass,
} from "@/components/ui/base";
import { empleadoDelMes, type JornadaFila } from "@/lib/data/personal";
import { formatFechaCorta, formatFechaLarga } from "@/lib/fechas";
import { formatNumero, formatPesos } from "@/lib/formato";
import { MesNav } from "../../reportes/_components/mes-nav";
import { conParams, primero } from "../../reportes/_components/mes";
import { ConfirmarEliminar } from "../../gastos/_components/confirmar-eliminar";
import { cargarJornada, eliminarJornada, registrarPago } from "../actions";
import { AccionesEmpleado } from "../_components/acciones-empleado";
import { plural, textoSaldo } from "../_components/saldo";

export const metadata: Metadata = { title: "Personal" };

export default function EmpleadoPage({ params, searchParams }: PageProps<"/personal/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-24" />
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <ListSkeleton rows={4} />
        </div>
      }
    >
      <DetalleEmpleado params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DetalleEmpleado({ params, searchParams }: PageProps<"/personal/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const d = await empleadoDelMes(id, primero(sp.mes));
  if (!d) notFound();
  const { empleado: e, mes } = d;
  const saldo = textoSaldo(e.saldo);

  return (
    <>
      <PageHeader
        back={{ href: conParams("/personal", { mes: mes.clave }), label: "Personal" }}
        eyebrow={`${e.puesto} · jornal ${formatPesos(e.jornal)}`}
        title={e.nombre}
        actions={<MesNav mes={mes} base={`/personal/${e.id}`} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {!e.activo && <Badge>Ya no trabaja</Badge>}
        {e.telefono && (
          <a href={`tel:${e.telefono.replace(/[^\d+]/g, "")}`} className={buttonClass("soft", "sm")}>
            <Phone aria-hidden className="size-4" />
            {e.telefono}
          </a>
        )}
        <ButtonLink href={`/personal/${e.id}/editar`} variante="ghost" tamano="sm">
          <Pencil aria-hidden className="size-4" />
          Editar datos
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <Stat label="Jornadas" value={e.jornadas} hint={`en ${mes.nombre}`} />
        <Stat label="Trabajado" value={formatPesos(e.devengado)} hint="suma de las jornadas" />
        <Stat label="Pagado" value={formatPesos(e.pagado)} hint="pagos y adelantos" />
        <Stat
          label={saldo.titulo}
          value={e.saldo === 0 ? "Al día" : formatPesos(Math.abs(e.saldo))}
          hint={e.saldo < 0 ? "cobró de más este mes" : undefined}
          tono={e.saldo > 0 ? "warn" : undefined}
        />
      </div>

      <AccionesEmpleado
        nombre={e.nombre}
        jornal={e.jornal}
        saldo={e.saldo}
        mesNombre={mes.nombre}
        hoy={d.hoy}
        trabajos={d.trabajos}
        cargarJornada={cargarJornada.bind(null, e.id)}
        registrarPago={registrarPago.bind(null, e.id)}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="flex flex-col gap-1" aria-labelledby="jornadas">
          <SectionTitle action={<Money value={e.devengado} className="text-sm font-bold" />}>
            <span id="jornadas">Jornadas de {mes.nombre}</span>
          </SectionTitle>
          {d.jornadas.length === 0 ? (
            <Card className="px-4 py-5 text-sm text-muted">No hay días cargados en {mes.nombre}.</Card>
          ) : (
            <List>
              {d.jornadas.map((j) => (
                <FilaJornada key={j.id} j={j} />
              ))}
            </List>
          )}
        </section>

        <section className="flex flex-col gap-1" aria-labelledby="pagos">
          <SectionTitle action={<Money value={e.pagado} className="text-sm font-bold" />}>
            <span id="pagos">Pagos de {mes.nombre}</span>
          </SectionTitle>
          {d.pagos.length === 0 ? (
            <Card className="px-4 py-5 text-sm text-muted">No hay pagos ni adelantos en {mes.nombre}.</Card>
          ) : (
            <List>
              {d.pagos.map((p) => (
                <ListLinkRow
                  key={p.id}
                  href={`/gastos/${p.id}`}
                  chevron={false}
                  title={p.descripcion}
                  subtitle={`${formatFechaCorta(p.fecha)} · ${p.medioLabel}`}
                  trailing={<Money value={p.monto} className="text-base font-bold" />}
                />
              ))}
            </List>
          )}
          {d.pagos.length > 0 && (
            <p className="px-1 pt-1 text-[13px] text-muted">
              {plural(d.pagos.length, "pago", "pagos")}. Tocá uno para verlo o borrarlo.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function FilaJornada({ j }: { j: JornadaFila }) {
  const detalle = [j.trabajo && `#${j.trabajo.numero} ${j.trabajo.titulo}`, j.horas && `${formatNumero(j.horas)} h`]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex min-h-15 items-center gap-2 py-2 pr-1.5 pl-3.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{formatFechaLarga(j.fecha)}</span>
        <span className="truncate text-[13px] text-muted">{detalle || "Sin trabajo asociado"}</span>
      </span>
      <Money value={j.monto} className="text-base font-bold" />
      <ConfirmarEliminar
        forma="icono"
        ariaLabel={`Borrar la jornada del ${formatFechaCorta(j.fecha)}`}
        accion={eliminarJornada.bind(null, j.id)}
        titulo="¿Borrar esta jornada?"
        descripcion={`Se borra el día ${formatFechaLarga(j.fecha)} (${formatPesos(j.monto)}).`}
      />
    </div>
  );
}
