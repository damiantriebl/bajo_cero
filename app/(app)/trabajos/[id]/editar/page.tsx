import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { obtenerTrabajoParaEditar } from "@/lib/data/trabajos";
import { ListSkeleton, PageHeader } from "@/components/ui/base";
import { FormTrabajo } from "../../_components/form-trabajo";
import { editarTrabajo } from "../../actions";
import { numeroTrabajo } from "../../_components/util";

export const metadata: Metadata = { title: "Editar trabajo" };

export default function EditarTrabajoPage({ params }: PageProps<"/trabajos/[id]/editar">) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Edicion params={params} />
    </Suspense>
  );
}

async function Edicion({ params }: Pick<PageProps<"/trabajos/[id]/editar">, "params">) {
  const { id } = await params;
  const t = await obtenerTrabajoParaEditar(id);
  if (!t) notFound();

  return (
    <>
      <PageHeader
        title="Editar trabajo"
        eyebrow={`${numeroTrabajo(t.numero)} · ${t.cliente.nombre}`}
        back={{ href: `/trabajos/${t.id}`, label: "Volver al trabajo" }}
      />
      <FormTrabajo
        modo="editar"
        accion={editarTrabajo.bind(null, t.id)}
        cliente={t.cliente}
        insumos={t.insumos}
        valores={{
          titulo: t.titulo,
          tipo: t.tipo,
          direccion: t.direccion,
          descripcion: t.descripcion,
          condiciones: t.condiciones,
          validoHasta: t.validoHasta,
          items: t.items,
        }}
        cancelarHref={`/trabajos/${t.id}`}
        textoGuardar="Guardar cambios"
      />
    </>
  );
}
