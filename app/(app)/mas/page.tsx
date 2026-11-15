import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Banknote,
  ChartColumn,
  ClipboardList,
  Package,
  Settings,
  Truck,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge, Card, IconTile, List, ListLinkRow, PageHeader } from "@/components/ui/base";
import { InstallAppButton } from "@/components/shell/pwa";
import { resumenMenu, type ResumenMenu } from "@/lib/data/reportes";
import type { Tono } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";

export const metadata: Metadata = { title: "Más" };

export default function MasPage() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 lg:gap-6">
      <PageHeader title="Más" />
      {/* Mientras cargan los números, el menú ya se puede usar (con textos fijos). */}
      <Suspense fallback={<Menu />}>
        <MenuConDatos />
      </Suspense>
      <Card className="flex flex-wrap items-center gap-3 py-2 pr-2 pl-3.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold">Instalar en este teléfono</span>
          <span className="text-[13px] text-muted">Queda como una app más, con su ícono</span>
        </span>
        <span className="flex min-h-11 items-center">
          <InstallAppButton />
        </span>
      </Card>
    </div>
  );
}

async function MenuConDatos() {
  return <Menu r={await resumenMenu()} />;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type Item = {
  href: string;
  titulo: string;
  icono: LucideIcon;
  subtitulo: string;
  badge?: { texto: string; tono: Tono };
  tono?: Tono;
};

function items(r?: ResumenMenu): Item[] {
  const trabajos = r
    ? [
        plural(r.trabajosEnCurso, "en curso", "en curso"),
        r.presupuestosPorVencer > 0 &&
          plural(r.presupuestosPorVencer, "presupuesto por vencer", "presupuestos por vencer"),
      ]
        .filter(Boolean)
        .join(" · ")
    : "Presupuestos y trabajos en curso";

  return [
    { href: "/trabajos", titulo: "Trabajos y presupuestos", icono: ClipboardList, subtitulo: trabajos },
    {
      href: "/insumos",
      titulo: "Insumos",
      icono: Package,
      subtitulo: "Stock de caños, cables, gas y fijaciones",
      badge: r && r.insumosBajos > 0 ? { texto: plural(r.insumosBajos, "bajo", "bajos"), tono: "warn" } : undefined,
    },
    {
      href: "/proveedores",
      titulo: "Proveedores",
      icono: Truck,
      subtitulo: r
        ? r.deudaProveedores > 0
          ? `Les debés ${formatPesos(r.deudaProveedores)}`
          : "No les debés nada"
        : "Compras y pagos",
    },
    {
      href: "/gastos",
      titulo: "Gastos",
      icono: Wallet,
      subtitulo: r ? `${formatPesos(r.gastosMes)} en ${r.mes.nombre}` : "Lo que se gasta en el mes",
    },
    {
      href: "/personal",
      titulo: "Personal",
      icono: UserRound,
      subtitulo:
        r && r.empleadosActivos.length > 0
          ? `${new Intl.ListFormat("es", { type: "conjunction" }).format(r.empleadosActivos)} · jornadas y pagos`
          : "Jornadas, pagos y adelantos",
    },
    { href: "/reportes", titulo: "Reportes", icono: ChartColumn, subtitulo: "Cierre mensual y estadísticas" },
    {
      href: "/cobros",
      titulo: "Cobros",
      icono: Banknote,
      subtitulo: r ? `${formatPesos(r.cobradoMes)} cobrado en ${r.mes.nombre}` : "Señas, pagos y saldos",
    },
    {
      href: "/ajustes",
      titulo: "Ajustes",
      icono: Settings,
      subtitulo: "Datos de la empresa y del presupuesto",
      tono: "neutral",
    },
  ];
}

function Menu({ r }: { r?: ResumenMenu }) {
  return (
    <nav aria-label="Más secciones">
      <List>
        {items(r).map(({ href, titulo, icono: Icono, subtitulo, badge, tono }) => (
          <ListLinkRow
            key={href}
            href={href}
            className="min-h-16"
            leading={
              <IconTile tono={tono ?? "info"}>
                <Icono className="size-[22px]" />
              </IconTile>
            }
            title={titulo}
            subtitle={subtitulo}
            trailing={badge && <Badge tono={badge.tono}>{badge.texto}</Badge>}
          />
        ))}
      </List>
    </nav>
  );
}
