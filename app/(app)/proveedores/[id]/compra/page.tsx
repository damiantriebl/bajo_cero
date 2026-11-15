import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ListSkeleton, PageHeader, Skeleton } from "@/components/ui/base";
import { hoyInputFecha, itemsPedidoDeProveedor, opcionesInsumos } from "@/lib/data/insumos";
import { datosProveedor } from "@/lib/data/proveedores";
import { cargarCompra } from "../../actions";
import { CompraForm } from "../../_components/compra-form";

export default function CargarCompraPage(props: PageProps<"/proveedores/[id]/compra">) {
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="h-24 w-2/3 max-w-md" />
          <ListSkeleton rows={3} />
        </>
      }
    >
      <CargarCompra params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CargarCompra({ params, searchParams }: PageProps<"/proveedores/[id]/compra">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const desdePedido = sp.pedido === "1";

  const [proveedor, insumos, hoy, inicial] = await Promise.all([
    datosProveedor(id),
    opcionesInsumos(),
    hoyInputFecha(),
    desdePedido ? itemsPedidoDeProveedor(id) : Promise.resolve([]),
  ]);
  if (!proveedor) notFound();

  return (
    <>
      <PageHeader title="Cargar compra" back={{ href: `/proveedores/${proveedor.id}`, label: proveedor.nombre }} />
      {desdePedido && inicial.length > 0 && (
        <p className="text-[15px] text-muted">Cargamos lo del pedido sugerido. Corregí cantidades y precios según la factura.</p>
      )}
      <CompraForm
        accion={cargarCompra.bind(null, proveedor.id)}
        hoy={hoy}
        proveedorId={proveedor.id}
        proveedorNombre={proveedor.nombre}
        insumos={insumos}
        inicial={inicial}
        cancelarHref={`/proveedores/${proveedor.id}`}
      />
    </>
  );
}
