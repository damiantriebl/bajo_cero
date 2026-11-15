import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Pencil } from "lucide-react";
import { obtenerPresupuesto, resumenTrabajo, type Presupuesto } from "@/lib/data/trabajos";
import { ESTADO_TRABAJO } from "@/lib/etiquetas";
import { formatFechaCompleta } from "@/lib/fechas";
import { formatPesos, linkWhatsApp } from "@/lib/formato";
import { Badge, ButtonLink, Skeleton, buttonClass } from "@/components/ui/base";
import { BotonImprimir } from "../../_components/boton-imprimir";
import { HojaPresupuesto } from "../../_components/hoja-presupuesto";
import { numeroCorto, numeroTrabajo } from "../../_components/util";

export async function generateMetadata({ params }: PageProps<"/trabajos/[id]/presupuesto">): Promise<Metadata> {
  const { id } = await params;
  const r = await resumenTrabajo(id);
  // El título de la pestaña es el nombre que propone el navegador al guardar el PDF.
  return { title: r ? `Presupuesto ${numeroCorto(r.numero)} · ${r.cliente}` : "Presupuesto" };
}

/** Al imprimir: solo la hoja, en A4, sin el menú de la app. */
const CSS_IMPRESION = `
@page { size: A4; margin: 14mm 12mm; }
@media print {
  body:has([data-presupuesto]) main {
    padding: 0 !important;
    margin: 0 !important;
    max-width: none !important;
    gap: 0 !important;
  }
}
`;

export default function PresupuestoPage({ params }: PageProps<"/trabajos/[id]/presupuesto">) {
  return (
    <>
      <style>{CSS_IMPRESION}</style>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando presupuesto">
            <Skeleton className="h-11 w-64" />
            <Skeleton className="mx-auto aspect-[210/297] w-full max-w-[800px] rounded-md" />
          </div>
        }
      >
        <Documento params={params} />
      </Suspense>
    </>
  );
}

async function Documento({ params }: Pick<PageProps<"/trabajos/[id]/presupuesto">, "params">) {
  const { id } = await params;
  const p = await obtenerPresupuesto(id);
  if (!p) notFound();

  const url = await urlDeEstaPagina(p.id);
  const estado = ESTADO_TRABAJO[p.estado];

  return (
    <div data-presupuesto className="flex flex-col gap-4">
      <div className="no-print -ml-2 flex items-center gap-2">
        <Link
          href={`/trabajos/${p.id}`}
          aria-label="Volver al trabajo"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold lg:text-lg">Presupuesto {numeroTrabajo(p.numero)}</h1>
        <Badge tono={estado.tono}>{estado.label}</Badge>
      </div>

      {/* En el celular los botones van debajo de la hoja; en la computadora, arriba. */}
      <div className="no-print order-last flex flex-col gap-2.5 lg:order-none lg:flex-row lg:flex-wrap lg:items-center">
        <a
          href={linkWhatsApp(p.cliente.telefono, mensajeWhatsApp(p, url))}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("primary", "lg", "w-full lg:w-auto")}
        >
          <MessageCircle aria-hidden className="size-5" />
          Enviar por WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2.5 lg:flex">
          <BotonImprimir className="w-full lg:w-auto" />
          <ButtonLink href={`/trabajos/${p.id}/editar`} variante="secondary" className="w-full lg:w-auto">
            <Pencil aria-hidden className="size-5" />
            Editar
          </ButtonLink>
        </div>
        {!p.cliente.telefono && (
          <p className="text-[13px] text-muted lg:basis-full">
            El cliente no tiene teléfono cargado: elegí el contacto en WhatsApp.
          </p>
        )}
      </div>

      <p className="no-print text-[13px] font-semibold text-muted-strong">
        Así lo ve el cliente.{" "}
        <Link href={`/presupuesto/${p.id}`} className="underline" target="_blank">
          Abrir el link que recibe
        </Link>
      </p>

      <HojaPresupuesto p={p} />
    </div>
  );
}

/** Dirección pública del presupuesto (fuera de la app), para mandarla en el mensaje. */
async function urlDeEstaPagina(id: string): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}/presupuesto/${id}`;
}

function mensajeWhatsApp(p: Presupuesto, url: string | null): string {
  const particular = p.cliente.tipo === "PARTICULAR";
  const nombre = p.cliente.nombre.split(" ")[0];
  const lineas = [
    `${particular ? `Hola, ${nombre}.` : "Hola."} ${particular ? "Te" : "Les"} paso el presupuesto ${numeroTrabajo(p.numero)} de ${p.empresa.nombreFantasia}: ${p.titulo}.`,
    `Total: ${formatPesos(p.total)}.`,
    p.validoHasta ? `Válido hasta el ${formatFechaCompleta(p.validoHasta)}.` : null,
    url ? `${particular ? "Lo podés" : "Lo pueden"} ver acá: ${url}` : null,
  ];
  return lineas.filter(Boolean).join("\n");
}
