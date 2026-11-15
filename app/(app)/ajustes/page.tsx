import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui/base";
import { datosEmpresa } from "@/lib/data/empresa";
import { FormEmpresa } from "./_components/form-empresa";

export const metadata: Metadata = { title: "Ajustes" };

export default function AjustesPage() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 lg:gap-6">
      <PageHeader title="Ajustes" eyebrow="Empresa y presupuestos" />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando datos de la empresa">
            <Skeleton className="h-80" />
            <Skeleton className="h-72" />
          </div>
        }
      >
        <Formulario />
      </Suspense>
    </div>
  );
}

async function Formulario() {
  return <FormEmpresa empresa={await datosEmpresa()} />;
}
