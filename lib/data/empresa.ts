import "server-only";
import { leerDb } from "@/lib/db";
import { EMPRESA_DEFECTO } from "@/lib/empresa-defecto";

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

/**
 * Datos de la empresa (encabezan el presupuesto impreso y el cierre del mes).
 * Mientras no se guardaron en Ajustes no hay fila: se usan los de EMPRESA_DEFECTO.
 */
export async function datosEmpresa(): Promise<DatosEmpresa> {
  const prisma = await leerDb();
  const e =
    (await prisma.empresa.findUnique({
      where: { id: EMPRESA_DEFECTO.id },
      select: {
        razonSocial: true,
        nombreFantasia: true,
        cuit: true,
        telefono: true,
        email: true,
        direccion: true,
        condicionesPresupuesto: true,
        garantia: true,
        validezPresupuestoDias: true,
      },
    })) ?? EMPRESA_DEFECTO;
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
