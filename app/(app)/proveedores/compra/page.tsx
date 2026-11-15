import { Suspense } from "react";
import { Plus, Truck } from "lucide-react";
import { EmptyState, ButtonLink, IconTile, List, ListLinkRow, ListSkeleton, PageHeader } from "@/components/ui/base";
import { opcionesProveedores } from "@/lib/data/proveedores";

/** Paso previo a cargar una compra: elegir a quién se le compró. */
export default function ElegirProveedorPage() {
  return (
    <>
      <PageHeader title="Cargar compra" back={{ href: "/proveedores", label: "Proveedores" }} />
      <p className="text-[15px] text-muted">¿A quién le compraste?</p>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <ListaProveedores />
      </Suspense>
    </>
  );
}

async function ListaProveedores() {
  const proveedores = await opcionesProveedores();

  if (proveedores.length === 0) {
    return (
      <EmptyState
        title="Todavía no cargaste proveedores"
        description="Primero cargá el proveedor; después le cargás la compra."
        action={<ButtonLink href="/proveedores/nuevo">Nuevo proveedor</ButtonLink>}
      />
    );
  }

  return (
    <List className="max-w-2xl">
      {proveedores.map((p) => (
        <ListLinkRow
          key={p.id}
          href={`/proveedores/${p.id}/compra`}
          leading={
            <IconTile>
              <Truck className="size-5" />
            </IconTile>
          }
          title={p.nombre}
          subtitle={p.rubro ?? undefined}
        />
      ))}
      <ListLinkRow
        href="/proveedores/nuevo"
        leading={
          <IconTile tono="neutral">
            <Plus className="size-5" />
          </IconTile>
        }
        title="Otro proveedor"
        subtitle="Cargalo primero y después la compra"
      />
    </List>
  );
}
