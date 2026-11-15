import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarPlus, Clock, MapPin, MessageCircle, TriangleAlert, Truck, Wrench } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Eyebrow,
  HeroCard,
  IconTile,
  List,
  ListLinkRow,
  ListSkeleton,
  Money,
  PageHeader,
  SectionTitle,
  Skeleton,
  Stat,
  buttonClass,
  cx,
} from "@/components/ui/base";
import { obtenerInicio, type Alerta, type DatosInicio, type MesResumen } from "@/lib/data/inicio";
import { CATEGORIA_GASTO, ESTADO_TRABAJO, TIPO_EQUIPO, UNIDAD } from "@/lib/etiquetas";
import { formatFechaLarga, formatHora, formatMesCorto, mismoDia, partesAR } from "@/lib/fechas";
import { formatNumero, formatPesos, formatPorcentaje, linkMapa, linkWhatsApp } from "@/lib/formato";
import { FilaVisita, tituloVisita } from "./agenda/_components/visita";
import { diaCorto, diaEnFrase, nombreMes, numeroTrabajo, textoVisitas } from "./agenda/_components/utilidades";

export const metadata: Metadata = { title: "Inicio" };

export default function InicioPage() {
  return (
    <Suspense fallback={<InicioCargando />}>
      <Inicio />
    </Suspense>
  );
}

function InicioCargando() {
  return (
    <div className="flex flex-col gap-4 lg:gap-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-16 w-64" />
      <Skeleton className="h-52 rounded-[20px] lg:hidden" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="hidden h-24 lg:block" />
        <Skeleton className="hidden h-24 lg:block" />
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function clientesConSaldo(n: number): string {
  if (n === 0) return "Nadie debe nada";
  return n === 1 ? "1 cliente con saldo" : `${n} clientes con saldo`;
}

async function Inicio() {
  const d = await obtenerInicio();
  const mes = nombreMes(d.mes.inicio);
  const hoy = formatFechaLarga(d.ahora);

  return (
    <>
      {/* Encabezado: celular */}
      <div className="lg:hidden">
        <PageHeader
          eyebrow={hoy}
          title={`Hoy, ${textoVisitas(d.visitasHoy.length)}`}
          actions={
            <Link href="/agenda" className="flex h-11 items-center text-[15px] font-bold text-brand hover:text-brand-hover">
              Ver agenda
            </Link>
          }
        />
      </div>
      {/* Encabezado: computadora */}
      <div className="hidden lg:block">
        <PageHeader
          eyebrow={`${hoy} de ${partesAR(d.ahora).anio}`}
          title={`Cómo viene ${mes}`}
          actions={
            <>
              <ButtonLink href="/agenda/nuevo" tamano="sm">
                Nuevo turno
              </ButtonLink>
              <ButtonLink href="/cobros/nuevo" variante="secondary" tamano="sm">
                Registrar cobro
              </ButtonLink>
              <ButtonLink href="/gastos/nuevo" variante="secondary" tamano="sm">
                Cargar gasto
              </ButtonLink>
            </>
          }
        />
      </div>

      {/* Celular: próxima visita y dos números */}
      <div className="lg:hidden">
        <Proxima d={d} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <Stat
          label="Por cobrar"
          value={formatPesos(d.porCobrar.total)}
          hint={<span className="font-bold text-warn">{clientesConSaldo(d.porCobrar.clientes)}</span>}
          href="/clientes"
        />
        <Stat
          label={`Cobrado en ${mes}`}
          value={formatPesos(d.mes.cobrado)}
          hint={<Ganancia valor={d.mes.ganancia} />}
          href="/reportes"
        />
      </div>

      {/* Computadora: números del mes */}
      <div className="hidden grid-cols-4 gap-4 lg:grid">
        <Stat
          label="Cobrado"
          value={formatPesos(d.mes.cobrado)}
          hint={d.mes.cobros === 1 ? "1 cobro en el mes" : `${d.mes.cobros} cobros en el mes`}
          href="/reportes"
        />
        <Stat
          label="Gastos"
          value={formatPesos(d.mes.gastos)}
          hint={
            d.mes.mayorGasto
              ? `${CATEGORIA_GASTO[d.mes.mayorGasto.categoria]} es el ${formatPorcentaje(d.mes.mayorGasto.fraccion)}`
              : "Sin gastos este mes"
          }
          href="/gastos"
        />
        <Stat
          label="Ganancia del mes"
          tono="night"
          value={formatPesos(d.mes.ganancia)}
          hint="Cobrado menos gastos"
          href="/reportes"
        />
        <Stat
          label="Por cobrar"
          value={<span className="text-warn">{formatPesos(d.porCobrar.total)}</span>}
          hint={clientesConSaldo(d.porCobrar.clientes)}
          href="/clientes"
        />
      </div>

      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <Grafico meses={d.meses} />
        <AgendaDeHoy d={d} />
      </div>

      {/* Celular: el resto del día */}
      {d.despues.length > 0 && (
        <section className="flex flex-col gap-2 lg:hidden">
          <SectionTitle>Después</SectionTitle>
          <List>
            {d.despues.map((v) => (
              <FilaVisita key={v.id} visita={v} />
            ))}
          </List>
        </section>
      )}

      <CuentasPorCobrar porCobrar={d.porCobrar} />

      <ParaAtender alertas={d.alertas} />
    </>
  );
}

function Ganancia({ valor }: { valor: number }) {
  return valor >= 0 ? (
    <span className="font-bold text-ok">Ganancia {formatPesos(valor)}</span>
  ) : (
    <span className="font-bold text-danger">Pérdida {formatPesos(-valor)}</span>
  );
}

// ───────── Próxima visita (celular) ─────────

const botonContorno = cx(
  "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-ice-light px-4 text-[15px] font-bold text-white transition-colors hover:bg-night-track",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice-light",
);

function Proxima({ d }: { d: DatosInicio }) {
  const v = d.proxima;
  if (!v) {
    return (
      <EmptyState
        title="No hay visitas agendadas"
        description="Cuando agendes una, la vas a ver acá con el botón para llegar."
        action={
          <ButtonLink href="/agenda/nuevo" variante="soft" tamano="sm">
            <CalendarPlus aria-hidden className="size-5" />
            Nuevo turno
          </ButtonLink>
        }
      />
    );
  }

  const enCurso = v.inicio <= d.ahora;
  const esHoy = mismoDia(v.inicio, d.ahora);
  const cuando = enCurso
    ? `Ahora · hasta las ${formatHora(v.fin)}`
    : `Próxima · ${esHoy ? "" : `${diaCorto(v.inicio, d.ahora)} · `}${formatHora(v.inicio)}`;
  const mensaje = `Hola, te escribimos de Bajo Cero por la visita de ${diaEnFrase(v.inicio, d.ahora)} a las ${formatHora(v.inicio)}.`;

  return (
    <HeroCard aria-labelledby="proxima-cliente" className="gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/agenda/${v.id}`}
          className="flex min-w-0 flex-col gap-[3px] rounded-lg text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice-light"
        >
          <Eyebrow tono="night">{cuando}</Eyebrow>
          <span id="proxima-cliente" className="text-[22px] leading-tight font-bold">
            {v.cliente.nombre}
          </span>
          <span className="text-[15px] text-night-text">{tituloVisita(v)}</span>
          {v.direccion && <span className="text-sm text-night-text">{v.direccion}</span>}
        </Link>
        <span aria-hidden className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
          <span className="h-2 w-18 rounded-full bg-ice" />
          <span className="h-2 w-11 rounded-full bg-ice/55" />
          <span className="h-2 w-22 rounded-full bg-ice" />
          <span className="h-2 w-7.5 rounded-full bg-ice/55" />
        </span>
      </div>
      {(v.direccion || v.cliente.telefono) && (
        <div className="flex gap-2.5">
          {v.direccion && (
            <a href={linkMapa(v.direccion)} target="_blank" rel="noopener noreferrer" className={buttonClass("ice", "md", "flex-1")}>
              <MapPin aria-hidden className="size-5" />
              Cómo llegar
            </a>
          )}
          {v.cliente.telefono && (
            <a href={linkWhatsApp(v.cliente.telefono, mensaje)} target="_blank" rel="noopener noreferrer" className={botonContorno}>
              <MessageCircle aria-hidden className="size-5" />
              WhatsApp
            </a>
          )}
        </div>
      )}
    </HeroCard>
  );
}

// ───────── Gráfico de 6 meses (computadora) ─────────

function Grafico({ meses }: { meses: MesResumen[] }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.cobrado, m.gastos]));
  const alto = (v: number) => `${v > 0 ? Math.max(2, Math.round((v / max) * 100)) : 0}%`;
  const descripcion = `Cobrado y gastos de los últimos 6 meses. ${meses
    .map((m) => `${mayuscula(nombreMes(m.mes))}: cobrado ${formatPesos(m.cobrado)}, gastos ${formatPesos(m.gastos)}.`)
    .join(" ")}`;

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="text-lg font-bold">Cobrado y gastos, últimos 6 meses</h2>
        <span className="flex gap-3.5 text-[13px] font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-ice" />
            Cobrado
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[3px] bg-night" />
            Gastos
          </span>
        </span>
      </div>
      <div role="img" aria-label={descripcion} className="grid grid-cols-6 gap-2 border-b-[1.5px] border-ink">
        {meses.map((m, i) => (
          <div key={i} className="flex h-45 items-end justify-center gap-1">
            <span className="w-full max-w-[26px] rounded-t-[5px] bg-ice" style={{ height: alto(m.cobrado) }} />
            <span className="w-full max-w-[26px] rounded-t-[5px] bg-night" style={{ height: alto(m.gastos) }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="grid grid-cols-6 gap-2 text-center text-[13px] font-semibold text-muted">
        {meses.map((m, i) => (
          <span key={i} className={cx(i === meses.length - 1 && "font-bold text-ink")}>
            {formatMesCorto(m.mes)}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ───────── Agenda de hoy (computadora) ─────────

function AgendaDeHoy({ d }: { d: DatosInicio }) {
  const pie = [
    d.siguienteDia && `${mayuscula(diaEnFrase(d.siguienteDia.fecha, d.ahora))} hay ${textoVisitas(d.siguienteDia.cantidad)}`,
    d.sinFecha > 0 && (d.sinFecha === 1 ? "1 trabajo espera fecha" : `${d.sinFecha} trabajos esperan fecha`),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex flex-col pt-4 pb-1.5">
      <div className="flex items-baseline justify-between gap-2.5 px-5 pb-2.5">
        <h2 className="text-lg font-bold">Agenda de hoy</h2>
        <Link href="/agenda" className="text-sm font-bold text-brand hover:text-brand-hover">
          Ver la semana
        </Link>
      </div>
      <div className="flex flex-col [&>*]:border-t [&>*]:border-line-soft">
        {d.visitasHoy.length === 0 ? (
          <p className="px-5 py-4 text-[15px] text-muted">No hay visitas hoy.</p>
        ) : (
          d.visitasHoy.map((v) => <FilaVisita key={v.id} visita={v} conTecnicos className="px-5" />)
        )}
        {pie && (
          <Link href="/agenda" className="flex min-h-11 items-center px-5 text-sm text-muted transition-colors hover:text-brand">
            {pie}
          </Link>
        )}
      </div>
    </Card>
  );
}

// ───────── Cuentas por cobrar (computadora) ─────────

const th = "border-b-[1.5px] border-ink px-3 py-2.5 text-xs font-bold tracking-[0.06em] text-muted uppercase";
const td = "border-b border-line-soft px-3 py-3";

function CuentasPorCobrar({ porCobrar }: { porCobrar: DatosInicio["porCobrar"] }) {
  const { cuentas } = porCobrar;
  return (
    <Card className="hidden flex-col gap-3 p-5 lg:flex">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="cuentas-por-cobrar" className="text-lg font-bold">
          Cuentas por cobrar
        </h2>
        <Link href="/clientes" className="text-sm font-bold text-brand hover:text-brand-hover">
          Ver clientes
        </Link>
      </div>
      {cuentas.length === 0 ? (
        <p className="text-[15px] text-muted">No hay saldos pendientes: todos los trabajos están pagos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table aria-labelledby="cuentas-por-cobrar" className="w-full min-w-[720px] border-collapse text-[15px]">
            <thead>
              <tr>
                <th scope="col" className={cx(th, "pl-0 text-left")}>
                  Cliente
                </th>
                <th scope="col" className={cx(th, "text-left")}>
                  Trabajo
                </th>
                <th scope="col" className={cx(th, "text-right")}>
                  Presupuesto
                </th>
                <th scope="col" className={cx(th, "text-right")}>
                  Pagó
                </th>
                <th scope="col" className={cx(th, "text-right")}>
                  Falta
                </th>
                <th scope="col" className={cx(th, "pr-0 text-left")}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => {
                const estado = ESTADO_TRABAJO[c.estado];
                return (
                  <tr key={c.trabajoId}>
                    <td className={cx(td, "pl-0 font-bold")}>
                      <Link href={`/clientes/${c.clienteId}`} className="text-ink hover:text-brand">
                        {c.cliente}
                      </Link>
                    </td>
                    <td className={td}>
                      <Link href={`/trabajos/${c.trabajoId}`} className="text-ink hover:text-brand">
                        <span className="sr-only">{numeroTrabajo(c.numero)}: </span>
                        {c.titulo}
                      </Link>
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Money value={c.total} />
                    </td>
                    <td className={cx(td, "text-right")}>
                      <Money value={c.cobrado} />
                    </td>
                    <td className={cx(td, "text-right font-bold")}>
                      <Money value={c.saldo} />
                    </td>
                    <td className={cx(td, "pr-0")}>
                      {c.faltaAgendar ? <Badge tono="warn">Falta agendar</Badge> : <Badge tono={estado.tono}>{estado.label}</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-[1.5px] border-ink">
                <th scope="row" className="py-3 pr-3 text-left font-bold">
                  Total
                </th>
                <td className="px-3 py-3" />
                <td className="px-3 py-3 text-right font-bold">
                  <Money value={porCobrar.presupuestado} />
                </td>
                <td className="px-3 py-3 text-right font-bold">
                  <Money value={porCobrar.cobrado} />
                </td>
                <td className="px-3 py-3 text-right text-[17px] font-bold text-warn">
                  <Money value={porCobrar.total} />
                </td>
                <td className="py-3 pl-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

// ───────── Para atender ─────────

function plural(n: number, uno: string, varios: string) {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`;
}

function cuandoMantenimiento(dias: number): string {
  if (dias < 0) return `venció hace ${plural(-dias, "día", "días")}`;
  if (dias === 0) return "toca hoy";
  if (dias === 1) return "toca mañana";
  return `toca en ${dias} días`;
}

function cuandoVence(dias: number): string {
  if (dias < 0) return `venció hace ${plural(-dias, "día", "días")}`;
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence en ${dias} días`;
}

function FilaAlerta({ a }: { a: Alerta }) {
  switch (a.tipo) {
    case "stock": {
      const u = UNIDAD[a.unidad].corta;
      return (
        <ListLinkRow
          href="/insumos"
          leading={
            <IconTile tono="warn">
              <TriangleAlert className="size-5" />
            </IconTile>
          }
          title={a.stock <= 0 ? `${a.nombre}: sin stock` : `${a.nombre}: quedan ${formatNumero(a.stock)} ${u}`}
          subtitle={`Mínimo ${formatNumero(a.stockMinimo)} ${u} · armar pedido`}
        />
      );
    }
    case "presupuesto":
      return (
        <ListLinkRow
          href={`/trabajos/${a.trabajoId}`}
          leading={
            <IconTile tono="info">
              <Clock className="size-5" />
            </IconTile>
          }
          title={`Presupuesto ${numeroTrabajo(a.numero)} ${cuandoVence(a.dias)}`}
          subtitle={`${a.cliente} · sin respuesta todavía`}
        />
      );
    case "mantenimiento": {
      const [e] = a.equipos;
      const equipo =
        a.equipos.length === 1
          ? [`${TIPO_EQUIPO[e.tipo]}${e.frigorias ? ` ${formatNumero(e.frigorias)} fg` : ""}`, e.ubicacion].filter(Boolean).join(" · ")
          : `${a.equipos.length} equipos`;
      return (
        <ListLinkRow
          href={`/clientes/${a.clienteId}`}
          leading={
            <IconTile tono={a.dias < 0 ? "warn" : "info"}>
              <Wrench className="size-5" />
            </IconTile>
          }
          title={`Mantenimiento: ${a.cliente}`}
          subtitle={`${equipo} · ${cuandoMantenimiento(a.dias)}`}
        />
      );
    }
    case "pago":
      return (
        <ListLinkRow
          href={`/proveedores/${a.proveedorId}`}
          leading={
            <IconTile tono={a.dias < 0 ? "danger" : "warn"}>
              <Truck className="size-5" />
            </IconTile>
          }
          title={`Pagar a ${a.proveedor}`}
          subtitle={`${mayuscula(cuandoVence(a.dias))} · le debés ${formatPesos(a.saldo)} (${plural(a.facturas, "factura", "facturas")})`}
        />
      );
  }
}

function ParaAtender({ alertas }: { alertas: Alerta[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Para atender</SectionTitle>
      {alertas.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm text-muted">
          Nada pendiente: el stock, los presupuestos y los pagos están al día.
        </p>
      ) : (
        <List>
          {alertas.map((a, i) => (
            <FilaAlerta key={`${a.tipo}-${i}`} a={a} />
          ))}
        </List>
      )}
    </section>
  );
}
