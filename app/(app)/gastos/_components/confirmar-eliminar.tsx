"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, FormError, cx } from "@/components/ui/base";
import { Sheet, SubmitButton } from "@/components/ui/client";
import type { EstadoForm } from "@/lib/forms";

/** Botón "Eliminar" que pide confirmación en una hoja antes de llamar a la acción. */
export function ConfirmarEliminar({
  accion,
  titulo,
  descripcion,
  etiqueta = "Eliminar",
  /** "icono": botón chico solo con ícono (requiere `ariaLabel`). */
  forma = "normal",
  ariaLabel,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  titulo: string;
  descripcion: string;
  etiqueta?: string;
  forma?: "normal" | "icono";
  ariaLabel?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, formAction] = useActionState(accion, null);

  return (
    <>
      {forma === "icono" ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label={ariaLabel ?? etiqueta}
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors",
            "hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-brand",
          )}
        >
          <Trash2 aria-hidden className="size-5" />
        </button>
      ) : (
        <Button variante="danger" onClick={() => setAbierto(true)}>
          <Trash2 aria-hidden className="size-5" />
          {etiqueta}
        </Button>
      )}
      <Sheet open={abierto} onClose={() => setAbierto(false)} title={titulo}>
        <p className="text-[15px] text-muted">{descripcion}</p>
        <form action={formAction} className="flex flex-col gap-2 pt-1">
          <FormError message={estado?.error} />
          <SubmitButton variante="danger" pendingText="Eliminando…">
            Sí, eliminar
          </SubmitButton>
          <Button variante="secondary" tamano="lg" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
        </form>
      </Sheet>
    </>
  );
}
