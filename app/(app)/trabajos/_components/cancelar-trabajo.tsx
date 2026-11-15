"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/base";
import { Sheet, SubmitButton } from "@/components/ui/client";
import { cambiarEstado } from "../actions";

/** "Cancelar trabajo" con confirmación en una hoja. */
export function CancelarTrabajo({ trabajoId, numero }: { trabajoId: string; numero: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button variante="danger" tamano="sm" onClick={() => setAbierto(true)} className="w-full sm:w-fit">
        <Ban aria-hidden className="size-5" />
        Cancelar trabajo
      </Button>

      <Sheet open={abierto} onClose={() => setAbierto(false)} title={`¿Cancelar el trabajo ${numero}?`}>
        <p className="text-[15px] text-muted-strong">
          Sale de la lista de activos y no se puede seguir avanzando. Los cobros, visitas y materiales cargados no se
          borran.
        </p>
        <form action={cambiarEstado.bind(null, trabajoId, "CANCELADO")} className="flex flex-col gap-2.5 pt-1">
          <SubmitButton variante="danger" pendingText="Cancelando…">
            Sí, cancelar trabajo
          </SubmitButton>
          <Button variante="secondary" tamano="lg" onClick={() => setAbierto(false)} className="w-full">
            No, volver
          </Button>
        </form>
      </Sheet>
    </>
  );
}
