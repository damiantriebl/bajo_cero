import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/base";
import { esCategoria, opcionesNuevoGasto } from "@/lib/data/gastos";
import { primero } from "../../reportes/_components/mes";
import { FormGasto } from "../_components/form-gasto";

export const metadata: Metadata = { title: "Cargar gasto" };

export default function NuevoGastoPage({ searchParams }: PageProps<"/gastos/nuevo">) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 lg:gap-6">
      <PageHeader title="Cargar gasto" back={{ href: "/gastos", label: "Gastos" }} />
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Formulario({ searchParams }: Pick<PageProps<"/gastos/nuevo">, "searchParams">) {
  const sp = await searchParams;
  const opciones = await opcionesNuevoGasto();
  const categoria = primero(sp.categoria);
  return <FormGasto {...opciones} categoriaInicial={esCategoria(categoria) ? categoria : undefined} />;
}
