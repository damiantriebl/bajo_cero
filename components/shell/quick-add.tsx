"use client";

import Link from "next/link";
import { useState } from "react";
import { Banknote, CalendarPlus, FilePlus2, Plus, Receipt } from "lucide-react";
import { Sheet } from "@/components/ui/client";
import { IconTile, cx } from "@/components/ui/base";

const ACCIONES = [
  { href: "/agenda/nuevo", title: "Nuevo turno", subtitle: "Agendar una visita a un cliente", icon: CalendarPlus, tono: "info" as const },
  { href: "/cobros/nuevo", title: "Registrar cobro", subtitle: "Seña, pago parcial o saldo", icon: Banknote, tono: "ok" as const },
  { href: "/gastos/nuevo", title: "Cargar gasto", subtitle: "Materiales, combustible, jornales", icon: Receipt, tono: "warn" as const },
  { href: "/trabajos/nuevo", title: "Nuevo presupuesto", subtitle: "Armarlo y mandarlo por WhatsApp", icon: FilePlus2, tono: "info" as const },
];

/** Botón "+" con las cargas rápidas. `variante="fab"` en la barra inferior, `"sidebar"` en el menú lateral. */
export function QuickAdd({ variante }: { variante: "fab" | "sidebar" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variante === "fab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Cargar turno, cobro, gasto o presupuesto"
          className="flex size-14 items-center justify-center justify-self-center rounded-full bg-brand text-white shadow-[0_6px_14px_rgba(11,111,204,0.3)] transition-colors hover:bg-brand-hover"
        >
          <Plus aria-hidden className="size-7" strokeWidth={2.4} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[15px] font-bold text-white transition-colors hover:bg-brand-hover"
        >
          <Plus aria-hidden className="size-5" strokeWidth={2.4} />
          Cargar
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="¿Qué querés cargar?">
        <nav aria-label="Cargas rápidas" className="flex flex-col gap-2.5">
          {ACCIONES.map(({ href, title, subtitle, icon: Icon, tono }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cx(
                "flex min-h-15 items-center gap-3 rounded-2xl border border-line px-3 py-2 text-ink transition-colors hover:border-brand",
              )}
            >
              <IconTile tono={tono}>
                <Icon className="size-[22px]" />
              </IconTile>
              <span className="flex flex-col">
                <span className="text-base font-bold">{title}</span>
                <span className="text-[13px] text-muted">{subtitle}</span>
              </span>
            </Link>
          ))}
        </nav>
      </Sheet>
    </>
  );
}
