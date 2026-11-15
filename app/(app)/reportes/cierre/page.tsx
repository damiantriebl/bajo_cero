import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ButtonLink, Skeleton, cx } from "@/components/ui/base";
import { cierreDelMes, type Movimiento } from "@/lib/data/reportes";
import { formatFechaCompleta, formatFechaCorta } from "@/lib/fechas";
import { formatPesos, formatPorcentaje } from "@/lib/formato";
import { BotonImprimir } from "../_components/boton-imprimir";
import { primero } from "../_components/mes";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = { title: "Cierre del mes" };

// Al imprimir, se oculta la navegación de la app (menú lateral, barra inferior y avisos).
const CSS_IMPRESION = `
@media print {
  aside, nav[aria-label="Secciones"], [role="status"] { display: none !important; }
  main { padding: 0 !important; max-width: none !important; }
  @page { size: A4; margin: 14mm; }
  tr { break-inside: avoid; }
}
`;

export default function CierrePage({ searchParams }: PageProps<"/reportes/cierre">) {
  return (
    <>
      <style>{CSS_IMPRESION}</style>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Armando el cierre">
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-[640px]" />
          </div>
        }
      >
        <Cierre searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Cierre({ searchParams }: Pick<PageProps<"/reportes/cierre">, "searchParams">) {
  const sp = await searchParams;
  const c = await cierreDelMes(primero(sp.mes));
  const { mes, empresa } = c;
  const datosEmpresa = [empresa.razonSocial, empresa.cuit && `CUIT ${empresa.cuit}`, empresa.telefono, empresa.email]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href={`/reportes?mes=${mes.clave}`} variante="secondary" tamano="sm">
          <ChevronLeft aria-hidden className="size-5" />
          Volver a reportes
        </ButtonLink>
        <BotonImprimir />
      </div>

      <article className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5 text-ink lg:p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div className="flex flex-col gap-1">
            <p className="font-display text-[30px] leading-none font-bold uppercase italic">{empresa.nombre}</p>
            {datosEmpresa && <p className="text-sm text-muted">{datosEmpresa}</p>}
          </div>
          <div className="flex flex-col gap-1 sm:text-right">
            <h1 className="text-xl font-bold">Cierre de {mes.label}</h1>
            <p className="text-sm text-muted">
              Generado el {formatFechaCompleta(c.generado)}
              {mes.esActual && " · mes en curso, números parciales"}
            </p>
          </div>
        </header>

        <Seccion titulo="Resumen">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato label="Cobrado" valor={formatPesos(c.cobrado)} />
            <Dato label="Gastos" valor={formatPesos(c.gastos)} />
            <Dato label="Ganancia" valor={formatPesos(c.ganancia)} destacado />
            <Dato label="Por cobrar (a hoy)" valor={formatPesos(c.porCobrar)} />
          </dl>
        </Seccion>

        <div className="grid gap-6 sm:grid-cols-2">
          <Seccion titulo="Gastos por categoría">
            {c.gastosPorCategoria.length === 0 ? (
              <Vacio>Sin gastos.</Vacio>
            ) : (
              <Tabla
                caption="Gastos por categoría"
                columnas={["Categoría", "Monto", "%"]}
                derecha={[1, 2]}
                filas={c.gastosPorCategoria.map((g) => [g.label, formatPesos(g.monto), formatPorcentaje(g.fraccion)])}
                total={["Total", formatPesos(c.gastos), "100 %"]}
              />
            )}
          </Seccion>
          <Seccion titulo="Trabajos del mes">
            {c.trabajosPorTipo.length === 0 ? (
              <Vacio>Sin visitas ni trabajos terminados.</Vacio>
            ) : (
              <Tabla
                caption="Trabajos con visitas o terminados en el mes, por tipo"
                columnas={["Tipo", "Cantidad"]}
                derecha={[1]}
                filas={c.trabajosPorTipo.map((t) => [t.label, String(t.cantidad)])}
                total={["Total", String(c.trabajosTotal)]}
              />
            )}
          </Seccion>
        </div>

        <Seccion titulo="Rentabilidad de los trabajos terminados">
          {c.rentabilidad.length === 0 ? (
            <Vacio>No se terminó ningún trabajo en el mes.</Vacio>
          ) : (
            <Tabla
              caption="Rentabilidad por trabajo"
              columnas={["Trabajo", "Cliente", "Precio", "Insumos", "Personal", "Ganancia", "Margen"]}
              derecha={[2, 3, 4, 5, 6]}
              filas={c.rentabilidad.map((f) => [
                `#${f.numero} ${f.titulo}`,
                f.cliente,
                formatPesos(f.precio),
                formatPesos(f.insumos),
                formatPesos(f.personal),
                formatPesos(f.ganancia),
                formatPorcentaje(f.margen),
              ])}
              total={[
                "Total",
                "",
                formatPesos(c.rentabilidadTotal.precio),
                formatPesos(c.rentabilidadTotal.insumos),
                formatPesos(c.rentabilidadTotal.personal),
                formatPesos(c.rentabilidadTotal.ganancia),
                formatPorcentaje(c.rentabilidadTotal.margen),
              ]}
            />
          )}
        </Seccion>

        <Seccion titulo="Cobros">
          <TablaMovimientos movimientos={c.cobros} caption="Cobros del mes" total={c.cobrado} rubro="Concepto" />
        </Seccion>

        <Seccion titulo="Gastos">
          <TablaMovimientos movimientos={c.gastosDetalle} caption="Gastos del mes" total={c.gastos} rubro="Categoría" />
        </Seccion>
      </article>
    </>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 break-inside-avoid-page">
      <h2 className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

function Dato({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className={cx("flex flex-col gap-0.5 rounded-xl border px-3 py-2.5", destacado ? "border-ink border-2" : "border-line")}>
      <dt className="text-[13px] font-semibold text-muted">{label}</dt>
      <dd className="tabular text-lg font-bold">{valor}</dd>
    </div>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function Tabla({
  caption,
  columnas,
  filas,
  total,
  derecha = [],
}: {
  caption: string;
  columnas: string[];
  filas: string[][];
  total?: string[];
  /** Índices de columnas alineadas a la derecha (montos). */
  derecha?: number[];
}) {
  const alinear = (i: number) => (derecha.includes(i) ? "text-right" : "text-left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-ink text-[13px] text-muted">
            {columnas.map((c, i) => (
              <th key={c} scope="col" className={cx("py-1.5 pr-3 font-bold last:pr-0", alinear(i))}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {filas.map((f, k) => (
            <tr key={k}>
              {f.map((v, i) => (
                <td key={i} className={cx("py-1.5 pr-3 last:pr-0", alinear(i), derecha.includes(i) && "tabular whitespace-nowrap")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="border-t border-ink font-bold">
              {total.map((v, i) => (
                <td key={i} className={cx("py-1.5 pr-3 last:pr-0", alinear(i), derecha.includes(i) && "tabular whitespace-nowrap")}>
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function TablaMovimientos({
  movimientos,
  caption,
  total,
  rubro,
}: {
  movimientos: Movimiento[];
  caption: string;
  total: number;
  rubro: string;
}) {
  if (movimientos.length === 0) return <Vacio>No hay movimientos.</Vacio>;
  return (
    <Tabla
      caption={caption}
      columnas={["Fecha", "Detalle", rubro, "Medio", "Monto"]}
      derecha={[4]}
      filas={movimientos.map((m) => [formatFechaCorta(m.fecha), m.detalle, m.rubro, m.medio, formatPesos(m.monto)])}
      total={["Total", "", "", "", formatPesos(total)]}
    />
  );
}
