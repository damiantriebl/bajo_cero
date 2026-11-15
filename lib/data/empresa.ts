import "server-only";
import { leerStore } from "@/lib/mock/store";

export type DatosEmpresa = {
  razonSocial: string;
  nombreFantasia: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  condicionesPresupuesto: string | null;
  garantia: string | null;
  validezPresupuestoDias: number;
};

/** Datos de la empresa (encabezan el presupuesto impreso y el cierre del mes). */
export async function datosEmpresa(): Promise<DatosEmpresa> {
  const s = await leerStore();
  const e = s.empresa;
  return {
    razonSocial: e.razonSocial,
    nombreFantasia: e.nombreFantasia,
    cuit: e.cuit,
    telefono: e.telefono,
    email: e.email,
    direccion: e.direccion,
    condicionesPresupuesto: e.condicionesPresupuesto,
    garantia: e.garantia,
    validezPresupuestoDias: e.validezPresupuestoDias,
  };
}
