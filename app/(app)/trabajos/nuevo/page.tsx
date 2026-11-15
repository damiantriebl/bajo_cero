import type { Metadata } from "next";
import { Suspense } from "react";
import { datosNuevoTrabajo } from "@/lib/data/trabajos";
import { ButtonLink, EmptyState, ListSkeleton, PageHeader } from "@/components/ui/base";
import { FormTrabajo } from "../_components/form-trabajo";
import { crearTrabajo } from "../actions";

export const metadata: Metadata = { title: "Nuevo presupuesto" };

export default function NuevoTrabajoPage({ searchParams }: PageProps<"/trabajos/nuevo">) {
  return (
    <>
      <PageHeader title="Nuevo presupuesto" back={{ href: "/trabajos", label: "Trabajos" }} />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Formulario({ searchParams }: Pick<PageProps<"/trabajos/nuevo">, "searchParams">) {
  const sp = await searchParams;
  const datos = await datosNuevoTrabajo();

  if (datos.clientes.length === 0) {
    return (
      <EmptyState
        title="Primero cargá un cliente"
        description="El presupuesto va a nombre de un cliente. Cargalo y después volvé acá."
        action={<ButtonLink href="/clientes/nuevo">Cargar cliente</ButtonLink>}
      />
    );
  }

  const pedido = typeof sp.cliente === "string" ? sp.cliente : "";
  const clienteInicial = datos.clientes.some((c) => c.id === pedido) ? pedido : "";

  return (
    <FormTrabajo
      modo="nuevo"
      accion={crearTrabajo}
      clientes={datos.clientes}
      clienteInicial={clienteInicial}
      insumos={datos.insumos}
      valores={{
        titulo: "",
        tipo: "INSTALACION",
        direccion: "",
        descripcion: "",
        condiciones: datos.condiciones,
        validoHasta: datos.validoHasta,
        items: [],
      }}
      cancelarHref={clienteInicial ? `/clientes/${clienteInicial}` : "/trabajos"}
      textoGuardar="Guardar presupuesto"
    />
  );
}
