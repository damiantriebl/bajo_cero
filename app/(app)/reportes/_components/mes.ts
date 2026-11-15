// Ayudas puras para el mes elegido por URL (?mes=YYYY-MM).

/** Primer valor de un searchParam (puede venir repetido). */
export function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Arma un href con query, omitiendo los valores vacíos. */
export function conParams(base: string, params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
