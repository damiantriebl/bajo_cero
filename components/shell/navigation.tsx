"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Settings } from "lucide-react";
import { cx } from "@/components/ui/base";
import { BARRA_INFERIOR, RUTAS_DE_MAS, SECCIONES, estaActivo, type ItemNav } from "./nav";
import { QuickAdd } from "./quick-add";

// La ruta actual (usePathname) en páginas con [id] solo existe al pedir la página.
// Por eso el menú se prerenderiza sin resaltar y la sección activa llega en streaming.

/** Menú lateral (computadora, desde 1024 px). */
export function Sidebar() {
  return (
    <Suspense fallback={<SidebarVista pathname={null} />}>
      <SidebarConRuta />
    </Suspense>
  );
}

function SidebarConRuta() {
  return <SidebarVista pathname={usePathname()} />;
}

function SidebarVista({ pathname }: { pathname: string | null }) {
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-5 lg:flex">
      <Link href="/" aria-label="Bajo Cero, ir al inicio" className="px-1">
        <Image src="/logo.webp" alt="Bajo Cero" width={2148} height={732} priority className="h-14 w-auto" />
      </Link>
      <QuickAdd variante="sidebar" />
      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {SECCIONES.map(({ href, label, icon: Icon }) => {
          const activo = pathname !== null && estaActivo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] transition-colors",
                activo ? "bg-brand-soft font-bold text-brand-strong" : "font-semibold text-ink hover:bg-surface-2",
              )}
            >
              <Icon aria-hidden className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/ajustes"
        aria-current={pathname !== null && estaActivo(pathname, "/ajustes") ? "page" : undefined}
        className="mt-auto flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold text-muted hover:bg-surface-2"
      >
        <Settings aria-hidden className="size-5" />
        Ajustes
      </Link>
    </aside>
  );
}

function ItemBarra({ item, activo }: { item: ItemNav; activo: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      className={cx(
        "flex h-15 flex-col items-center justify-center gap-0.5 text-xs",
        activo ? "font-bold text-brand" : "font-semibold text-muted",
      )}
    >
      <Icon aria-hidden className="size-6" />
      {item.label}
    </Link>
  );
}

/** Barra inferior (celular y tablet). */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavVista pathname={null} />}>
      <BottomNavConRuta />
    </Suspense>
  );
}

function BottomNavConRuta() {
  return <BottomNavVista pathname={usePathname()} />;
}

function BottomNavVista({ pathname }: { pathname: string | null }) {
  const activo = (href: string) => pathname !== null && estaActivo(pathname, href);
  const enMas = RUTAS_DE_MAS.some(activo);
  return (
    <nav aria-label="Secciones" className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface lg:hidden">
      <div className="mx-auto grid h-19 max-w-xl grid-cols-5 items-center px-1.5">
        {BARRA_INFERIOR.izquierda.map((item) => (
          <ItemBarra key={item.href} item={item} activo={activo(item.href)} />
        ))}
        <QuickAdd variante="fab" />
        {BARRA_INFERIOR.derecha.map((item) => (
          <ItemBarra key={item.href} item={item} activo={item.href === "/mas" ? enMas : activo(item.href)} />
        ))}
      </div>
    </nav>
  );
}
