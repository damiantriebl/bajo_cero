"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/base";

export default function ErrorDeSeccion({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-xl font-bold">Algo salió mal</h1>
      <p className="text-muted">No pudimos mostrar esta pantalla. Probá de nuevo; si sigue fallando, volvé al inicio.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => retry()}>Reintentar</Button>
        <ButtonLink href="/" variante="secondary">
          Ir al inicio
        </ButtonLink>
      </div>
    </div>
  );
}
