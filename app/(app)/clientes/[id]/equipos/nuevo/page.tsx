import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/base";
import { obtenerNombreCliente } from "@/lib/data/clientes";
import { crearEquipo } from "../../../actions";
import { EquipoForm } from "../../../_components/equipo-form";

export const metadata: Metadata = { title: "Agregar equipo" };

type Props = { params: Promise<{ id: string }> };

export default function NuevoEquipoPage({ params }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NuevoEquipo params={params} />
    </Suspense>
  );
}

async function NuevoEquipo({ params }: Props) {
  const { id } = await params;
  const cliente = await obtenerNombreCliente(id);
  if (!cliente) notFound();

  return (
    <>
      <PageHeader title="Agregar equipo" eyebrow={cliente.nombre} back={{ href: `/clientes/${id}`, label: "Volver" }} />
      <EquipoForm action={crearEquipo.bind(null, id)} cancelarHref={`/clientes/${id}`} />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-11 w-28" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[440px]" />
    </div>
  );
}
