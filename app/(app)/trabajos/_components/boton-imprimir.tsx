"use client";

import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/base";

/** Abre el diálogo de impresión: ahí se elige "Guardar como PDF". */
export function BotonImprimir({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "md", className)}>
      <Download aria-hidden className="size-5" />
      Descargar PDF
    </button>
  );
}
