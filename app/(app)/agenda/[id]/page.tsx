import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, ChevronDown, ChevronRight, MapPin, MessageCircle, Phone } from "lucide-react";
import { Badge, Eyebrow, HeroCard, PageHeader, SectionTitle, Skeleton, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import { obtenerVisita } from "@/lib/data/agenda";
import { ESTADO_TRABAJO, TIPO_TRABAJO } from "@/lib/etiquetas";
import { aInputFecha, aInputHora, formatFechaLarga, formatHora, mismoDia } from "@/lib/fechas";
import { linkMapa, linkWhatsApp } from "@/lib/formato";
import { cancelarTurno, confirmarTurno, marcarRealizado } from "../actions";
import { ReprogramarForm } from "../_components/formularios";
import { BadgeTurno, tecnicosVisita } from "../_components/visita";
import { diaCorto, duracionQueEntra, esDuracionValida, minutosEntre, numeroTrabajo, textoDuracion } from "../_components/utilidades";

export const metadata: Metadata = { title: "Visita" };

export default function VisitaPage(props: PageProps<"/agenda/[id]">) {
  return (
    <Suspense fallback={<VisitaCargando />}>
      <DetalleVisita params={props.params} />
    </Suspense>
  );
}

function VisitaCargando() {
  return (
    <>
      <PageHeader title="Visita" back={{ href: "/agenda", label: "Agenda" }} />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6" aria-busy="true" aria-label="Cargando">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-52 rounded-[20px]" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-40" />
      </div>
    </>
  );
}

/** Botón sobre fondo azul noche (ícono arriba, texto abajo). */
function botonNoche(principal: boolean) {
  return cx(
    "flex h-16 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice-light",
    principal ? "bg-ice text-ink hover:bg-[#3aa5ef]" : "border-[1.5px] border-ice-light text-white hover:bg-night-track",
  );
}

async function DetalleVisita({ params }: Pick<PageProps<"/agenda/[id]">, "params">) {
  const { id } = await params;
  const datos = await obtenerVisita(id);
  if (!datos) notFound();

  const { visita: v, ahora } = datos;
  const minutos = minutosEntre(v.inicio, v.fin);
  const abierta = v.estado === "A_CONFIRMAR" || v.estado === "CONFIRMADO";
  const telefono = v.cliente.telefono?.replace(/[^\d+]/g, "") || null;
  const mensaje = `Hola, te escribimos de Bajo Cero por la visita del ${formatFechaLarga(v.inicio).toLowerCase()} a las ${formatHora(v.inicio)}.`;
  const estadoTrabajo = ESTADO_TRABAJO[v.trabajo.estado];

  return (
    <>
      <PageHeader
        back={{ href: `/agenda?dia=${aInputFecha(v.inicio)}`, label: "Agenda" }}
        eyebrow={`${formatFechaLarga(v.inicio)}${mismoDia(v.inicio, ahora) ? " · Hoy" : ""}`}
        title={v.cliente.nombre}
      />

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <HeroCard aria-label="Horario y contacto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Eyebrow tono="night">
                  {diaCorto(v.inicio, ahora)} · {textoDuracion(minutos)}
                </Eyebrow>
                <p className="tabular text-[28px] leading-tight font-bold">
                  {formatHora(v.inicio)} a {formatHora(v.fin)}
                </p>
              </div>
              <BadgeTurno estado={v.estado} />
            </div>
            {v.direccion && (
              <p className="flex items-start gap-2 text-[15px] text-night-text">
                <MapPin aria-hidden className="mt-0.5 size-[18px] shrink-0 text-ice-light" />
                {v.direccion}
              </p>
            )}
            {(v.direccion || telefono) && (
              <div className="flex gap-2.5">
                {v.direccion && (
                  <a href={linkMapa(v.direccion)} target="_blank" rel="noopener noreferrer" className={botonNoche(true)}>
                    <MapPin aria-hidden className="size-5" />
                    Cómo llegar
                  </a>
                )}
                {telefono && (
                  <a
                    href={linkWhatsApp(telefono, mensaje)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={botonNoche(!v.direccion)}
                  >
                    <MessageCircle aria-hidden className="size-5" />
                    WhatsApp
                  </a>
                )}
                {telefono && (
                  <a href={`tel:${telefono}`} className={botonNoche(false)}>
                    <Phone aria-hidden className="size-5" />
                    Llamar
                  </a>
                )}
              </div>
            )}
          </HeroCard>

          <Link
            href={`/trabajos/${v.trabajo.id}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-ink transition-colors hover:border-brand"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">
                Trabajo {numeroTrabajo(v.trabajo.numero)} · {TIPO_TRABAJO[v.trabajo.tipo]}
              </span>
              <span className="text-base font-bold">{v.trabajo.titulo}</span>
            </span>
            <Badge tono={estadoTrabajo.tono}>{estadoTrabajo.label}</Badge>
            <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
          </Link>

          <dl className="flex flex-col rounded-2xl border border-line bg-surface px-4 [&>*+*]:border-t [&>*+*]:border-line-soft">
            <div className="flex flex-col gap-0.5 py-3">
              <dt className="text-[13px] font-semibold text-muted">Técnicos</dt>
              <dd className="text-[15px] font-bold">{tecnicosVisita(v)}</dd>
            </div>
            <div className="flex flex-col gap-0.5 py-3">
              <dt className="text-[13px] font-semibold text-muted">Notas</dt>
              <dd className={cx("text-[15px] whitespace-pre-line", !v.notas && "text-muted")}>{v.notas ?? "Sin notas"}</dd>
            </div>
            {v.cliente.telefono && (
              <div className="flex flex-col gap-0.5 py-3">
                <dt className="text-[13px] font-semibold text-muted">Teléfono de {v.cliente.nombre}</dt>
                <dd className="text-[15px] font-bold">
                  <a href={`tel:${telefono}`} className="text-brand hover:text-brand-hover">
                    {v.cliente.telefono}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex flex-col gap-4">
          {abierta ? (
            <section className="flex flex-col gap-2">
              <SectionTitle>Estado de la visita</SectionTitle>
              <div className="flex flex-col gap-2.5">
                {v.estado === "A_CONFIRMAR" && (
                  <form action={confirmarTurno.bind(null, v.id)}>
                    <SubmitButton pendingText="Confirmando…">Confirmar turno</SubmitButton>
                  </form>
                )}
                <form action={marcarRealizado.bind(null, v.id)}>
                  <SubmitButton variante={v.estado === "CONFIRMADO" ? "primary" : "secondary"} pendingText="Guardando…">
                    Marcar realizado
                  </SubmitButton>
                </form>
                <form action={cancelarTurno.bind(null, v.id)}>
                  <SubmitButton variante="danger" pendingText="Cancelando…">
                    Cancelar turno
                  </SubmitButton>
                </form>
              </div>
            </section>
          ) : (
            <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
              {v.estado === "REALIZADO"
                ? "Esta visita ya se hizo. Si hace falta volver, agendá un turno nuevo."
                : "Este turno está cancelado. Podés volver a agendarlo con otro horario."}
            </p>
          )}

          {v.estado !== "REALIZADO" && (
            <details className="group rounded-2xl border border-line bg-surface" open={v.estado === "CANCELADO"}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5">
                  <CalendarClock aria-hidden className="size-5 text-brand" />
                  {v.estado === "CANCELADO" ? "Volver a agendar" : "Reprogramar"}
                </span>
                <ChevronDown aria-hidden className="size-5 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-line-soft p-4">
                <ReprogramarForm
                  turnoId={v.id}
                  tecnicos={v.tecnicos.map((t) => t.id)}
                  inicial={{
                    fecha: aInputFecha(v.inicio),
                    hora: aInputHora(v.inicio),
                    duracion: String(esDuracionValida(minutos) ? minutos : duracionQueEntra(minutos)),
                  }}
                  textoBoton="Guardar nuevo horario"
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
