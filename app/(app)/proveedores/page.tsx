import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, ButtonLink, EmptyState, Eyebrow, HeroCard, List, ListSkeleton, PageHeader, SectionTitle, Skeleton } from "@/components/ui/base";
import { resumenProveedores, type CompraFila, type ProveedorFila } from "@/lib/data/proveedores";
import { formatFechaCorta } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";

export default function ProveedoresPage() {
  return (
    <>
      <PageHeader
        title="Proveedores"
        actions={
          <ButtonLink href="/proveedores/nuevo" tamano="sm">
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
            Nuevo
          </ButtonLink>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[118px] rounded-[20px]" />
            <ListSkeleton rows={4} />
          </div>
        }
      >
        <ResumenProveedores />
      </Suspense>
    </>
  );
}

async function ResumenProveedores() {
  const r = await resumenProveedores();

  if (r.proveedores.length === 0) {
    return (
      <EmptyState
        title="Todavía no cargaste proveedores"
        description="Cargá a quién le comprás para llevar la cuenta de lo que les debés y armar los pedidos."
        action={<ButtonLink href="/proveedores/nuevo">Nuevo proveedor</ButtonLink>}
      />
    );
  }

  let detalle: string;
  if (r.proximo) detalle = `Próximo vencimiento: ${formatFechaCorta(r.proximo.fecha)} · ${r.proximo.proveedorNombre}`;
  else if (r.totalDeuda > 0)
    detalle = `${r.proveedoresConDeuda} ${r.proveedoresConDeuda === 1 ? "proveedor" : "proveedores"} con saldo, sin vencimiento cargado`;
  else detalle = "Estás al día con todos";

  return (
    <>
      <HeroCard className="gap-1">
        <Eyebrow tono="night">Les debés</Eyebrow>
        <p className="tabular text-[34px] leading-[1.1] font-bold lg:text-[40px]">{formatPesos(r.totalDeuda)}</p>
        <p className="text-sm text-night-text">{detalle}</p>
      </HeroCard>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <section aria-labelledby="titulo-cuentas" className="flex flex-col gap-2">
          <SectionTitle>
            <span id="titulo-cuentas">Cuentas</span>
          </SectionTitle>
          <List>
            {r.proveedores.map((p) => (
              <FilaProveedor key={p.id} p={p} />
            ))}
          </List>
        </section>

        <section aria-labelledby="titulo-compras" className="flex flex-col gap-2">
          <SectionTitle
            action={
              <Link href="/proveedores/compra" className="inline-flex h-11 items-center px-1 text-sm font-bold text-brand hover:underline">
                Cargar compra
              </Link>
            }
          >
            <span id="titulo-compras">Últimas compras</span>
          </SectionTitle>
          {r.ultimasCompras.length > 0 ? (
            <List>
              {r.ultimasCompras.map((c) => (
                <FilaCompra key={c.id} c={c} />
              ))}
            </List>
          ) : (
            <EmptyState
              title="Todavía no cargaste compras"
              description="Cada compra suma stock a los insumos y queda como gasto de materiales."
            />
          )}
        </section>
      </div>
    </>
  );
}

function FilaProveedor({ p }: { p: ProveedorFila }) {
  const partes: ReactNode[] = [];
  if (p.rubro) partes.push(p.rubro);
  if (p.vencida)
    partes.push(
      <span key="vencida" className="font-bold text-danger">
        tiene facturas vencidas
      </span>,
    );
  else if (p.proximoVencimiento) partes.push(`vence ${formatFechaCorta(p.proximoVencimiento)}`);

  return (
    <Link
      href={`/proveedores/${p.id}`}
      className="flex min-h-[70px] items-center justify-between gap-2.5 px-3.5 py-2.5 text-ink transition-colors hover:bg-surface-2"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-bold">{p.nombre}</span>
        {partes.length > 0 && (
          <span className="text-[13px] text-muted">
            {partes.map((x, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {x}
              </span>
            ))}
          </span>
        )}
      </span>
      {p.saldo > 0 ? (
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-xs font-bold text-warn">Debés</span>
          <span className="tabular text-base font-bold">{formatPesos(p.saldo)}</span>
        </span>
      ) : p.saldo < 0 ? (
        <Badge tono="info" className="shrink-0">
          A favor {formatPesos(-p.saldo)}
        </Badge>
      ) : (
        <Badge tono="ok" className="shrink-0">
          Al día
        </Badge>
      )}
    </Link>
  );
}

function estadoCompra(c: CompraFila): ReactNode {
  if (c.pendiente <= 0) return <span className="font-bold text-ok">pagada</span>;
  if (c.pendiente < c.total) return `falta pagar ${formatPesos(c.pendiente)}`;
  return "todavía sin pagar";
}

function FilaCompra({ c }: { c: CompraFila }) {
  return (
    <Link
      href={`/proveedores/${c.proveedorId}#compra-${c.id}`}
      className="flex min-h-[62px] items-center justify-between gap-2.5 px-3.5 py-2.5 text-ink transition-colors hover:bg-surface-2"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-bold">
          {formatFechaCorta(c.fecha)} · {c.proveedorNombre}
        </span>
        <span className="text-[13px] text-muted">
          {c.cantidadItems} {c.cantidadItems === 1 ? "ítem" : "ítems"} · {estadoCompra(c)}
        </span>
      </span>
      <span className="tabular shrink-0 text-base font-bold whitespace-nowrap">{formatPesos(c.total)}</span>
    </Link>
  );
}
