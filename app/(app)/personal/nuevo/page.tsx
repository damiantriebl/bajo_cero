import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/base";
import { crearEmpleado } from "../actions";
import { FormEmpleado } from "../_components/form-empleado";

export const metadata: Metadata = { title: "Agregar persona" };

export default function NuevoEmpleadoPage() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 lg:gap-6">
      <PageHeader title="Agregar persona" back={{ href: "/personal", label: "Personal" }} />
      <FormEmpleado accion={crearEmpleado} cancelarHref="/personal" textoBoton="Guardar" />
    </div>
  );
}
