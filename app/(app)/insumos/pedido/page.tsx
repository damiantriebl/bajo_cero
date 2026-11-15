import { Suspense } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { ButtonLink, EmptyState, ListSkeleton, PageHeader, buttonClass } from "@/components/ui/base";
import { pedidoSugerido, type GrupoPedido } from "@/lib/data/insumos";
import { UNIDAD } from "@/lib/etiquetas";
import { formatNumero, formatPesos, linkWhatsApp } from "@/lib/formato";
import { cantidadUnidad } from "../_components/stock";

export default function PedidoPage() {
  return (
    <>
      <PageHeader title="Armar pedido" back={{ href: "/insumos", label: "Insumos" }} />
      <p className="max-w-2xl text-[15px] text-muted">
        Lo que está bajo el mínimo, separado por proveedor. La cantidad sugerida deja el stock en el doble del mínimo.
      </p>
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Pedido />
      </Suspense>
    </>
  );
}

async function Pedido() {
  const { grupos, empresa } = await pedidoSugerido();

  if (grupos.length === 0) {
    return (
      <EmptyState
        title="No hay nada para pedir"
        description="Todos los insumos están por encima del mínimo."
        action={
          <ButtonLink href="/insumos" variante="secondary">
            Volver a insumos
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
      {grupos.map((g) => (
        <GrupoProveedor key={g.proveedor?.id ?? "sin-proveedor"} grupo={g} empresa={empresa} />
      ))}
    </div>
  );
}

/** Texto del pedido para mandar por WhatsApp. */
function mensajePedido(grupo: GrupoPedido, empresa: string): string {
  const saludo = grupo.proveedor?.contacto ? `Hola ${grupo.proveedor.contacto}` : "Hola";
  const lineas = grupo.items.map((i) => {
    const u = UNIDAD[i.unidad];
    return `- ${i.nombre}: ${formatNumero(i.sugerida)} ${i.sugerida === 1 ? u.uno : u.varios}`;
  });
  return `${saludo}, te escribo de ${empresa}. Te quería pedir:\n${lineas.join("\n")}\n\n¡Gracias!`;
}

function GrupoProveedor({ grupo, empresa }: { grupo: GrupoPedido; empresa: string }) {
  const { proveedor, items, total } = grupo;
  const idTitulo = `pedido-${proveedor?.id ?? "sin-proveedor"}`;

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-col gap-0.5 px-4 pt-4 pb-3">
        <h2 id={idTitulo} className="text-lg font-bold">
          {proveedor ? (
            <Link href={`/proveedores/${proveedor.id}`} className="text-ink hover:text-brand">
              {proveedor.nombre}
            </Link>
          ) : (
            "Sin proveedor"
          )}
        </h2>
        <p className="text-[13px] text-muted">
          {items.length} {items.length === 1 ? "insumo" : "insumos"} · costo estimado{" "}
          <span className="tabular font-bold text-ink">{formatPesos(total)}</span>
        </p>
      </header>

      <ul className="flex flex-col border-t border-line-soft [&>*+*]:border-t [&>*+*]:border-line-soft">
        {items.map((i) => (
          <li key={i.id} className="flex min-h-15 items-center justify-between gap-3 px-4 py-2.5">
            <span className="flex min-w-0 flex-col">
              <Link href={`/insumos/${i.id}`} className="text-[15px] font-bold text-ink hover:text-brand">
                {i.nombre}
              </Link>
              <span className="text-[13px] text-muted">
                Hay {cantidadUnidad(i.stock, i.unidad)} · mínimo {cantidadUnidad(i.stockMinimo, i.unidad)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="tabular text-base font-bold whitespace-nowrap">Pedir {cantidadUnidad(i.sugerida, i.unidad)}</span>
              <span className="tabular text-[13px] whitespace-nowrap text-muted">≈ {formatPesos(i.costoEstimado)}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className="flex flex-col gap-2 border-t border-line-soft p-4">
        {proveedor ? (
          <>
            {proveedor.telefono ? (
              <a
                href={linkWhatsApp(proveedor.telefono, mensajePedido(grupo, empresa))}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("primary", "md", "w-full")}
              >
                <MessageCircle aria-hidden className="size-5" />
                Mandar pedido por WhatsApp
              </a>
            ) : (
              <p className="text-sm text-muted">
                Para mandarle el pedido por WhatsApp,{" "}
                <Link href={`/proveedores/${proveedor.id}/editar`} className="font-bold text-brand hover:underline">
                  cargá su teléfono
                </Link>
                .
              </p>
            )}
            <ButtonLink href={`/proveedores/${proveedor.id}/compra?pedido=1`} variante="secondary" className="w-full">
              Cargar la compra
            </ButtonLink>
          </>
        ) : (
          <p className="text-sm text-muted">
            Elegí el proveedor habitual de cada insumo (en Editar) para poder mandarle el pedido.
          </p>
        )}
      </footer>
    </section>
  );
}
