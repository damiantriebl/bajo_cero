import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, PageHeader, Skeleton } from "@/components/ui/base";
import { datosProveedor } from "@/lib/data/proveedores";
import { FormularioSkeleton } from "@/app/(app)/insumos/_components/esqueletos";
import { editarProveedor } from "../../actions";
import { ProveedorForm } from "../../_components/proveedor-form";

export default function EditarProveedorPage(props: PageProps<"/proveedores/[id]/editar">) {
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="h-20 w-2/3 max-w-md" />
          <Card className="w-full max-w-2xl p-4 lg:p-6">
            <FormularioSkeleton campos={7} />
          </Card>
        </>
      }
    >
      <EditarProveedor params={props.params} />
    </Suspense>
  );
}

async function EditarProveedor({ params }: Pick<PageProps<"/proveedores/[id]/editar">, "params">) {
  const { id } = await params;
  const p = await datosProveedor(id);
  if (!p) notFound();

  return (
    <>
      <PageHeader title="Editar proveedor" back={{ href: `/proveedores/${p.id}`, label: p.nombre }} />
      <Card className="w-full max-w-2xl p-4 lg:p-6">
        <ProveedorForm
          modo="editar"
          accion={editarProveedor.bind(null, p.id)}
          cancelarHref={`/proveedores/${p.id}`}
          valores={{
            nombre: p.nombre,
            rubro: p.rubro ?? "",
            contacto: p.contacto ?? "",
            telefono: p.telefono ?? "",
            email: p.email ?? "",
            cuit: p.cuit ?? "",
            direccion: p.direccion ?? "",
            notas: p.notas ?? "",
          }}
        />
      </Card>
    </>
  );
}
