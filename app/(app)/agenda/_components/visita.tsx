// Piezas visuales de una visita. Sin estado: sirven en el inicio y en la agenda.
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import type { Visita } from "@/lib/data/agenda";
import type { EstadoTurno } from "@/lib/generated/prisma/enums";
import { Badge, cx } from "@/components/ui/base";
import { ESTADO_TURNO } from "@/lib/etiquetas";
import { formatHora } from "@/lib/fechas";
import { minutosEntre, unirNombres } from "./utilidades";

export function BadgeTurno({ estado }: { estado: EstadoTurno }) {
  const { label, tono } = ESTADO_TURNO[estado];
  return <Badge tono={tono}>{label}</Badge>;
}

/** "Mantenimiento de 8 equipos · Día 1 de 2" */
export function tituloVisita(v: Visita): string {
  return v.notas && v.notas.length <= 40 ? `${v.trabajo.titulo} · ${v.notas}` : v.trabajo.titulo;
}

export function tecnicosVisita(v: Visita): string {
  return v.tecnicos.length ? unirNombres(v.tecnicos.map((t) => t.nombre)) : "Sin técnico asignado";
}

/** Tarjeta de la línea de tiempo del día: hora a la izquierda y datos de la visita. */
export function FilaLineaDeTiempo({ visita }: { visita: Visita }) {
  const cancelada = visita.estado === "CANCELADO";
  return (
    <div className="flex gap-2.5">
      <div className="flex w-12 shrink-0 flex-col items-end pt-3">
        <span className={cx("tabular text-base font-bold", cancelada && "text-muted line-through")}>{formatHora(visita.inicio)}</span>
        <span className="tabular text-[13px] text-muted">{formatHora(visita.fin)}</span>
      </div>
      <Link
        href={`/agenda/${visita.id}`}
        className={cx(
          "flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink transition-colors hover:border-brand",
          cancelada && "bg-surface-2",
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className={cx("min-w-0 text-base font-bold", cancelada && "text-muted line-through")}>{visita.cliente.nombre}</span>
          <BadgeTurno estado={visita.estado} />
        </span>
        <span className="text-sm">{tituloVisita(visita)}</span>
        <span className="text-[13px] text-muted">
          {[visita.direccion, tecnicosVisita(visita)].filter(Boolean).join(" · ")}
        </span>
      </Link>
    </div>
  );
}

/** Link punteado para agendar (hueco libre o "agendar en este día"). */
export function LinkAgendar({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-track px-3 text-sm font-semibold text-muted transition-colors hover:border-brand hover:text-brand",
        className,
      )}
    >
      <Plus aria-hidden className="size-[18px] shrink-0" />
      <span>{children}</span>
    </Link>
  );
}

/** Hueco libre entre visitas: lleva a agendar en ese horario. */
export function FilaLibre({ href, desde, hasta }: { href: string; desde: Date; hasta: Date }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-12 shrink-0" />
      <LinkAgendar href={href} className="flex-1">
        Libre de {formatHora(desde)} a {formatHora(hasta)}
        <span className="sr-only">, agendar en ese horario</span>
      </LinkAgendar>
    </div>
  );
}

/** Fila de lista: hora, cliente, trabajo y estado (inicio y "Agenda de hoy"). */
export function FilaVisita({
  visita,
  conTecnicos = false,
  className,
}: {
  visita: Visita;
  conTecnicos?: boolean;
  className?: string;
}) {
  const detalle = conTecnicos ? `${tituloVisita(visita)} · ${tecnicosVisita(visita)}` : tituloVisita(visita);
  return (
    <Link
      href={`/agenda/${visita.id}`}
      className={cx("flex min-h-15 items-center gap-3 px-3.5 py-2 text-ink transition-colors hover:bg-surface-2", className)}
    >
      <span className="tabular w-12 shrink-0 text-base font-bold">{formatHora(visita.inicio)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{visita.cliente.nombre}</span>
        <span className="truncate text-[13px] text-muted">{detalle}</span>
      </span>
      <BadgeTurno estado={visita.estado} />
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
    </Link>
  );
}

/** Tarjeta compacta para las columnas de la semana (computadora). */
export function TarjetaSemana({ visita }: { visita: Visita }) {
  const cancelada = visita.estado === "CANCELADO";
  return (
    <Link
      href={`/agenda/${visita.id}`}
      className={cx(
        "flex flex-col gap-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-ink transition-colors hover:border-brand",
        cancelada && "bg-surface-2",
      )}
    >
      <span className={cx("tabular text-[13px] font-bold", cancelada ? "text-muted line-through" : "text-brand-strong")}>
        {formatHora(visita.inicio)} a {formatHora(visita.fin)}
      </span>
      <span className={cx("text-sm leading-tight font-bold", cancelada && "text-muted")}>{visita.cliente.nombre}</span>
      <span className="line-clamp-2 text-[13px] leading-snug text-muted">{tituloVisita(visita)}</span>
      <span className="mt-0.5">
        <BadgeTurno estado={visita.estado} />
      </span>
    </Link>
  );
}

/** Horas de trabajo agendadas (sin canceladas). */
export function minutosAgendados(visitas: Visita[]): number {
  return visitas.filter((v) => v.estado !== "CANCELADO").reduce((acc, v) => acc + minutosEntre(v.inicio, v.fin), 0);
}
