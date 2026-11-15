"use client";

import { useActionState, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Field, FormError, Input, Select, Textarea, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import type { EstadoForm } from "@/lib/forms";
import { crearTurno, reprogramarTurno } from "../actions";
import { DURACIONES, claveHorario } from "./utilidades";

// Los campos son controlados: React reinicia los formularios después de cada
// acción, y así no se pierde lo cargado cuando el servidor devuelve errores.

type Horario = { fecha: string; hora: string; duracion: string };

/** Props de accesibilidad para un campo con posible error. */
function conError(id: string, error?: string) {
  return error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

function CamposHorario({
  valor,
  onChange,
  errores,
}: {
  valor: Horario;
  onChange: (h: Horario) => void;
  errores?: Record<string, string>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="Fecha" htmlFor="fecha" error={errores?.fecha} className="col-span-2 sm:col-span-1">
        <Input
          id="fecha"
          name="fecha"
          type="date"
          required
          value={valor.fecha}
          onChange={(e) => onChange({ ...valor, fecha: e.target.value })}
          {...conError("fecha", errores?.fecha)}
        />
      </Field>
      <Field label="Hora" htmlFor="hora" error={errores?.hora}>
        <Input
          id="hora"
          name="hora"
          type="time"
          required
          value={valor.hora}
          onChange={(e) => onChange({ ...valor, hora: e.target.value })}
          {...conError("hora", errores?.hora)}
        />
      </Field>
      <Field label="Duración" htmlFor="duracion" error={errores?.duracion}>
        <Select
          id="duracion"
          name="duracion"
          value={valor.duracion}
          onChange={(e) => onChange({ ...valor, duracion: e.target.value })}
          {...conError("duracion", errores?.duracion)}
        >
          {DURACIONES.map((d) => (
            <option key={d.minutos} value={d.minutos}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** Aviso de superposición: deja reenviar igual sin cambiar nada. */
function AvisoSuperposicion({ mensaje, boton }: { mensaje?: string; boton: string }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl bg-warn-soft px-3.5 py-3 text-sm font-semibold text-warn-strong">
      <TriangleAlert aria-hidden className="mt-px size-5 shrink-0" />
      <p>
        {mensaje} Si está bien así, tocá «{boton}».
      </p>
    </div>
  );
}

const opcionMarcada =
  "has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand";

// ───────── Turno nuevo ─────────

export type OpcionTrabajo = { id: string; label: string; sinFecha: boolean };
export type OpcionTecnico = { id: string; nombre: string; puesto: string };

export function NuevoTurnoForm({
  trabajos,
  tecnicos,
  inicial,
}: {
  trabajos: OpcionTrabajo[];
  tecnicos: OpcionTecnico[];
  inicial: Horario & { trabajoId: string };
}) {
  const [estadoForm, accion] = useActionState<EstadoForm, FormData>(crearTurno, null);
  const [trabajoId, setTrabajoId] = useState(inicial.trabajoId);
  const [horario, setHorario] = useState<Horario>({ fecha: inicial.fecha, hora: inicial.hora, duracion: inicial.duracion });
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [estado, setEstado] = useState<"A_CONFIRMAR" | "CONFIRMADO">("A_CONFIRMAR");
  const [notas, setNotas] = useState("");

  const errores = estadoForm?.errores;
  const clave = claveHorario({ ...horario, tecnicos: elegidos, extra: trabajoId });
  const pideConfirmar = errores?.confirmar === clave;
  const esperan = trabajos.filter((t) => t.sinFecha);
  const otros = trabajos.filter((t) => !t.sinFecha);
  const boton = pideConfirmar ? "Agendar igual" : "Agendar visita";

  return (
    <form action={accion} className="flex flex-col gap-5">
      <Field label="Trabajo" htmlFor="trabajoId" error={errores?.trabajoId}>
        <Select
          id="trabajoId"
          name="trabajoId"
          required
          value={trabajoId}
          onChange={(e) => setTrabajoId(e.target.value)}
          {...conError("trabajoId", errores?.trabajoId)}
        >
          <option value="" disabled>
            Elegí un trabajo
          </option>
          {esperan.length > 0 && (
            <optgroup label="Esperan fecha">
              {esperan.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          )}
          {otros.length > 0 && (
            <optgroup label={esperan.length > 0 ? "Otros trabajos" : "Trabajos"}>
              {otros.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
      </Field>

      <CamposHorario valor={horario} onChange={setHorario} errores={errores} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold">Técnicos</legend>
        {tecnicos.length === 0 ? (
          <p className="text-[13px] text-muted">No hay técnicos activos. Cargalos en Personal.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tecnicos.map((t) => (
              <label
                key={t.id}
                className={cx(
                  "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 transition-colors",
                  opcionMarcada,
                )}
              >
                <input
                  type="checkbox"
                  name="tecnicos"
                  value={t.id}
                  checked={elegidos.includes(t.id)}
                  onChange={(e) =>
                    setElegidos((prev) => (e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)))
                  }
                  className="size-5 accent-brand"
                />
                <span className="text-[15px] font-bold">{t.nombre}</span>
                <span className="text-[13px] text-muted">{t.puesto}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold">Estado del turno</legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {(
            [
              ["A_CONFIRMAR", "A confirmar"],
              ["CONFIRMADO", "Confirmado"],
            ] as const
          ).map(([valor, label]) => (
            <label
              key={valor}
              className={cx(
                "flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-bold transition-colors",
                opcionMarcada,
              )}
            >
              <input
                type="radio"
                name="estado"
                value={valor}
                checked={estado === valor}
                onChange={() => setEstado(valor)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-[13px] text-muted">Confirmado: el cliente ya sabe el día y la hora.</p>
      </fieldset>

      <Field label="Notas" htmlFor="notas" hint="Opcional. Lo que tiene que saber el que va." error={errores?.notas}>
        <Textarea
          id="notas"
          name="notas"
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej.: llevar escalera larga, pedir la llave en portería"
          {...conError("notas", errores?.notas)}
        />
      </Field>

      {pideConfirmar ? (
        <>
          <AvisoSuperposicion mensaje={estadoForm?.error} boton={boton} />
          <input type="hidden" name="confirmar" value={clave} />
        </>
      ) : (
        <FormError message={errores?.confirmar ? null : estadoForm?.error} />
      )}

      <SubmitButton pendingText="Agendando…" className="lg:w-auto lg:self-start lg:px-8">
        {boton}
      </SubmitButton>
    </form>
  );
}

// ───────── Reprogramar ─────────

export function ReprogramarForm({
  turnoId,
  tecnicos,
  inicial,
  textoBoton,
}: {
  turnoId: string;
  /** Ids de los técnicos del turno (para avisar si se pisan con otra visita). */
  tecnicos: string[];
  inicial: Horario;
  textoBoton: string;
}) {
  const [estadoForm, accion] = useActionState<EstadoForm, FormData>(reprogramarTurno, null);
  const [horario, setHorario] = useState<Horario>(inicial);

  const errores = estadoForm?.errores;
  const clave = claveHorario({ ...horario, tecnicos, extra: turnoId });
  const pideConfirmar = errores?.confirmar === clave;
  const boton = pideConfirmar ? "Guardar igual" : textoBoton;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="turnoId" value={turnoId} />
      <CamposHorario valor={horario} onChange={setHorario} errores={errores} />
      <p className="text-[13px] text-muted">El turno vuelve a quedar «A confirmar» hasta que hables con el cliente.</p>

      {pideConfirmar ? (
        <>
          <AvisoSuperposicion mensaje={estadoForm?.error} boton={boton} />
          <input type="hidden" name="confirmar" value={clave} />
        </>
      ) : (
        <FormError message={errores?.confirmar ? null : estadoForm?.error} />
      )}
      {estadoForm?.ok && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-ok-soft px-3.5 py-3 text-sm font-semibold text-ok">
          <CircleCheck aria-hidden className="size-5 shrink-0" />
          {estadoForm.ok}
        </p>
      )}

      <SubmitButton pendingText="Guardando…" variante="secondary">
        {boton}
      </SubmitButton>
    </form>
  );
}
