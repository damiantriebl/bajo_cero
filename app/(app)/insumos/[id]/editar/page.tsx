import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, PageHeader, Skeleton } from "@/components/ui/base";
import { categoriasInsumos, obtenerInsumo } from "@/lib/data/insumos";
import { opcionesProveedores } from "@/lib/data/proveedores";
import { editarInsumo } from "../../actions";
import { FormularioSkeleton } from "../../_components/esqueletos";
import { InsumoForm } from "../../_components/insumo-form";

/** Número para un input: 2.5 → "2,5". */
const aTexto = (n: number) => String(n).replace(".", ",");

export default function EditarInsumoPage(props: PageProps<"/insumos/[id]/editar">) {
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="h-20 w-2/3 max-w-md" />
          <Card className="w-full max-w-2xl p-4 lg:p-6">
            <FormularioSkeleton campos={6} />
          </Card>
        </>
      }
    >
      <EditarInsumo params={props.params} />
    </Suspense>
  );
}

async function EditarInsumo({ params }: Pick<PageProps<"/insumos/[id]/editar">, "params">) {
  const { id } = await params;
  const [insumo, categorias, proveedores] = await Promise.all([obtenerInsumo(id), categoriasInsumos(), opcionesProveedores()]);
  if (!insumo) notFound();

  return (
    <>
      <PageHeader title="Editar insumo" back={{ href: `/insumos/${insumo.id}`, label: insumo.nombre }} />
      <Card className="w-full max-w-2xl p-4 lg:p-6">
        <InsumoForm
          modo="editar"
          accion={editarInsumo.bind(null, insumo.id)}
          categorias={categorias}
          proveedores={proveedores}
          cancelarHref={`/insumos/${insumo.id}`}
          valores={{
            nombre: insumo.nombre,
            categoria: insumo.categoria ?? "",
            unidad: insumo.unidad,
            stockMinimo: aTexto(insumo.stockMinimo),
            costoUnitario: String(insumo.costoUnitario),
            precioVenta: insumo.precioVenta !== null ? String(insumo.precioVenta) : "",
            proveedorId: insumo.proveedorId ?? "",
          }}
        />
      </Card>
    </>
  );
}
