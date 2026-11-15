import { Card, PageHeader } from "@/components/ui/base";
import { crearProveedor } from "../actions";
import { ProveedorForm } from "../_components/proveedor-form";

export default function NuevoProveedorPage() {
  return (
    <>
      <PageHeader title="Nuevo proveedor" back={{ href: "/proveedores", label: "Proveedores" }} />
      <Card className="w-full max-w-2xl p-4 lg:p-6">
        <ProveedorForm modo="crear" accion={crearProveedor} cancelarHref="/proveedores" />
      </Card>
    </>
  );
}
