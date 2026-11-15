import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, ChevronDown, Mail, MessageCircle, PackagePlus, Pencil, Phone } from "lucide-react";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Eyebrow,
  HeroCard,
  IconTile,
  List,
  ListLinkRow,
  ListRow,
  PageHeader,
  SectionTitle,
  buttonClass,
} from "@/components/ui/base";
import { obtenerProveedor, type CompraDetalle, type ProveedorDetalle } from "@/lib/data/proveedores";
import { MEDIO_PAGO } from "@/lib/etiquetas";
import { aInputFecha, diasHasta, formatDiaRelativo, formatFechaCorta, formatFechaCompleta } from "@/lib/fechas";
import { formatNumero, formatPesos, linkWhatsApp } from "@/lib/formato";
import { FichaSkeleton } from "@/app/(app)/insumos/_components/esqueletos";
import { ESTADO_STOCK, cantidadUnidad } from "@/app/(app)/insumos/_components/stock";
import { registrarPago } from "../actions";
import { RegistrarPago } from "../_components/registrar-pago";

export default function ProveedorPage(props: PageProps<"/proveedores/[id]">) {
  return (
    <Suspense fallback={<FichaSkeleton />}>
      <FichaProveedor params={props.params} />
    </Suspense>
  );
}

async function FichaProveedor({ params }: Pick<PageProps<"/proveedores/[id]">, "params">) {
  const { id } = await params;
  const p = await obtenerProveedor(id);
  if (!p) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/proveedores", label: "Proveedores" }}
        eyebrow={p.rubro ?? undefined}
        title={p.nombre}
        actions={
          <ButtonLink href={`/proveedores/${p.id}/editar`} variante="secondary" tamano="sm">
            <Pencil aria-hidden className="size-[18px]" />
            Editar
          </ButtonLink>
        }
      />

      {(p.telefono || p.email) && (
        <div className="flex flex-wrap gap-2">
          {p.telefono && (
            <a href={`tel:${p.telefono.replace(/[^\d+]/g, "")}`} className={buttonClass("secondary", "sm")}>
              <Phone aria-hidden className="size-[18px]" />
              Llamar
            </a>
          )}
          {p.telefono && (
            <a href={linkWhatsApp(p.telefono)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
              <MessageCircle aria-hidden className="size-[18px]" />
              WhatsApp
            </a>
          )}
          {p.email && (
            <a href={`mailto:${p.email}`} className={buttonClass("secondary", "sm")}>
              <Mail aria-hidden className="size-[18px]" />
              Email
            </a>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        {/* Cuenta */}
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <CuentaHero p={p} />
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/proveedores/${p.id}/compra`} className="flex-1 sm:flex-none">
              <PackagePlus aria-hidden className="size-5" />
              Cargar compra
            </ButtonLink>
            <RegistrarPago
              accion={registrarPago.bind(null, p.id)}
              saldo={p.saldo}
              hoy={aInputFecha(p.hoy)}
              className="flex-1 sm:flex-none"
            />
          </div>
        </div>

        {/* Compras y pagos */}
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-2 lg:gap-6">
          <Compras p={p} />
          <Pagos p={p} />
        </div>

        {/* Datos e insumos */}
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Datos p={p} />
          <InsumosQueProvee p={p} />
        </div>
      </div>
    </>
  );
}

function CuentaHero({ p }: { p: ProveedorDetalle }) {
  let detalle: string;
  if (p.saldo <= 0) detalle = p.saldo < 0 ? "Pagaste de más: se descuenta de la próxima compra" : "Estás al día";
  else if (p.vencida) detalle = "Tenés facturas vencidas";
  else if (p.proximoVencimiento) detalle = `Próximo vencimiento: ${formatDiaRelativo(p.proximoVencimiento, p.hoy)}`;
  else detalle = "Sin vencimiento cargado";

  return (
    <HeroCard className="gap-1">
      <Eyebrow tono="night">{p.saldo < 0 ? "A tu favor" : "Les debés"}</Eyebrow>
      <p className="tabular text-[34px] leading-[1.1] font-bold lg:text-[40px]">{formatPesos(Math.abs(p.saldo))}</p>
      <p className={p.vencida ? "text-sm font-bold text-warn-soft" : "text-sm text-night-text"}>{detalle}</p>
      <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-night-track pt-3">
        <div className="flex flex-col">
          <dt className="text-[13px] text-ice-light">Compraste</dt>
          <dd className="tabular text-base font-bold">{formatPesos(p.totalComprado)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-ice-light">Pagaste</dt>
          <dd className="tabular text-base font-bold">{formatPesos(p.totalPagado)}</dd>
        </div>
      </dl>
    </HeroCard>
  );
}

function estadoPago(c: CompraDetalle, hoy: Date): ReactNode {
  if (c.pendiente <= 0) return <span className="font-bold text-ok">Pagada</span>;
  const falta = c.pendiente < c.total ? `Falta ${formatPesos(c.pendiente)}` : "Sin pagar";
  if (!c.vencimiento) return falta;
  return diasHasta(c.vencimiento, hoy) < 0 ? (
    <span className="font-bold text-danger">
      {falta} · venció el {formatFechaCorta(c.vencimiento)}
    </span>
  ) : (
    `${falta} · vence ${formatDiaRelativo(c.vencimiento, hoy).toLowerCase()}`
  );
}

function Compras({ p }: { p: ProveedorDetalle }) {
  return (
    <section aria-labelledby="titulo-compras" className="flex flex-col gap-2">
      <SectionTitle>
        <span id="titulo-compras">Compras</span>
      </SectionTitle>
      {p.compras.length === 0 ? (
        <EmptyState title="Todavía no le compraste" description="Cuando cargues una compra, el stock y lo que le debés se actualizan solos." />
      ) : (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface [&>*+*]:border-t [&>*+*]:border-line-soft">
          {p.compras.map((c) => (
            <details key={c.id} id={`compra-${c.id}`} className="group scroll-mt-6">
              <summary className="flex min-h-15 cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-bold">
                    {formatFechaCorta(c.fecha)}
                    {c.numeroFactura && <span className="font-semibold text-muted"> · Factura {c.numeroFactura}</span>}
                  </span>
                  <span className="text-[13px] text-muted">
                    {c.items.length} {c.items.length === 1 ? "ítem" : "ítems"} · {estadoPago(c, p.hoy)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-base font-bold whitespace-nowrap">{formatPesos(c.total)}</span>
                <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                <ul className="flex flex-col rounded-xl bg-surface-2 px-3 [&>*+*]:border-t [&>*+*]:border-line-soft">
                  {c.items.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex min-w-0 flex-col">
                        {i.insumoId ? (
                          <Link href={`/insumos/${i.insumoId}`} className="text-sm font-bold text-brand hover:underline">
                            {i.descripcion}
                          </Link>
                        ) : (
                          <span className="text-sm font-bold">{i.descripcion}</span>
                        )}
                        <span className="tabular text-[13px] text-muted">
                          {i.unidad ? cantidadUnidad(i.cantidad, i.unidad) : formatNumero(i.cantidad)} × {formatPesos(i.precioUnitario)}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-bold">{formatPesos(Math.round(i.cantidad * i.precioUnitario))}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[13px] text-muted">
                  Comprada el {formatFechaCompleta(c.fecha)}
                  {c.vencimiento && ` · vence el ${formatFechaCompleta(c.vencimiento)}`}
                </p>
                {c.notas && <p className="text-sm">{c.notas}</p>}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function Pagos({ p }: { p: ProveedorDetalle }) {
  return (
    <section aria-labelledby="titulo-pagos" className="flex flex-col gap-2">
      <SectionTitle>
        <span id="titulo-pagos">Pagos</span>
      </SectionTitle>
      {p.pagos.length === 0 ? (
        <EmptyState title="Sin pagos registrados" description="Los pagos que le hagas descuentan de lo que le debés." />
      ) : (
        <List>
          {p.pagos.map((x) => (
            <ListRow
              key={x.id}
              leading={
                <IconTile tono="ok">
                  <Banknote className="size-5" />
                </IconTile>
              }
              title={formatFechaCorta(x.fecha)}
              subtitle={[MEDIO_PAGO[x.medio], x.notas].filter(Boolean).join(" · ")}
              trailing={<span className="tabular shrink-0 text-base font-bold whitespace-nowrap">{formatPesos(x.monto)}</span>}
            />
          ))}
        </List>
      )}
    </section>
  );
}

function Datos({ p }: { p: ProveedorDetalle }) {
  const filas: [string, ReactNode][] = [];
  if (p.contacto) filas.push(["Contacto", p.contacto]);
  if (p.telefono) filas.push(["Teléfono", p.telefono]);
  if (p.email) filas.push(["Email", p.email]);
  if (p.cuit) filas.push(["CUIT", p.cuit]);
  if (p.direccion) filas.push(["Dirección", p.direccion]);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-lg font-bold">Datos</h2>
      {filas.length > 0 ? (
        <dl className="flex flex-col gap-2.5">
          {filas.map(([dt, dd]) => (
            <div key={dt} className="flex flex-col">
              <dt className="text-[13px] text-muted">{dt}</dt>
              <dd className="text-[15px] font-semibold break-words">{dd}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">
          Sin datos de contacto.{" "}
          <Link href={`/proveedores/${p.id}/editar`} className="font-bold text-brand hover:underline">
            Cargalos
          </Link>{" "}
          para llamarlo o mandarle pedidos.
        </p>
      )}
      {p.notas && <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm whitespace-pre-line">{p.notas}</p>}
    </Card>
  );
}

function InsumosQueProvee({ p }: { p: ProveedorDetalle }) {
  return (
    <section aria-labelledby="titulo-insumos" className="flex flex-col gap-2">
      <SectionTitle>
        <span id="titulo-insumos">Insumos que provee</span>
      </SectionTitle>
      {p.insumos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-track px-4 py-5 text-sm text-muted">
          Ningún insumo lo tiene como proveedor habitual. Elegilo al editar un insumo.
        </p>
      ) : (
        <List>
          {p.insumos.map((i) => (
            <ListLinkRow
              key={i.id}
              href={`/insumos/${i.id}`}
              chevron={false}
              title={i.nombre}
              subtitle={`Hay ${cantidadUnidad(i.stock, i.unidad)}`}
              trailing={
                <Badge tono={ESTADO_STOCK[i.estado].tono} className="shrink-0">
                  {ESTADO_STOCK[i.estado].label}
                </Badge>
              }
            />
          ))}
        </List>
      )}
    </section>
  );
}
