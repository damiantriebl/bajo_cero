import Image from "next/image";
import type { Presupuesto } from "@/lib/data/trabajos";
import { formatFechaCompleta } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";
import { cx } from "@/components/ui/base";
import { cantidadConUnidad, mismoAnio, numeroTrabajo } from "./util";

const etiquetaDoc = "text-[11px] font-bold tracking-[0.06em] text-muted uppercase sm:text-xs";

/** La hoja tipo A4 que recibe el cliente. */
export function HojaPresupuesto({ p }: { p: Presupuesto }) {
  const e = p.empresa;
  const lineaEmpresa = [
    e.razonSocial,
    `CUIT ${e.cuit ?? "[CUIT]"}`,
    `Tel. ${e.telefono ?? "[TELÉFONO]"}`,
    e.email,
    e.direccion,
  ]
    .filter(Boolean)
    .join(" · ");
  const condiciones = (p.condiciones ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const validez = p.validoHasta
    ? mismoAnio(p.validoHasta, p.fechaPresupuesto)
      ? formatFechaCompleta(p.validoHasta).replace(/ de \d{4}$/, "")
      : formatFechaCompleta(p.validoHasta)
    : null;
  const ultima = p.items.length - 1;

  return (
    <article
      aria-label={`Presupuesto ${numeroTrabajo(p.numero)}`}
      className={cx(
        "mx-auto flex w-full max-w-[800px] flex-col gap-3 rounded-md bg-white p-[18px] text-ink shadow-[0_8px_24px_rgba(11,20,55,0.16)] [print-color-adjust:exact]",
        "sm:gap-4 sm:p-8 lg:aspect-[210/297] lg:p-12",
        "print:aspect-auto print:max-w-none print:rounded-none print:p-0 print:shadow-none",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Image
          src="/logo.webp"
          alt={e.nombreFantasia}
          width={2148}
          height={732}
          loading="eager"
          sizes="(min-width: 640px) 190px, 141px"
          className="h-12 w-auto sm:h-16"
        />
        <div className="flex flex-col items-end">
          <h2 className="font-display text-[22px] leading-none font-bold tracking-[0.01em] uppercase italic sm:text-3xl">
            Presupuesto
          </h2>
          <span className="text-[13px] font-bold text-muted sm:text-sm">{numeroTrabajo(p.numero)}</span>
        </div>
      </div>

      <p className="text-xs text-muted sm:text-[13px]">{lineaEmpresa}</p>

      <div className="grid grid-cols-2 gap-3 border-y border-line py-2.5 sm:gap-6 sm:py-4">
        <div className="flex min-w-0 flex-col">
          <span className={etiquetaDoc}>Para</span>
          <span className="text-sm font-bold sm:text-base">{p.cliente.nombre}</span>
          {p.direccion && <span className="text-xs text-muted sm:text-[13px]">{p.direccion}</span>}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className={etiquetaDoc}>Fecha</span>
          <span className="text-sm font-bold sm:text-base">{formatFechaCompleta(p.fechaPresupuesto)}</span>
          {validez && <span className="text-xs text-muted sm:text-[13px]">Válido hasta el {validez}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-bold sm:text-lg">{p.titulo}</h3>
        {p.descripcion && (
          <p className="text-[13px] whitespace-pre-line text-muted-strong sm:text-sm">{p.descripcion}</p>
        )}
      </div>

      <table className="w-full border-collapse text-[13px] sm:text-sm">
        <thead>
          <tr>
            <th scope="col" className={cx(etiquetaDoc, "border-b-[1.5px] border-ink py-1.5 pr-3 text-left text-ink")}>
              Detalle
            </th>
            <th scope="col" className={cx(etiquetaDoc, "border-b-[1.5px] border-ink px-3 py-1.5 text-right text-ink")}>
              Cantidad
            </th>
            <th scope="col" className={cx(etiquetaDoc, "border-b-[1.5px] border-ink py-1.5 pl-3 text-right text-ink")}>
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((i, n) => {
            const borde = n === ultima ? "border-b-[1.5px] border-ink" : "border-b border-line-soft";
            return (
              <tr key={i.id}>
                <td className={cx(borde, "py-1.5 pr-3 sm:py-2")}>{i.descripcion}</td>
                <td className={cx(borde, "px-3 py-1.5 text-right whitespace-nowrap tabular sm:py-2")}>
                  {cantidadConUnidad(i.cantidad, i.unidad)}
                </td>
                <td className={cx(borde, "py-1.5 pl-3 text-right whitespace-nowrap tabular sm:py-2")}>
                  {formatPesos(i.importe)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2} className="pt-2.5 text-left text-[15px] font-bold sm:text-base">
              Total
            </th>
            <td className="pt-2.5 text-right text-xl font-bold whitespace-nowrap tabular sm:text-2xl">
              {formatPesos(p.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      {(condiciones.length > 0 || e.garantia) && (
        <div className="flex flex-col gap-0.5 rounded-lg bg-canvas px-3 py-2.5 sm:px-4 sm:py-3">
          <span className={etiquetaDoc}>Condiciones</span>
          {condiciones.map((l, n) => (
            <p key={n} className="text-xs sm:text-[13px]">
              {l}
            </p>
          ))}
          {e.garantia && <p className="text-xs sm:text-[13px]">Garantía: {e.garantia}</p>}
        </div>
      )}
    </article>
  );
}
