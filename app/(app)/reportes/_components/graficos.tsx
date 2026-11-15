// Gráficos simples con CSS (sin librerías). Sirven en Server Components.
import type { ReactNode } from "react";
import { cx } from "@/components/ui/base";
import { formatPesos, formatPorcentaje } from "@/lib/formato";
import type { CategoriaResumen } from "@/lib/data/reportes";

// ───────── Barras horizontales (una serie, con el número escrito) ─────────

export type FilaBarra = {
  clave: string;
  label: ReactNode;
  /** Texto principal a la derecha (monto o cantidad). */
  valor: ReactNode;
  /** Texto secundario (p. ej. "54 %"). */
  extra?: ReactNode;
  /** Largo de la barra, 0 a 1. */
  fraccion: number;
};

/** Lista de filas con barra. Los números están escritos: las barras son decorativas. */
export function BarrasHorizontales({ filas, className }: { filas: FilaBarra[]; className?: string }) {
  return (
    <ul className={cx("flex flex-col gap-3", className)}>
      {filas.map((f) => (
        <li key={f.clave} className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 font-semibold">{f.label}</span>
            <span className="tabular font-bold whitespace-nowrap">
              {f.valor}
              {f.extra !== undefined && <span className="font-semibold text-muted"> · {f.extra}</span>}
            </span>
          </span>
          <span aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-line-soft">
            <span className="rounded-full bg-brand" style={{ width: `${Math.round(Math.min(1, Math.max(0, f.fraccion)) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Gastos por categoría con monto y porcentaje del total. */
export function BarrasCategorias({ filas }: { filas: CategoriaResumen[] }) {
  return (
    <BarrasHorizontales
      filas={filas.map((c) => ({
        clave: c.categoria,
        label: c.label,
        valor: formatPesos(c.monto),
        extra: formatPorcentaje(c.fraccion),
        fraccion: c.fraccion,
      }))}
    />
  );
}

// ───────── Cobrado vs gastos por mes (dos series) ─────────

export type MesSerie = { clave: string; corto: string; label: string; cobrado: number; gastos: number };

export function Leyenda({ className }: { className?: string }) {
  return (
    <span className={cx("flex gap-3 text-xs font-semibold text-muted lg:text-[13px]", className)}>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-[3px] bg-ice lg:size-3" />
        Cobrado
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-[3px] bg-night lg:size-3" />
        Gastos
      </span>
    </span>
  );
}

function descripcion(meses: MesSerie[], actual: string): string {
  if (meses.length === 0) return "Sin datos.";
  const primero = meses[0].label;
  const ultimo = meses[meses.length - 1].label;
  const sel = meses.find((m) => m.clave === actual) ?? meses[meses.length - 1];
  const mayor = meses.reduce((a, b) => (b.cobrado > a.cobrado ? b : a));
  return (
    `Cobrado y gastos de ${primero} a ${ultimo}. ` +
    `En ${sel.label} se cobraron ${formatPesos(sel.cobrado)} y se gastaron ${formatPesos(sel.gastos)}. ` +
    `El mes con más cobrado fue ${mayor.label}, con ${formatPesos(mayor.cobrado)}.`
  );
}

function TablaMeses({ meses, actual }: { meses: MesSerie[]; actual: string }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Cobrado y gastos por mes</caption>
      <thead>
        <tr className="text-left text-[13px] text-muted">
          <th scope="col" className="py-1.5 pr-2 font-bold">
            Mes
          </th>
          <th scope="col" className="py-1.5 pr-2 text-right font-bold">
            Cobrado
          </th>
          <th scope="col" className="py-1.5 pr-2 text-right font-bold">
            Gastos
          </th>
          <th scope="col" className="py-1.5 text-right font-bold">
            Diferencia
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {[...meses].reverse().map((m) => (
          <tr key={m.clave} className={cx(m.clave === actual && "font-bold")}>
            <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
              {m.label}
            </th>
            <td className="tabular py-1.5 pr-2 text-right whitespace-nowrap">{formatPesos(m.cobrado)}</td>
            <td className="tabular py-1.5 pr-2 text-right whitespace-nowrap">{formatPesos(m.gastos)}</td>
            <td className="tabular py-1.5 text-right whitespace-nowrap">{formatPesos(m.cobrado - m.gastos)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Barras dobles por mes: cobrado (hielo, claro) y gastos (noche, oscuro). */
export function GraficoMensual({ titulo, meses, actual }: { titulo: string; meses: MesSerie[]; actual: string }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.cobrado, m.gastos]));
  const alto = (v: number) => (v > 0 ? `${Math.max(2, Math.round((v / max) * 100))}%` : "0%");

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-bold lg:text-lg">{titulo}</h2>
        <Leyenda />
      </div>
      <div
        role="img"
        aria-label={descripcion(meses, actual)}
        className="grid gap-1.5 border-b-[1.5px] border-ink lg:gap-2"
        style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}
      >
        {meses.map((m) => (
          <div key={m.clave} className="flex h-[116px] items-end justify-center gap-[3px] lg:h-[180px] lg:gap-1">
            <span className="w-3.5 rounded-t-[4px] bg-ice lg:w-[26px] lg:rounded-t-[5px]" style={{ height: alto(m.cobrado) }} />
            <span className="w-3.5 rounded-t-[4px] bg-night lg:w-[26px] lg:rounded-t-[5px]" style={{ height: alto(m.gastos) }} />
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className="grid gap-1.5 text-center text-xs font-semibold text-muted lg:gap-2 lg:text-[13px]"
        style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}
      >
        {meses.map((m) => (
          <span key={m.clave} className={cx(m.clave === actual && "font-bold text-ink")}>
            {m.corto}
          </span>
        ))}
      </div>
      <details className="group lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-brand">Ver los números</summary>
        <TablaMeses meses={meses} actual={actual} />
      </details>
      <div className="hidden lg:block">
        <TablaMeses meses={meses} actual={actual} />
      </div>
    </div>
  );
}
