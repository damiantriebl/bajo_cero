import { PackagePlus, SlidersHorizontal, Wrench } from "lucide-react";
import { IconTile, List, ListLinkRow, ListRow, cx } from "@/components/ui/base";
import type { MovimientoFila } from "@/lib/data/insumos";
import type { Tono } from "@/lib/etiquetas";
import { formatDiaRelativo } from "@/lib/fechas";
import type { TipoMovimiento } from "@/lib/generated/prisma/enums";
import { TIPO_MOVIMIENTO, cantidadConSigno } from "./stock";

const ICONO: Record<TipoMovimiento, { icono: typeof Wrench; tono: Tono }> = {
  COMPRA: { icono: PackagePlus, tono: "ok" },
  CONSUMO: { icono: Wrench, tono: "info" },
  AJUSTE: { icono: SlidersHorizontal, tono: "neutral" },
};

/** De dónde viene el movimiento: "Compra a …", "Trabajo #146 · Marta", o el motivo del ajuste. */
function referencia(m: MovimientoFila): string {
  if (m.compra) return `Compra a ${m.compra.proveedorNombre}`;
  if (m.trabajo) return `Trabajo #${m.trabajo.numero}${m.trabajo.clienteNombre ? ` · ${m.trabajo.clienteNombre}` : ""}`;
  return m.notas ?? TIPO_MOVIMIENTO[m.tipo];
}

function hrefReferencia(m: MovimientoFila): string | null {
  if (m.trabajo) return `/trabajos/${m.trabajo.id}`;
  if (m.compra) return `/proveedores/${m.compra.proveedorId}#compra-${m.compra.id}`;
  return null;
}

/**
 * Historial de movimientos de stock.
 * - `global`: cada fila lleva al insumo (vista "Movimientos" de /insumos).
 * - `insumo`: dentro de la ficha; cada fila lleva al trabajo o a la compra.
 */
export function MovimientosLista({
  movimientos,
  hoy,
  modo,
}: {
  movimientos: MovimientoFila[];
  hoy: Date;
  modo: "global" | "insumo";
}) {
  return (
    <List>
      {movimientos.map((m) => {
        const { icono: Icono, tono } = ICONO[m.tipo];
        const fecha = formatDiaRelativo(m.fecha, hoy);
        const leading = (
          <IconTile tono={tono}>
            <Icono className="size-5" />
          </IconTile>
        );
        const trailing = (
          <span className={cx("tabular shrink-0 text-base font-bold whitespace-nowrap", m.cantidad > 0 ? "text-ok" : "text-ink")}>
            {cantidadConSigno(m.cantidad, m.unidad)}
          </span>
        );

        if (modo === "global") {
          return (
            <ListLinkRow
              key={m.id}
              href={`/insumos/${m.insumoId}`}
              chevron={false}
              leading={leading}
              title={m.insumoNombre}
              subtitle={`${TIPO_MOVIMIENTO[m.tipo]} · ${referencia(m)} · ${fecha}`}
              trailing={trailing}
            />
          );
        }

        const href = hrefReferencia(m);
        const fila = {
          leading,
          title: referencia(m),
          subtitle: `${TIPO_MOVIMIENTO[m.tipo]} · ${fecha}${m.compra?.numeroFactura ? ` · Factura ${m.compra.numeroFactura}` : ""}`,
          trailing,
        };
        return href ? <ListLinkRow key={m.id} href={href} chevron={false} {...fila} /> : <ListRow key={m.id} {...fila} />;
      })}
    </List>
  );
}
