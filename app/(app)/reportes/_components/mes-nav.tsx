import { Skeleton } from "@/components/ui/base";
import { infoMes, type MesInfo } from "@/lib/data/reportes";
import { conParams, primero } from "./mes";
import { SelectorMes } from "./selector-mes";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

/** Selector de mes que conserva otros filtros de la URL (p. ej. ?categoria=). */
export function MesNav({
  mes,
  base,
  params = {},
}: {
  mes: MesInfo;
  base: string;
  params?: Record<string, string | undefined>;
}) {
  const href = (clave: string) => conParams(base, { ...params, mes: clave });
  return (
    <SelectorMes
      actual={mes.clave}
      anterior={{ href: href(mes.anterior.clave), label: mes.anterior.label }}
      siguiente={mes.siguiente ? { href: href(mes.siguiente.clave), label: mes.siguiente.label } : null}
      opciones={mes.opciones.map((o) => ({ ...o, href: href(o.clave) }))}
    />
  );
}

/** Igual que MesNav, pero lee el mes de searchParams. Usar dentro de <Suspense>. */
export async function MesNavDesdeUrl({
  base,
  searchParams,
  conservar = [],
}: {
  base: string;
  searchParams: Busqueda;
  /** Otros parámetros de la URL que se mantienen al cambiar de mes. */
  conservar?: string[];
}) {
  const sp = await searchParams;
  const mes = await infoMes(primero(sp.mes));
  const params = Object.fromEntries(conservar.map((k) => [k, primero(sp[k])]));
  return <MesNav mes={mes} base={base} params={params} />;
}

export function MesNavSkeleton() {
  return <Skeleton className="h-11 w-56" />;
}
