import type { Empresa } from "@/lib/generated/prisma/client";

/**
 * Datos de la empresa mientras no se cargaron en Ajustes (la base de producción
 * arranca sin la fila "empresa"). Los textos entre corchetes se ven en el
 * presupuesto para que se note qué falta completar.
 */
export const EMPRESA_DEFECTO: Empresa = {
  id: "empresa",
  razonSocial: "[RAZÓN SOCIAL]",
  nombreFantasia: "Bajo Cero",
  cuit: null,
  telefono: null,
  email: null,
  direccion: null,
  condicionesPresupuesto:
    "Seña del 50 % para reservar la fecha; el saldo al terminar.\nPasada la fecha de validez, los precios pueden cambiar.",
  garantia: null,
  validezPresupuestoDias: 15,
};
