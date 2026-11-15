import type { NextRequest } from "next/server";
import { movimientosDelMes, type Movimiento } from "@/lib/data/reportes";
import { partesAR } from "@/lib/fechas";

// CSV del mes para abrir con Excel en castellano: UTF-8 con BOM (para los acentos),
// separador ";" (la coma es el decimal en es-AR) y fin de línea CRLF.

const SEP = ";";

function celda(v: string | number): string {
  const s = String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const fila = (valores: (string | number)[]) => valores.map(celda).join(SEP);

function fecha(d: Date): string {
  const p = partesAR(d);
  return `${String(p.dia).padStart(2, "0")}/${String(p.mes + 1).padStart(2, "0")}/${p.anio}`;
}

const movimiento = (m: Movimiento) => fila([fecha(m.fecha), m.tipo, m.rubro, m.detalle, m.medio, m.monto]);

export async function GET(request: NextRequest) {
  const { mes, cobros, gastos, cobrado, gastado } = await movimientosDelMes(
    request.nextUrl.searchParams.get("mes") ?? undefined,
  );

  const lineas = [
    fila(["Fecha", "Tipo", "Categoría o concepto", "Detalle", "Medio", "Monto"]),
    ...cobros.map(movimiento),
    ...gastos.map(movimiento),
    "",
    fila(["", "", "", "Total cobrado", "", cobrado]),
    fila(["", "", "", "Total gastos", "", gastado]),
    fila(["", "", "", "Ganancia", "", cobrado - gastado]),
  ];

  return new Response(`﻿${lineas.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bajo-cero-${mes.clave}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
