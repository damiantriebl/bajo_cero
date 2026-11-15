import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/base";
import { obtenerOpcionesTurno } from "@/lib/data/agenda";
import { parseFechaInput } from "@/lib/fechas";
import { NuevoTurnoForm } from "../_components/formularios";
import { DURACION_POR_DEFECTO, esDuracionValida, numeroTrabajo } from "../_components/utilidades";

export const metadata: Metadata = { title: "Nuevo turno" };

export default function NuevoTurnoPage(props: PageProps<"/agenda/nuevo">) {
  return (
    <>
      <PageHeader title="Nuevo turno" back={{ href: "/agenda", label: "Agenda" }} />
      <Suspense fallback={<FormularioCargando />}>
        <Formulario searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function FormularioCargando() {
  return (
    <Card className="flex flex-col gap-5 p-4 lg:max-w-3xl lg:p-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-19" />
      <Skeleton className="h-19" />
      <Skeleton className="h-24" />
      <Skeleton className="h-13" />
    </Card>
  );
}

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Formulario({ searchParams }: Pick<PageProps<"/agenda/nuevo">, "searchParams">) {
  const sp = await searchParams;
  const { trabajos, tecnicos, hoyIso } = await obtenerOpcionesTurno();

  if (trabajos.length === 0) {
    return (
      <EmptyState
        title="No hay trabajos para agendar"
        description="Para agendar una visita primero cargá el presupuesto del trabajo."
        action={<ButtonLink href="/trabajos/nuevo">Nuevo presupuesto</ButtonLink>}
      />
    );
  }

  const trabajo = texto(sp.trabajo);
  const fecha = texto(sp.fecha);
  const hora = texto(sp.hora);
  const duracion = Number(texto(sp.duracion));

  return (
    <Card className="p-4 lg:max-w-3xl lg:p-6">
      <NuevoTurnoForm
        trabajos={trabajos.map((t) => ({
          id: t.id,
          label: `${numeroTrabajo(t.numero)} · ${t.cliente} · ${t.titulo}`,
          sinFecha: t.sinFecha,
        }))}
        tecnicos={tecnicos}
        inicial={{
          trabajoId: trabajo && trabajos.some((t) => t.id === trabajo) ? trabajo : "",
          fecha: fecha && parseFechaInput(fecha) ? fecha : hoyIso,
          hora: hora && /^([01]?\d|2[0-3]):[0-5]\d$/.test(hora) ? hora.padStart(5, "0") : "09:00",
          duracion: String(esDuracionValida(duracion) ? duracion : DURACION_POR_DEFECTO),
        }}
      />
    </Card>
  );
}
