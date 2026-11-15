"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/components/ui/base";

type Destino = { href: string; label: string };

const botonIcono =
  "flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Mes anterior / selector de los últimos 12 meses / mes siguiente. */
export function SelectorMes({
  actual,
  anterior,
  siguiente,
  opciones,
}: {
  actual: string;
  anterior: Destino;
  siguiente: Destino | null;
  opciones: (Destino & { clave: string })[];
}) {
  const router = useRouter();
  const id = useId();
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5" aria-busy={pendiente || undefined}>
      <Link href={anterior.href} scroll={false} aria-label={`Mes anterior: ${anterior.label}`} className={botonIcono}>
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
      <label htmlFor={id} className="sr-only">
        Mes
      </label>
      <select
        id={id}
        key={actual}
        defaultValue={actual}
        onChange={(e) => {
          const destino = opciones.find((o) => o.clave === e.target.value);
          if (destino) startTransition(() => router.push(destino.href, { scroll: false }));
        }}
        className={cx(
          "h-11 rounded-xl border border-line bg-surface pr-2 pl-3 text-[15px] font-bold text-ink",
          "focus:border-brand focus:outline-2 focus:outline-brand/25",
          pendiente && "opacity-60",
        )}
      >
        {opciones.map((o) => (
          <option key={o.clave} value={o.clave}>
            {o.label}
          </option>
        ))}
      </select>
      {siguiente ? (
        <Link href={siguiente.href} scroll={false} aria-label={`Mes siguiente: ${siguiente.label}`} className={botonIcono}>
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      ) : (
        <span aria-hidden className={cx(botonIcono, "pointer-events-none opacity-40")}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </div>
  );
}
