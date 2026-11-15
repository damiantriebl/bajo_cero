// Presupuesto público: es el link que se manda al cliente por WhatsApp.
// Está FUERA del grupo (app): sin menú ni acceso al resto del sistema.
// El id es un identificador largo e imposible de adivinar; cuando haya login,
// esta ruta tiene que quedar abierta (no pedir sesión).
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { obtenerPresupuesto, resumenTrabajo } from "@/lib/data/trabajos";
import { Skeleton } from "@/components/ui/base";
import { HojaPresupuesto } from "@/app/(app)/trabajos/_components/hoja-presupuesto";
import { BotonImprimir } from "@/app/(app)/trabajos/_components/boton-imprimir";
import { numeroCorto } from "@/app/(app)/trabajos/_components/util";

export async function generateMetadata({ params }: PageProps<"/presupuesto/[id]">): Promise<Metadata> {
  const { id } = await params;
  const r = await resumenTrabajo(id);
  return {
    title: r ? `Presupuesto ${numeroCorto(r.numero)} · ${r.cliente}` : "Presupuesto",
    robots: { index: false, follow: false },
  };
}

const CSS_IMPRESION = `@page { size: A4; margin: 14mm 12mm; }`;

export default function PresupuestoPublico({ params }: PageProps<"/presupuesto/[id]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[848px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-8 print:p-0">
      <style>{CSS_IMPRESION}</style>
      <Suspense fallback={<Skeleton className="mx-auto aspect-[210/297] w-full rounded-md" />}>
        <Contenido params={params} />
      </Suspense>
    </main>
  );
}

async function Contenido({ params }: Pick<PageProps<"/presupuesto/[id]">, "params">) {
  const { id } = await params;
  const p = await obtenerPresupuesto(id);
  if (!p || p.estado === "CANCELADO") notFound();

  return (
    <>
      <HojaPresupuesto p={p} />
      <div className="no-print flex justify-center">
        <BotonImprimir />
      </div>
    </>
  );
}
