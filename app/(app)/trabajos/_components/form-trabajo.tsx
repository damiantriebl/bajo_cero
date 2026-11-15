"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import type { ClienteParaTrabajo, InsumoParaItems, ItemEditable } from "@/lib/data/trabajos";
import type { TipoTrabajo } from "@/lib/generated/prisma/enums";
import type { EstadoForm } from "@/lib/forms";
import { TIPO_TRABAJO, opciones } from "@/lib/etiquetas";
import { ButtonLink, Card, Field, FormError, Input, Select, Textarea, buttonClass } from "@/components/ui/base";
import { EditorItems } from "./editor-items";

type Accion = (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;

export type ValoresTrabajo = {
  titulo: string;
  tipo: TipoTrabajo;
  direccion: string;
  descripcion: string;
  condiciones: string;
  validoHasta: string;
  items: ItemEditable[];
};

type Props = {
  accion: Accion;
  valores: ValoresTrabajo;
  insumos: InsumoParaItems[];
  cancelarHref: string;
  textoGuardar: string;
} & (
  | { modo: "nuevo"; clientes: ClienteParaTrabajo[]; clienteInicial: string }
  | { modo: "editar"; cliente: ClienteParaTrabajo }
);

const TIPOS = opciones(TIPO_TRABAJO);

/** Formulario de presupuesto: datos del trabajo, ítems y condiciones. */
export function FormTrabajo(props: Props) {
  const { accion, valores, insumos, cancelarHref, textoGuardar } = props;
  const [estado, dispatch, pending] = useActionState(accion, null);
  const [clienteId, setClienteId] = useState(props.modo === "nuevo" ? props.clienteInicial : props.cliente.id);

  const errores = estado?.errores ?? {};
  const a11y = (id: string, campo: string) =>
    errores[campo] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  const cliente =
    props.modo === "nuevo" ? props.clientes.find((c) => c.id === clienteId) : props.cliente;

  // Enviar sin el reseteo automático de <form action>: si el servidor devuelve
  // errores, lo que se cargó (sobre todo los ítems) queda como estaba.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return (
    <form action={dispatch} onSubmit={onSubmit} className="flex w-full max-w-4xl flex-col gap-4 lg:gap-6">
      <Card className="flex flex-col gap-4 p-4 lg:p-6">
        <h2 className="text-lg font-bold">Datos del trabajo</h2>

        {props.modo === "nuevo" ? (
          <Field label="Cliente" htmlFor="trabajo-cliente" error={errores.clienteId}>
            <Select
              id="trabajo-cliente"
              name="clienteId"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              required
              {...a11y("trabajo-cliente", "clienteId")}
            >
              <option value="">Elegí un cliente</option>
              {props.clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
            <Link
              href="/clientes/nuevo"
              className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-bold text-brand hover:underline"
            >
              <UserPlus aria-hidden className="size-4" />
              ¿Cliente nuevo? Cargalo primero
            </Link>
          </Field>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold">Cliente</span>
            <span className="text-base">{props.cliente.nombre}</span>
          </div>
        )}

        <Field label="Título" htmlFor="trabajo-titulo" error={errores.titulo} hint="Es lo primero que lee el cliente.">
          <Input
            id="trabajo-titulo"
            name="titulo"
            defaultValue={valores.titulo}
            required
            maxLength={120}
            placeholder="Ej.: Instalación split 3000 fg"
            autoComplete="off"
            {...a11y("trabajo-titulo", "titulo")}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de trabajo" htmlFor="trabajo-tipo" error={errores.tipo}>
            <Select id="trabajo-tipo" name="tipo" defaultValue={valores.tipo} {...a11y("trabajo-tipo", "tipo")}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Válido hasta" htmlFor="trabajo-validez" error={errores.validoHasta}>
            <Input
              id="trabajo-validez"
              name="validoHasta"
              type="date"
              defaultValue={valores.validoHasta}
              {...a11y("trabajo-validez", "validoHasta")}
            />
          </Field>
        </div>

        <Field
          label="Dirección del trabajo (opcional)"
          htmlFor="trabajo-direccion"
          error={errores.direccion}
          hint={
            cliente?.direccion
              ? `Si la dejás vacía, va la del cliente: ${cliente.direccion}.`
              : "Si la dejás vacía, va la del cliente."
          }
        >
          <Input
            id="trabajo-direccion"
            name="direccion"
            defaultValue={valores.direccion}
            maxLength={200}
            placeholder={cliente?.direccion ?? "Calle, número, piso"}
            autoComplete="off"
            {...a11y("trabajo-direccion", "direccion")}
          />
        </Field>

        <Field
          label="Descripción (opcional)"
          htmlFor="trabajo-descripcion"
          error={errores.descripcion}
          hint="Sale en el presupuesto. Ej.: Equipo provisto por el cliente."
        >
          <Textarea
            id="trabajo-descripcion"
            name="descripcion"
            defaultValue={valores.descripcion}
            maxLength={1000}
            rows={3}
            {...a11y("trabajo-descripcion", "descripcion")}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4 p-4 lg:p-6">
        <h2 className="text-lg font-bold">Qué se le cobra</h2>
        <EditorItems inicial={valores.items} insumos={insumos} errores={errores} />
      </Card>

      <Card className="flex flex-col gap-4 p-4 lg:p-6">
        <Field
          label="Condiciones"
          htmlFor="trabajo-condiciones"
          error={errores.condiciones}
          hint="Una por renglón. Salen al pie del presupuesto."
        >
          <Textarea
            id="trabajo-condiciones"
            name="condiciones"
            defaultValue={valores.condiciones}
            maxLength={2000}
            rows={4}
            {...a11y("trabajo-condiciones", "condiciones")}
          />
        </Field>
      </Card>

      <FormError message={estado?.error} />

      <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:justify-start">
        <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>
          {pending ? "Guardando…" : textoGuardar}
        </button>
        <ButtonLink href={cancelarHref} variante="secondary" tamano="lg" className="w-full sm:w-auto">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
