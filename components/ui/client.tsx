"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { buttonClass, cx } from "./base";

/** Botón de envío que se deshabilita mientras la server action corre. */
export function SubmitButton({
  children,
  pendingText = "Guardando…",
  variante = "primary",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variante?: "primary" | "secondary" | "danger" | "soft";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass(variante, "lg", cx("w-full", className))}>
      {pending ? pendingText : children}
    </button>
  );
}

/**
 * Hoja que sube desde abajo en el celular y se centra en la computadora.
 * Usa <dialog> nativo: foco atrapado, Esc para cerrar y fondo inerte gratis.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className={cx(
        "m-0 mt-auto w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-night/55",
        "sm:m-auto sm:max-w-md sm:rounded-3xl",
      )}
    >
      <div className="flex flex-col gap-3 px-5 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
          >
            <X aria-hidden className="size-6" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
