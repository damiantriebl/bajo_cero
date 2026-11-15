import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Card, Eyebrow, Money, PageHeader, Skeleton } from "@/components/ui/base";
import { detalleGasto } from "@/lib/data/gastos";
import { formatFechaCompleta } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";
import { eliminarGasto } from "../actions";
import { ConfirmarEliminar } from "../_components/confirmar-eliminar";

export const metadata: Metadata = { title: "Gasto" };

export default function GastoPage({ params }: PageProps<"/gastos/[id]">) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 lg:gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando gasto">
            <Skeleton className="h-24" />
            <Skeleton className="h-72" />
          </div>
        }
      >
        <DetalleGasto params={params} />
      </Suspense>
    </div>
  );
}

function Fila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-13 items-center justify-between gap-4 px-4 py-3">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  );
}

const enlace = "text-brand hover:underline";

async function DetalleGasto({ params }: Pick<PageProps<"/gastos/[id]">, "params">) {
  const { id } = await params;
  const g = await detalleGasto(id);
  if (!g) notFound();

  return (
    <>
      <PageHeader back={{ href: `/gastos?mes=${g.mesClave}`, label: "Gastos" }} eyebrow={g.categoriaLabel} title={g.descripcion} />

      <Card className="flex flex-col gap-1 p-4 lg:p-5">
        <Eyebrow>Monto</Eyebrow>
        <Money value={g.monto} className="text-[30px] leading-tight font-bold" />
      </Card>

      <Card className="overflow-hidden">
        <dl className="divide-y divide-line-soft">
          <Fila label="Fecha">{formatFechaCompleta(g.fecha)}</Fila>
          <Fila label="Categoría">{g.categoriaLabel}</Fila>
          <Fila label="Medio de pago">{g.medioLabel}</Fila>
          {g.empleado && (
            <Fila label="Personal">
              <Link href={`/personal/${g.empleado.id}?mes=${g.mesClave}`} className={enlace}>
                {g.empleado.nombre}
              </Link>
            </Fila>
          )}
          {g.trabajo && (
            <Fila label="Trabajo">
              <Link href={`/trabajos/${g.trabajo.id}`} className={enlace}>
                #{g.trabajo.numero} · {g.trabajo.titulo}
              </Link>
            </Fila>
          )}
          {g.proveedor && (
            <Fila label="Proveedor">
              <Link href={`/proveedores/${g.proveedor.id}`} className={enlace}>
                {g.proveedor.nombre}
              </Link>
            </Fila>
          )}
          {g.notas && (
            <div className="flex flex-col gap-1 px-4 py-3">
              <dt className="text-sm font-semibold text-muted">Notas</dt>
              <dd className="whitespace-pre-line">{g.notas}</dd>
            </div>
          )}
        </dl>
      </Card>

      {g.esCompra ? (
        <p className="rounded-xl bg-brand-soft px-3.5 py-3 text-sm text-brand-strong">
          Este gasto es una compra a un proveedor. Para corregirla o borrarla, entrá a{" "}
          {g.proveedor ? (
            <Link href={`/proveedores/${g.proveedor.id}`} className="font-bold underline">
              {g.proveedor.nombre}
            </Link>
          ) : (
            <Link href="/proveedores" className="font-bold underline">
              Proveedores
            </Link>
          )}
          .
        </p>
      ) : (
        <div className="flex">
          <ConfirmarEliminar
            accion={eliminarGasto.bind(null, g.id)}
            titulo="¿Eliminar este gasto?"
            descripcion={`Se borra “${g.descripcion}” por ${formatPesos(g.monto)}. No se puede deshacer.`}
            etiqueta="Eliminar gasto"
          />
        </div>
      )}
    </>
  );
}
