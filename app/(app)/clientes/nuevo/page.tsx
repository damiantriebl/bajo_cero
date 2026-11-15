import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/base";
import { crearCliente } from "../actions";
import { ClienteForm } from "../_components/cliente-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NuevoClientePage() {
  return (
    <>
      <PageHeader title="Nuevo cliente" back={{ href: "/clientes", label: "Clientes" }} />
      <ClienteForm action={crearCliente} textoBoton="Guardar cliente" cancelarHref="/clientes" />
    </>
  );
}
