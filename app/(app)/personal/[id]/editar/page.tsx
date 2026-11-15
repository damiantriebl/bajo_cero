import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/base";
import { empleadoParaEditar } from "@/lib/data/personal";
import { actualizarEmpleado } from "../../actions";
import { FormEmpleado } from "../../_components/form-empleado";

export const metadata: Metadata = { title: "Editar persona" };

export default function EditarEmpleadoPage({ params }: PageProps<"/personal/[id]/editar">) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 lg:gap-6">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-20" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        <Editar params={params} />
      </Suspense>
    </div>
  );
}

async function Editar({ params }: Pick<PageProps<"/personal/[id]/editar">, "params">) {
  const { id } = await params;
  const e = await empleadoParaEditar(id);
  if (!e) notFound();
  return (
    <>
      <PageHeader title={`Editar a ${e.nombre}`} back={{ href: `/personal/${id}`, label: e.nombre }} />
      <FormEmpleado
        accion={actualizarEmpleado.bind(null, id)}
        empleado={e}
        cancelarHref={`/personal/${id}`}
        textoBoton="Guardar cambios"
      />
    </>
  );
}
