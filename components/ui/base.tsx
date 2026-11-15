// Componentes visuales compartidos (sin estado: sirven en Server y Client Components).
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Tono } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ───────── Botones ─────────

type Variante = "primary" | "secondary" | "soft" | "ghost" | "danger" | "ice";
type Tamano = "md" | "lg" | "sm";

export function buttonClass(variante: Variante = "primary", tamano: Tamano = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:pointer-events-none",
    tamano === "lg" && "h-13 px-5 text-base",
    tamano === "md" && "h-12 px-4 text-[15px]",
    tamano === "sm" && "h-11 px-3.5 text-sm",
    variante === "primary" && "bg-brand text-white hover:bg-brand-hover",
    variante === "secondary" && "border-[1.5px] border-ink bg-surface text-ink hover:bg-surface-2",
    variante === "soft" && "bg-brand-soft text-brand-strong hover:bg-[#d2e8fb]",
    variante === "ghost" && "text-brand hover:bg-brand-soft",
    variante === "danger" && "border-[1.5px] border-danger bg-surface text-danger hover:bg-danger-soft",
    variante === "ice" && "bg-ice text-ink hover:bg-[#3aa5ef]",
    extra,
  );
}

export function ButtonLink({
  variante,
  tamano,
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamano?: Tamano }) {
  return <Link className={buttonClass(variante, tamano, className)} {...props} />;
}

export function Button({
  variante,
  tamano,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamano?: Tamano }) {
  return <button type={type} className={buttonClass(variante, tamano, className)} {...props} />;
}

// ───────── Superficies ─────────

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-surface", className)} {...props} />;
}

/** Bloque azul noche para el dato principal de una pantalla. */
export function HeroCard({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("flex flex-col gap-3 rounded-[20px] bg-night p-[18px] text-white", className)} {...props} />;
}

/** Etiqueta chica en mayúsculas (sobre fondo noche usar tono="night"). */
export function Eyebrow({ children, tono, className }: { children: ReactNode; tono?: "night"; className?: string }) {
  return (
    <span
      className={cx(
        "text-[13px] font-bold tracking-[0.06em] uppercase",
        tono === "night" ? "text-ice-light" : "text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h2 className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

// ───────── Encabezado de pantalla ─────────

export function PageHeader({
  title,
  eyebrow,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  /** Link de "volver" (muestra flecha arriba del título). */
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cx("flex flex-col gap-1", className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-2 mb-1 inline-flex h-11 w-fit items-center gap-1 rounded-xl pr-3 pl-1 text-[15px] font-bold text-ink hover:bg-surface"
        >
          <ChevronLeft aria-hidden className="size-6" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="font-display text-[34px] leading-none font-bold tracking-[0.01em] uppercase italic lg:text-[42px]">
            {title}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ───────── Badges y números ─────────

const TONOS: Record<Tono, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  info: "bg-brand-soft text-brand-strong",
  neutral: "bg-line-soft text-muted-strong",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tono = "neutral", children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap", TONOS[tono], className)}>
      {children}
    </span>
  );
}

/** Monto en pesos con números tabulares. */
export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cx("tabular whitespace-nowrap", className)}>{formatPesos(value)}</span>;
}

export function ProgressBar({
  value,
  tono = "light",
  className,
  label,
}: {
  /** 0 a 1 */
  value: number;
  tono?: "light" | "night";
  className?: string;
  /** Si se pasa, la barra se anuncia a lectores de pantalla. */
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      {...(label
        ? { role: "progressbar", "aria-label": label, "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 }
        : { "aria-hidden": true })}
      className={cx("flex h-1.5 overflow-hidden rounded-full", tono === "night" ? "bg-night-track" : "bg-line-soft", className)}
    >
      <span className="bg-ice" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Dato suelto: etiqueta + número grande. */
export function Stat({
  label,
  value,
  hint,
  tono,
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tono?: "night" | "warn" | "ok";
  href?: string;
  className?: string;
}) {
  const night = tono === "night";
  const contenido = (
    <>
      <span className={cx("text-[13px] font-semibold", night ? "text-ice-light" : "text-muted")}>{label}</span>
      <span className={cx("tabular text-[21px] leading-tight font-bold lg:text-[26px]", tono === "warn" && "text-warn")}>
        {value}
      </span>
      {hint && (
        <span
          className={cx(
            "text-[13px]",
            night ? "text-night-text" : "text-muted",
            tono === "ok" && "font-bold text-ok",
            tono === "warn" && "font-bold text-warn",
          )}
        >
          {hint}
        </span>
      )}
    </>
  );
  const clase = cx(
    "flex flex-col gap-0.5 rounded-2xl px-3.5 py-3 lg:px-[18px] lg:py-4",
    night ? "bg-night text-white" : "border border-line bg-surface text-ink",
    href && "transition-colors hover:border-brand",
    className,
  );
  return href ? (
    <Link href={href} className={clase}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

// ───────── Listas ─────────

/** Contenedor de filas con divisores. */
export function List({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "flex flex-col overflow-hidden rounded-2xl border border-line bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft",
        className,
      )}
      {...props}
    />
  );
}

type FilaProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

function FilaContenido({ title, subtitle, leading, trailing }: FilaProps) {
  return (
    <>
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold lg:text-base">{title}</span>
        {subtitle && <span className="text-[13px] text-muted">{subtitle}</span>}
      </span>
      {trailing}
    </>
  );
}

export function ListRow(props: FilaProps) {
  return (
    <div className={cx("flex min-h-15 items-center gap-3 px-3.5 py-2.5", props.className)}>
      <FilaContenido {...props} />
    </div>
  );
}

export function ListLinkRow({ href, chevron = true, ...props }: FilaProps & { href: string; chevron?: boolean }) {
  return (
    <Link
      href={href}
      className={cx("flex min-h-15 items-center gap-3 px-3.5 py-2.5 text-ink transition-colors hover:bg-surface-2", props.className)}
    >
      <FilaContenido {...props} />
      {chevron && <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />}
    </Link>
  );
}

/** Cuadrado con ícono para el inicio de una fila. */
export function IconTile({ children, tono = "info" }: { children: ReactNode; tono?: Tono }) {
  return (
    <span aria-hidden className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl", TONOS[tono])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-track bg-surface/60 px-6 py-10 text-center">
      <p className="text-base font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ───────── Formularios ─────────

export const inputClass = cx(
  "h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted/80",
  "focus:border-brand focus:outline-2 focus:outline-brand/25 aria-invalid:border-danger",
);

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-muted">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "appearance-auto pr-2", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "h-auto min-h-24 py-3", className)} {...props} />;
}

/** Mensaje de error general de un formulario. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger">
      {message}
    </p>
  );
}

// ───────── Cargando ─────────

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-2xl bg-line-soft", className)} />;
}

/** Relleno genérico para <Suspense fallback>. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
