import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserPlus } from "lucide-react";
import {
  Badge,
  ButtonLink,
  EmptyState,
  Eyebrow,
  HeroCard,
  List,
  ListLinkRow,
  ListSkeleton,
  Money,
  PageHeader,
  SectionTitle,
  Skeleton,
} from "@/components/ui/base";
import { personalDelMes, type ResumenEmpleado } from "@/lib/data/personal";
import { formatPesos } from "@/lib/formato";
import { MesNavDesdeUrl, MesNavSkeleton } from "../reportes/_components/mes-nav";
import { conParams, primero } from "../reportes/_components/mes";
import { plural, textoSaldo } from "./_components/saldo";

export const metadata: Metadata = { title: "Personal" };

export default function PersonalPage({ searchParams }: PageProps<"/personal">) {
  return (
    <>
      <PageHeader
        title="Personal"
        actions={
          <Suspense fallback={<MesNavSkeleton />}>
            <MesNavDesdeUrl base="/personal" searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando personal">
            <Skeleton className="h-32 bg-night/15" />
            <ListSkeleton rows={3} />
          </div>
        }
      >
        <ListaPersonal searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ListaPersonal({ searchParams }: Pick<PageProps<"/personal">, "searchParams">) {
  const sp = await searchParams;
  const d = await personalDelMes(primero(sp.mes));
  const { mes, totales } = d;
  const href = (id: string) => conParams(`/personal/${id}`, { mes: mes.clave });

  if (d.empleados.length === 0 && d.inactivos.length === 0) {
    return (
      <EmptyState
        title="Todavía no cargaste a nadie"
        description="Agregá a tu equipo para anotar los días que trabaja y lo que le pagás."
        action={<ButtonLink href="/personal/nuevo">Agregar persona</ButtonLink>}
      />
    );
  }

  return (
    <>
      <HeroCard className="lg:flex-row lg:items-end lg:justify-between lg:p-6">
        <div className="flex flex-col gap-0.5">
          <Eyebrow tono="night">Saldo de {mes.nombre}</Eyebrow>
          <span className="tabular text-[30px] leading-tight font-bold lg:text-[36px]">
            {totales.saldo > 0
              ? `Le debés ${formatPesos(totales.saldo)}`
              : totales.saldo < 0
                ? `Adelantado ${formatPesos(-totales.saldo)}`
                : "Están al día"}
          </span>
          <p className="text-sm text-night-text lg:text-[15px]">
            {plural(totales.jornadas, "jornada", "jornadas")} · trabajado {formatPesos(totales.devengado)} · pagado{" "}
            {formatPesos(totales.pagado)}
          </p>
        </div>
        <ButtonLink href="/personal/nuevo" variante="ice" className="self-start lg:self-auto">
          <UserPlus aria-hidden className="size-5" />
          Agregar persona
        </ButtonLink>
      </HeroCard>

      {d.empleados.length > 0 && (
        <section className="flex flex-col gap-1" aria-labelledby="equipo">
          <SectionTitle>
            <span id="equipo">Equipo en {mes.nombre}</span>
          </SectionTitle>
          <List className="lg:hidden">
            {d.empleados.map((e) => (
              <FilaEmpleado key={e.id} e={e} href={href(e.id)} />
            ))}
          </List>
          <TablaEmpleados empleados={d.empleados} href={href} mesNombre={mes.nombre} />
        </section>
      )}

      {d.inactivos.length > 0 && (
        <section className="flex flex-col gap-1" aria-labelledby="inactivos">
          <SectionTitle>
            <span id="inactivos">Ya no trabajan</span>
          </SectionTitle>
          <List>
            {d.inactivos.map((e) => (
              <FilaEmpleado key={e.id} e={e} href={href(e.id)} />
            ))}
          </List>
        </section>
      )}
    </>
  );
}

function FilaEmpleado({ e, href }: { e: ResumenEmpleado; href: string }) {
  const saldo = textoSaldo(e.saldo);
  return (
    <ListLinkRow
      href={href}
      title={
        <>
          {e.nombre} <span className="font-semibold text-muted">· {e.puesto}</span>
        </>
      }
      subtitle={`${plural(e.jornadas, "jornada", "jornadas")} · trabajó ${formatPesos(e.devengado)} · cobró ${formatPesos(e.pagado)}`}
      trailing={<Badge tono={saldo.tono}>{saldo.texto}</Badge>}
    />
  );
}

function TablaEmpleados({
  empleados,
  href,
  mesNombre,
}: {
  empleados: ResumenEmpleado[];
  href: (id: string) => string;
  mesNombre: string;
}) {
  const th = "px-4 py-3 font-bold";
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block">
      <table className="w-full text-left text-[15px]">
        <caption className="sr-only">Jornadas y pagos del equipo en {mesNombre}</caption>
        <thead className="bg-surface-2 text-[13px] text-muted">
          <tr>
            <th scope="col" className={th}>
              Nombre
            </th>
            <th scope="col" className={th}>
              Puesto
            </th>
            <th scope="col" className={`${th} text-right`}>
              Jornal
            </th>
            <th scope="col" className={`${th} text-right`}>
              Jornadas
            </th>
            <th scope="col" className={`${th} text-right`}>
              Trabajado
            </th>
            <th scope="col" className={`${th} text-right`}>
              Pagado
            </th>
            <th scope="col" className={`${th} text-right`}>
              Saldo
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {empleados.map((e) => {
            const saldo = textoSaldo(e.saldo);
            return (
              <tr key={e.id} className="transition-colors hover:bg-surface-2">
                <th scope="row" className="px-4 py-3 text-left">
                  <Link href={href(e.id)} className="font-bold text-ink hover:text-brand hover:underline">
                    {e.nombre}
                  </Link>
                </th>
                <td className="px-4 py-3">{e.puesto}</td>
                <td className="px-4 py-3 text-right">
                  <Money value={e.jornal} />
                </td>
                <td className="tabular px-4 py-3 text-right">{e.jornadas}</td>
                <td className="px-4 py-3 text-right">
                  <Money value={e.devengado} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Money value={e.pagado} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge tono={saldo.tono}>{saldo.texto}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
