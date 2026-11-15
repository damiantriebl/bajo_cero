import {
  Banknote,
  BarChart3,
  CalendarDays,
  ClipboardList,
  House,
  LayoutGrid,
  Package,
  Truck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = { href: string; label: string; icon: LucideIcon };

/** Secciones de la app (menú lateral en computadora). */
export const SECCIONES: ItemNav[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cobros", label: "Cobros", icon: Banknote },
  { href: "/trabajos", label: "Trabajos", icon: ClipboardList },
  { href: "/insumos", label: "Insumos", icon: Package },
  { href: "/proveedores", label: "Proveedores", icon: Truck },
  { href: "/gastos", label: "Gastos", icon: Wallet },
  { href: "/personal", label: "Personal", icon: UserRound },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
];

/** Barra inferior en el celular (el botón "+" va en el medio). */
export const BARRA_INFERIOR: { izquierda: ItemNav[]; derecha: ItemNav[] } = {
  izquierda: [
    { href: "/", label: "Inicio", icon: House },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
  ],
  derecha: [
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/mas", label: "Más", icon: LayoutGrid },
  ],
};

/** Rutas que, en el celular, se consideran dentro de "Más". */
export const RUTAS_DE_MAS = ["/mas", "/cobros", "/trabajos", "/insumos", "/proveedores", "/gastos", "/personal", "/reportes", "/ajustes"];

export function estaActivo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
