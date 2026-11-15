import { ListSkeleton, Skeleton } from "@/components/ui/base";

/** Relleno para formularios mientras cargan sus opciones. */
export function FormularioSkeleton({ campos = 5 }: { campos?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: campos }, (_, i) => (
        <Skeleton key={i} className="h-[74px]" />
      ))}
    </div>
  );
}

/** Relleno para una ficha: encabezado, bloque principal y lista. */
export function FichaSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-11 w-28" />
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-36 rounded-[20px]" />
      <ListSkeleton rows={4} />
    </div>
  );
}
