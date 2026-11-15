import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AirVent, Banknote, ChevronLeft, ChevronRight, MapPin, MessageCircle, Pencil, Phone, Plus } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  Eyebrow,
  HeroCard,
  IconTile,
  List,
  ListRow,
  Money,
  ProgressBar,
  SectionTitle,
  Skeleton,
  cx,
} from "@/components/ui/base";
import { obtenerCliente, type DetalleCliente, type EquipoDeCliente, type TrabajoDeCliente } from "@/lib/data/clientes";
import { ESTADO_TRABAJO, MEDIO_PAGO, TIPO_CLIENTE, TIPO_EQUIPO } from "@/lib/etiquetas";
import { formatDiaRelativo, formatFechaCorta, formatHora, formatMes } from "@/lib/fechas";
import { formatPesos, formatPorcentaje, linkMapa, linkWhatsApp } from "@/lib/formato";
import { fechaConAnio, numeroTrabajo } from "../_components/cuenta";

export const metadata: Metadata = { title: "Cliente" };

type Props = { params: Promise<{ id: string }> };

export default function ClientePage({ params }: Props) {
  return (
    <Suspense fallback={<FichaSkeleton />}>
      <Ficha params={params} />
    </Suspense>
  );
}

async function Ficha({ params }: Props) {
  const { id } = await params;
  const d = await obtenerCliente(id);
  if (!d) notFound();
  const { cliente } = d;

  const ubicacion = [cliente.direccion, cliente.localidad].filter(Boolean).join(", ");

  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/clientes"
            className="-ml-2 inline-flex h-11 w-fit items-center gap-1 rounded-xl pr-3 pl-1 text-[15px] font-bold text-ink hover:bg-surface"
          >
            <ChevronLeft aria-hidden className="size-6" />
            Clientes
          </Link>
          <ButtonLink href={`/clientes/${id}/editar`} variante="ghost" tamano="sm" className="-mr-2">
            <Pencil aria-hidden className="size-[18px]" />
            Editar
          </ButtonLink>
        </div>
        <h1 className="font-display text-[34px] leading-none font-bold tracking-[0.01em] uppercase italic lg:text-[42px]">
          {cliente.nombre}
        </h1>
        <p className="text-sm text-muted">
          {ubicacion ? `${ubicacion} · ` : ""}
          {TIPO_CLIENTE[cliente.tipo]}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4 lg:gap-6">
          <Contacto telefono={cliente.telefono} direccion={ubicacion} nombre={cliente.nombre} />
          <Cuenta d={d} />
          <Trabajos clienteId={id} trabajos={d.trabajos} hoy={d.hoy} />
        </div>
        <div className="flex flex-col gap-4 lg:gap-6">
          <Pagos cobros={d.cobros} />
          <Equipos clienteId={id} equipos={d.equipos} />
          <Datos d={d} />
        </div>
      </div>
    </>
  );
}

// ───────── Contacto ─────────

function Contacto({ telefono, direccion, nombre }: { telefono: string | null; direccion: string; nombre: string }) {
  const acciones: { href: string; label: string; icon: ReactNode; externo?: boolean; aria: string }[] = [];
  if (telefono) {
    acciones.push({
      href: `tel:${telefono.replace(/[^\d+]/g, "")}`,
      label: "Llamar",
      aria: `Llamar a ${nombre}`,
      icon: <Phone aria-hidden className="size-[18px] text-brand" />,
    });
    acciones.push({
      href: linkWhatsApp(telefono),
      label: "WhatsApp",
      aria: `Escribirle por WhatsApp a ${nombre}`,
      externo: true,
      icon: <MessageCircle aria-hidden className="size-[18px] text-brand" />,
    });
  }
  if (direccion) {
    acciones.push({
      href: linkMapa(direccion),
      label: "Mapa",
      aria: `Ver ${direccion} en el mapa`,
      externo: true,
      icon: <MapPin aria-hidden className="size-[18px] text-brand" />,
    });
  }
  if (acciones.length === 0) return null;

  return (
    <div className={cx("grid gap-2", acciones.length === 3 ? "grid-cols-3" : acciones.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {acciones.map((a) => (
        <a
          key={a.label}
          href={a.href}
          aria-label={a.aria}
          {...(a.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-sm font-bold text-ink transition-colors hover:border-brand"
        >
          {a.icon}
          {a.label}
        </a>
      ))}
    </div>
  );
}

// ───────── Cuenta ─────────

function Cuenta({ d }: { d: DetalleCliente }) {
  const { cuenta, cliente } = d;
  const nota =
    cuenta.estado === "al_dia"
      ? "Está al día."
      : cuenta.estado === "presupuesto"
        ? "Tiene un presupuesto enviado, todavía sin aprobar."
        : cuenta.estado === "sin_trabajos"
          ? "Todavía no tiene trabajos."
          : null;

  return (
    <HeroCard aria-labelledby="falta-cobrar">
      <div className="flex flex-col gap-0.5">
        <Eyebrow tono="night">
          <span id="falta-cobrar">Falta cobrar</span>
        </Eyebrow>
        <Money value={cuenta.falta} className="text-4xl leading-tight font-bold" />
        {nota && <p className="text-sm text-night-text">{nota}</p>}
      </div>
      {cuenta.falta > 0 ? (
        <>
          <ProgressBar
            value={cuenta.abierta.avance}
            tono="night"
            className="h-2!"
            label={`Pagó el ${formatPorcentaje(cuenta.abierta.avance)} del presupuesto`}
          />
          <DosMontos
            a={{ label: "Presupuesto", valor: cuenta.abierta.presupuesto }}
            b={{ label: "Ya pagó", valor: cuenta.abierta.pagado }}
          />
        </>
      ) : (
        cuenta.pagado > 0 && (
          <DosMontos
            a={{ label: "Trabajos aprobados", valor: cuenta.presupuesto }}
            b={{ label: "Pagó en total", valor: cuenta.pagado }}
          />
        )
      )}
      <ButtonLink href={`/cobros/nuevo?cliente=${cliente.id}`} variante="ice" tamano="lg" className="w-full">
        <Banknote aria-hidden className="size-5" />
        Registrar cobro
      </ButtonLink>
    </HeroCard>
  );
}

function DosMontos({ a, b }: { a: { label: string; valor: number }; b: { label: string; valor: number } }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {[a, b].map((m) => (
        <div key={m.label} className="flex flex-col">
          <dt className="text-[13px] text-night-text">{m.label}</dt>
          <dd>
            <Money value={m.valor} className="text-lg font-bold" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ───────── Trabajos ─────────

function Trabajos({ clienteId, trabajos, hoy }: { clienteId: string; trabajos: TrabajoDeCliente[]; hoy: Date }) {
  return (
    <section aria-labelledby="titulo-trabajos" className="flex flex-col gap-2">
      <SectionTitle
        action={
          <ButtonLink href={`/trabajos/nuevo?cliente=${clienteId}`} variante="ghost" tamano="sm" className="-mr-2">
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
            Nuevo presupuesto
          </ButtonLink>
        }
      >
        <span id="titulo-trabajos">Trabajos</span>
      </SectionTitle>
      {trabajos.length === 0 ? (
        <Vacio>Todavía no tiene trabajos ni presupuestos.</Vacio>
      ) : (
        <ul className="flex flex-col gap-2">
          {trabajos.map((t) => (
            <li key={t.id}>
              <Link
                href={`/trabajos/${t.id}`}
                className="flex min-h-15 items-center gap-2.5 rounded-2xl border border-line bg-surface py-2.5 pr-2.5 pl-3.5 text-ink transition-colors hover:border-brand"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-bold">{t.titulo}</span>
                  <span className="text-[13px] text-muted">
                    {t.proximoTurno && `${formatDiaRelativo(t.proximoTurno, hoy)} ${formatHora(t.proximoTurno)} · `}
                    Presupuesto {numeroTrabajo(t.numero)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tono={ESTADO_TRABAJO[t.estado].tono}>{ESTADO_TRABAJO[t.estado].label}</Badge>
                  <FaltaTrabajo t={t} />
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FaltaTrabajo({ t }: { t: TrabajoDeCliente }) {
  if (t.estado === "CANCELADO") return null;
  if (!t.cuentaComoDeuda) return <Money value={t.total} className="text-[13px] text-muted" />;
  if (t.falta > 0) {
    return <span className="tabular text-[13px] font-bold whitespace-nowrap text-warn">Falta {formatPesos(t.falta)}</span>;
  }
  return <span className="text-[13px] font-semibold text-ok">Pagado</span>;
}

// ───────── Pagos ─────────

function Pagos({ cobros }: { cobros: DetalleCliente["cobros"] }) {
  return (
    <section aria-labelledby="titulo-pagos" className="flex flex-col gap-2">
      <SectionTitle>
        <span id="titulo-pagos">Pagos recibidos</span>
      </SectionTitle>
      {cobros.length === 0 ? (
        <Vacio>Todavía no registraste pagos de este cliente.</Vacio>
      ) : (
        <List>
          {cobros.map((c) => (
            <ListRow
              key={c.id}
              title={`${c.concepto ?? "Pago"} · ${MEDIO_PAGO[c.medio].toLowerCase()}`}
              subtitle={
                <>
                  {formatFechaCorta(c.fecha)}
                  {c.trabajo && ` · ${numeroTrabajo(c.trabajo.numero)}`}
                  {c.notas && ` · ${c.notas}`}
                </>
              }
              trailing={<Money value={c.monto} className="text-base font-bold text-ok" />}
            />
          ))}
        </List>
      )}
    </section>
  );
}

// ───────── Equipos ─────────

function nombreEquipo(e: EquipoDeCliente): string {
  const partes = [TIPO_EQUIPO[e.tipo], e.marca, e.modelo, e.frigorias ? `${e.frigorias} fg` : null].filter(Boolean).join(" ");
  return e.ubicacion ? `${partes} · ${e.ubicacion.toLowerCase()}` : partes;
}

function Mantenimiento({ e }: { e: EquipoDeCliente }) {
  const dias = e.diasParaMantenimiento;
  if (dias === null || !e.proximoMantenimiento) return <>Sin mantenimiento agendado</>;
  if (dias < 0) {
    return (
      <span className="font-bold text-warn">
        Mantenimiento vencido hace {-dias} {dias === -1 ? "día" : "días"}
      </span>
    );
  }
  if (dias === 0) return <span className="font-bold text-warn">Mantenimiento: hoy</span>;
  if (dias <= 30) return <span className="font-semibold text-ink">Mantenimiento en {dias} {dias === 1 ? "día" : "días"}</span>;
  return <>Mantenimiento: {formatMes(e.proximoMantenimiento).toLowerCase()}</>;
}

function Equipos({ clienteId, equipos }: { clienteId: string; equipos: EquipoDeCliente[] }) {
  return (
    <section aria-labelledby="titulo-equipos" className="flex flex-col gap-2">
      <SectionTitle
        action={
          <ButtonLink href={`/clientes/${clienteId}/equipos/nuevo`} variante="ghost" tamano="sm" className="-mr-2">
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
            Agregar equipo
          </ButtonLink>
        }
      >
        <span id="titulo-equipos">Equipos del cliente</span>
      </SectionTitle>
      {equipos.length === 0 ? (
        <Vacio>No cargaste equipos de este cliente.</Vacio>
      ) : (
        <List>
          {equipos.map((e) => {
            const vencido = e.diasParaMantenimiento !== null && e.diasParaMantenimiento <= 0;
            return (
              <ListRow
                key={e.id}
                leading={
                  <IconTile tono={vencido ? "warn" : "info"}>
                    <AirVent className="size-5" />
                  </IconTile>
                }
                title={nombreEquipo(e)}
                subtitle={
                  <>
                    {e.fechaInstalacion && `Instalado el ${fechaConAnio(e.fechaInstalacion)} · `}
                    <Mantenimiento e={e} />
                  </>
                }
              />
            );
          })}
        </List>
      )}
    </section>
  );
}

// ───────── Datos y notas ─────────

function Datos({ d }: { d: DetalleCliente }) {
  const { cliente } = d;
  const filas: { label: string; valor: ReactNode }[] = [];
  if (cliente.telefono) {
    filas.push({
      label: "Teléfono",
      valor: (
        <a href={`tel:${cliente.telefono.replace(/[^\d+]/g, "")}`} className="font-semibold text-brand hover:underline">
          {cliente.telefono}
        </a>
      ),
    });
  }
  if (cliente.email) {
    filas.push({
      label: "Email",
      valor: (
        <a href={`mailto:${cliente.email}`} className="font-semibold break-all text-brand hover:underline">
          {cliente.email}
        </a>
      ),
    });
  }
  if (cliente.direccion) filas.push({ label: "Dirección", valor: cliente.direccion });
  if (cliente.localidad) filas.push({ label: "Localidad", valor: cliente.localidad });
  if (cliente.cuit) filas.push({ label: "CUIT", valor: <span className="tabular">{cliente.cuit}</span> });
  filas.push({ label: "Tipo", valor: TIPO_CLIENTE[cliente.tipo] });

  return (
    <section aria-labelledby="titulo-datos" className="flex flex-col gap-2">
      <SectionTitle
        action={
          <ButtonLink href={`/clientes/${cliente.id}/editar`} variante="ghost" tamano="sm" className="-mr-2">
            <Pencil aria-hidden className="size-[18px]" />
            Editar
          </ButtonLink>
        }
      >
        <span id="titulo-datos">Datos</span>
      </SectionTitle>
      <Card className="px-3.5 py-1">
        <dl className="flex flex-col [&>div+div]:border-t [&>div+div]:border-line-soft">
          {filas.map((f) => (
            <div key={f.label} className="flex min-h-12 items-center justify-between gap-4 py-2">
              <dt className="text-sm text-muted">{f.label}</dt>
              <dd className="min-w-0 text-right text-[15px]">{f.valor}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <h3 className="mt-2 text-[13px] font-bold tracking-[0.06em] text-muted uppercase">Notas</h3>
      {cliente.notas ? (
        <Card className="px-3.5 py-3 text-[15px] whitespace-pre-line">{cliente.notas}</Card>
      ) : (
        <p className="text-sm text-muted">
          Sin notas.{" "}
          <Link href={`/clientes/${cliente.id}/editar`} className="font-semibold text-brand hover:underline">
            Agregar notas
          </Link>
        </p>
      )}
    </section>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-track px-4 py-5 text-center text-sm text-muted">{children}</p>;
}

function FichaSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando cliente">
      <Skeleton className="h-11 w-32" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-60 rounded-[20px]" />
          <Skeleton className="h-32" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}
