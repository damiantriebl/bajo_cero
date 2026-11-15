"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/base";

/** Abre el diálogo de impresión (ahí se elige "Guardar como PDF"). */
export function BotonImprimir() {
  return (
    <Button onClick={() => window.print()}>
      <Printer aria-hidden className="size-5" />
      Imprimir o guardar PDF
    </Button>
  );
}
