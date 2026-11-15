import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/base";
import { datosNuevoCobro } from "@/lib/data/cobros";
import { aInputFecha } from "@/lib/fechas";
import { primero } from "../../clientes/_components/cuenta";
import { registrarCobro } from "../actions";
import { CobroForm } from "../_components/cobro-form";

export const metadata: Metadata = { title: "Registrar cobro" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function NuevoCobroPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NuevoCobro searchParams={searchParams} />
    </Suspense>
  );
}

async function NuevoCobro({ searchParams }: Props) {
  const sp = await searchParams;
  const trabajoParam = primero(sp.trabajo);
  const clienteParam = primero(sp.cliente);
  const { clientes, hoy } = await datosNuevoCobro(trabajoParam);

  // ?trabajo= manda: también define el cliente.
  const delTrabajo = trabajoParam ? clientes.find((c) => c.trabajos.some((t) => t.id === trabajoParam)) : undefined;
  const cliente = delTrabajo ?? clientes.find((c) => c.id === clienteParam);
  const trabajoId = delTrabajo ? trabajoParam : undefined;

  const volver = delTrabajo
    ? { href: `/trabajos/${trabajoId}`, label: "Trabajo" }
    : cliente
      ? { href: `/clientes/${cliente.id}`, label: cliente.nombre }
      : { href: "/cobros", label: "Cobros" };

  return (
    <>
      <PageHeader title="Registrar cobro" back={volver} />
      <CobroForm
        // Remonta el formulario si cambia el cliente o el trabajo de la URL.
        key={`${cliente?.id ?? ""}-${trabajoId ?? ""}`}
        action={registrarCobro}
        clientes={clientes}
        clienteInicial={cliente?.id}
        trabajoInicial={trabajoId}
        hoy={aInputFecha(hoy)}
        cancelarHref={volver.href}
      />
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:max-w-3xl" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-11 w-28" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-[560px]" />
    </div>
  );
}
