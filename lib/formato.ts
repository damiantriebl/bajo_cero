// Formatos de números para Argentina.

const pesos = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** 1775000 → "$ 1.775.000" */
export function formatPesos(monto: number): string {
  const signo = monto < 0 ? "− " : "";
  return `${signo}$ ${pesos.format(Math.abs(Math.round(monto)))}`;
}

/** 2.5 → "2,5" */
export function formatNumero(n: number): string {
  return decimal.format(n);
}

/** 0.6 → "60 %" */
export function formatPorcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`;
}

/** "1.775.000" o "1775000,50" → 1775000 (para inputs de montos). */
export function parsePesos(valor: FormDataEntryValue | null): number | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.replace(/[$\s.]/g, "").replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Link de WhatsApp con texto. Teléfonos argentinos sin el 0 ni el 15. */
export function linkWhatsApp(telefono: string | null | undefined, texto?: string): string {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  const numero = digitos.startsWith("54") ? digitos : digitos ? `549${digitos.replace(/^0/, "")}` : "";
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return `https://wa.me/${numero}${q}`;
}

/** Link a Google Maps para una dirección. */
export function linkMapa(direccion: string | null | undefined): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion ?? "")}`;
}
