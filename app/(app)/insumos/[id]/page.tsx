import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, Eyebrow, HeroCard, PageHeader, SectionTitle, Stat } from "@/components/ui/base";
import { obtenerInsumo } from "@/lib/data/insumos";
import { UNIDAD } from "@/lib/etiquetas";
import { formatNumero, formatPesos, formatPorcentaje } from "@/lib/formato";
import { ajustarStock } from "../actions";
import { AjusteForm } from "../_components/ajuste-form";
import { FichaSkeleton } from "../_components/esqueletos";
import { MovimientosLista } from "../_components/movimientos";
import { ESTADO_STOCK, abreviatura, cantidadUnidad, margen } from "../_components/stock";

export default function InsumoPage(props: PageProps<"/insumos/[id]">) {
  return (
    <Suspense fallback={<FichaSkeleton />}>
      <FichaInsumo params={props.params} />
    </Suspense>
  );
}

async function FichaInsumo({ params }: Pick<PageProps<"/insumos/[id]">, "params">) {
  const { id } = await params;
  const insumo = await obtenerInsumo(id);
  if (!insumo) notFound();

  const estado = ESTADO_STOCK[insumo.estado];
  const margenVenta = margen(insumo.costoUnitario, insumo.precioVenta);
  const unidad = UNIDAD[insumo.unidad];

  return (
    <>
      <PageHeader
        back={{ href: "/insumos", label: "Insumos" }}
        eyebrow={insumo.categoria ?? undefined}
        title={insumo.nombre}
        actions={
          <ButtonLink href={`/insumos/${insumo.id}/editar`} variante="secondary" tamano="sm">
            <Pencil aria-hidden className="size-[18px]" />
            Editar
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        {/* Stock y precios */}
        <div className="flex flex-col gap-3 lg:col-start-1">
          <HeroCard>
            <div className="flex items-center justify-between gap-3">
              <Eyebrow tono="night">Stock actual</Eyebrow>
              <Badge tono={estado.tono}>{estado.label}</Badge>
            </div>
            <p className="tabular text-[40px] leading-none font-bold">
              {formatNumero(insumo.stock)} <span className="text-2xl">{abreviatura(insumo.stock, insumo.unidad)}</span>
            </p>
            <p className="text-sm text-night-text">
              Mínimo {cantidadUnidad(insumo.stockMinimo, insumo.unidad)}
              {insumo.estado !== "ok" && ` · Conviene pedir ${cantidadUnidad(Math.max(1, insumo.aPedir), insumo.unidad)}`}
            </p>
            {insumo.estado !== "ok" && (
              <ButtonLink href="/insumos/pedido" variante="ice" className="mt-1 self-start">
                Armar pedido
              </ButtonLink>
            )}
          </HeroCard>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Costo" value={formatPesos(insumo.costoUnitario)} hint={`por ${unidad.uno}`} />
            <Stat
              label="Precio de venta"
              value={insumo.precioVenta !== null ? formatPesos(insumo.precioVenta) : "—"}
              hint={margenVenta !== null ? `Margen ${formatPorcentaje(margenVenta)}` : "Sin cargar"}
              tono={margenVenta !== null && margenVenta > 0 ? "ok" : undefined}
            />
            {insumo.proveedor ? (
              <Stat
                className="col-span-2 lg:col-span-1"
                label="Proveedor habitual"
                value={<span className="text-lg leading-snug">{insumo.proveedor.nombre}</span>}
                hint="Ver cuenta y compras"
                href={`/proveedores/${insumo.proveedor.id}`}
              />
            ) : (
              <Stat
                className="col-span-2 lg:col-span-1"
                label="Proveedor habitual"
                value={<span className="text-lg leading-snug">Sin proveedor</span>}
                hint="Elegilo en Editar para armar pedidos"
              />
            )}
          </div>
        </div>

        {/* Ajuste manual */}
        <Card className="flex flex-col gap-3 p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-bold">Ajustar stock</h2>
            <p className="text-sm text-muted">Para corregir después de contar, o si algo se rompió o se devolvió.</p>
          </div>
          <AjusteForm accion={ajustarStock.bind(null, insumo.id)} unidad={insumo.unidad} />
        </Card>

        {/* Historial */}
        <section className="flex flex-col gap-2 lg:col-start-1" aria-labelledby="titulo-historial">
          <SectionTitle>
            <span id="titulo-historial">Movimientos</span>
          </SectionTitle>
          {insumo.movimientos.length > 0 ? (
            <MovimientosLista movimientos={insumo.movimientos} hoy={insumo.hoy} modo="insumo" />
          ) : (
            <EmptyState
              title="Sin movimientos todavía"
              description="Las compras, los consumos en trabajos y los ajustes van a aparecer acá."
            />
          )}
        </section>
      </div>
    </>
  );
}
