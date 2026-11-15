import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/base";
import { obtenerDatosCliente } from "@/lib/data/clientes";
import { editarCliente } from "../../actions";
import { ClienteForm } from "../../_components/cliente-form";

export const metadata: Metadata = { title: "Editar cliente" };

type Props = { params: Promise<{ id: string }> };

export default function EditarClientePage({ params }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({ params }: Props) {
  const { id } = await params;
  const cliente = await obtenerDatosCliente(id);
  if (!cliente) notFound();

  return (
    <>
      <PageHeader title="Editar cliente" eyebrow={cliente.nombre} back={{ href: `/clientes/${id}`, label: "Volver" }} />
      <ClienteForm
        action={editarCliente.bind(null, id)}
        cliente={{
          nombre: cliente.nombre,
          tipo: cliente.tipo,
          telefono: cliente.telefono,
          email: cliente.email,
          direccion: cliente.direccion,
          localidad: cliente.localidad,
          cuit: cliente.cuit,
          notas: cliente.notas,
        }}
        textoBoton="Guardar cambios"
        cancelarHref={`/clientes/${id}`}
      />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-11 w-28" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[520px]" />
    </div>
  );
}
