import type { EstadoTrabajo } from "@/lib/generated/prisma/enums";
import { ESTADO_TRABAJO, FLUJO_TRABAJO } from "@/lib/etiquetas";
import { Badge, cx } from "@/components/ui/base";

/** Barra de pasos Presupuesto → Cobrado con el estado actual resaltado. */
export function EstadoStepper({ estado }: { estado: EstadoTrabajo }) {
  if (estado === "CANCELADO") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Badge tono="danger">Cancelado</Badge>
        Este trabajo se canceló.
      </p>
    );
  }

  const actual = FLUJO_TRABAJO.indexOf(estado);
  return (
    <ol
      aria-label={`Estado del trabajo: ${ESTADO_TRABAJO[estado].label.toLowerCase()}`}
      className="grid grid-cols-5 gap-1 lg:max-w-2xl lg:gap-1.5"
    >
      {FLUJO_TRABAJO.map((e, i) => (
        <li key={e} aria-current={i === actual ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
          <span
            aria-hidden
            className={cx("h-1.5 rounded-full", i < actual ? "bg-night" : i === actual ? "bg-ice" : "bg-track")}
          />
          <span
            className={cx(
              "truncate text-[11px] sm:text-xs",
              i < actual && "font-bold text-ink",
              i === actual && "font-bold text-brand-strong",
              i > actual && "font-semibold text-muted",
            )}
          >
            {ESTADO_TRABAJO[e].label}
            {i < actual && <span className="sr-only"> (hecho)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
