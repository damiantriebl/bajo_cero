import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/base";
import { categoriasInsumos } from "@/lib/data/insumos";
import { opcionesProveedores } from "@/lib/data/proveedores";
import { crearInsumo } from "../actions";
import { FormularioSkeleton } from "../_components/esqueletos";
import { InsumoForm } from "../_components/insumo-form";

export default function NuevoInsumoPage() {
  return (
    <>
      <PageHeader title="Nuevo insumo" back={{ href: "/insumos", label: "Insumos" }} />
      <Card className="w-full max-w-2xl p-4 lg:p-6">
        <Suspense fallback={<FormularioSkeleton campos={6} />}>
          <FormularioNuevo />
        </Suspense>
      </Card>
    </>
  );
}

async function FormularioNuevo() {
  const [categorias, proveedores] = await Promise.all([categoriasInsumos(), opcionesProveedores()]);
  return (
    <InsumoForm modo="crear" accion={crearInsumo} categorias={categorias} proveedores={proveedores} cancelarHref="/insumos" />
  );
}
