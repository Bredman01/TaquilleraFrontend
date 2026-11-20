"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { EstadoBoleta } from "@/lib/boletas";
import { formatDia, formatHora } from "@/lib/formato";
import { validarIngreso } from "@/lib/ingreso";

interface IngresoBoletaProps {
  codigo: string;
  /** El estado con el que llegó la boleta; la validación puede cambiarlo. */
  estado: EstadoBoleta;
  /** La fecha de uso con la que llegó la boleta; `null` si es válida. */
  fechaUso: string | null;
}

/**
 * Lo que pasó con la validación de *esta* pantalla. Mientras no haya resultado
 * (`inicial`, `validando` y `error`), se muestra lo que dicen las props.
 */
type Resultado =
  | { tipo: "inicial" }
  | { tipo: "validando" }
  | { tipo: "usada"; fechaUso: string }
  | { tipo: "ya-usada"; fechaUso: string | null }
  | { tipo: "error" };

// Las clases salen de las piezas de la guía visual.
const TITULO_DE_SECCION =
  "text-xl font-semibold text-zinc-950 dark:text-zinc-50";
const MENSAJE_DE_ERROR =
  "rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
const MENSAJE_DE_EXITO =
  "rounded-xl border border-green-200 bg-green-50 p-6 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200";
const FOCO_DE_TECLADO =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

// «Estado de la boleta»: la palabra es la señal, el color no es la única.
const ESTADO_VALIDA =
  "inline-block rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-sm font-semibold text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200";
const ESTADO_USADA =
  "rounded-md border border-zinc-300 px-2 py-0.5 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-300";

// «Botón principal» con «Botón o control deshabilitado».
const BOTON_VALIDAR =
  "h-12 w-full rounded-lg bg-zinc-950 px-5 text-base font-semibold text-white enabled:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:enabled:hover:bg-zinc-200 dark:focus-visible:outline-blue-400";

/**
 * Ref estable que da el foco al elemento cuando aparece. Al estar definida fuera
 * del componente, React la llama solo al montar y no en cada render.
 */
function enfocarAlAparecer(elemento: HTMLElement | null) {
  elemento?.focus();
}

/**
 * El estado de la boleta y el botón «Validar ingreso». Es el único componente de
 * cliente de la página de la boleta: valida con `validarIngreso` (`lib/ingreso.ts`)
 * y solo pinta y avisa. No recarga la página: la respuesta ya trae el estado y la
 * fecha de uso.
 *
 * El foco:
 * - con 200, pasa a «Ingreso validado.»;
 * - con 409, al aviso de que la boleta ya se usó;
 * - tras un fallo, vuelve al botón: un botón que se deshabilita mientras lo tiene
 *   pierde el foco, y quien usa el teclado empezaría de nuevo.
 */
export default function IngresoBoleta({
  codigo,
  estado,
  fechaUso,
}: IngresoBoletaProps) {
  const [resultado, setResultado] = useState<Resultado>({ tipo: "inicial" });
  const botonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const fallo = resultado.tipo === "error";
  useEffect(() => {
    if (fallo) botonRef.current?.focus();
  }, [fallo]);

  async function validar() {
    // Un segundo clic mientras se valida no vuelve a llamar a la API.
    if (resultado.tipo === "validando") return;

    setResultado({ tipo: "validando" });
    const respuesta = await validarIngreso(codigo);
    if (respuesta.ok) {
      setResultado({ tipo: "usada", fechaUso: respuesta.fechaUso });
    } else if (respuesta.motivo === "ya-usada") {
      setResultado({ tipo: "ya-usada", fechaUso: respuesta.fechaUso });
    } else {
      setResultado({ tipo: "error" });
    }
  }

  const mostrado =
    resultado.tipo === "usada" || resultado.tipo === "ya-usada"
      ? { estado: "usada" as const, fechaUso: resultado.fechaUso }
      : { estado, fechaUso };
  const usada = mostrado.estado === "usada";
  const validando = resultado.tipo === "validando";

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex w-full flex-col gap-4">
      <h2 id={`${id}-titulo`} className={TITULO_DE_SECCION}>
        Estado
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <Dato
          termino="Estado"
          valor={
            <span className={usada ? ESTADO_USADA : ESTADO_VALIDA}>
              {usada ? "Usada" : "Válida"}
            </span>
          }
        />
        {usada && mostrado.fechaUso !== null ? (
          <>
            <Dato termino="Día de uso" valor={formatDia(mostrado.fechaUso)} />
            <Dato termino="Hora de uso" valor={formatHora(mostrado.fechaUso)} />
          </>
        ) : null}
      </dl>

      {resultado.tipo === "usada" ? (
        <p
          ref={enfocarAlAparecer}
          tabIndex={-1}
          className={`${MENSAJE_DE_EXITO} ${FOCO_DE_TECLADO}`}
        >
          Ingreso validado.
        </p>
      ) : null}
      {resultado.tipo === "ya-usada" ? (
        <p
          ref={enfocarAlAparecer}
          role="alert"
          tabIndex={-1}
          className={`${MENSAJE_DE_ERROR} ${FOCO_DE_TECLADO}`}
        >
          {resultado.fechaUso === null
            ? "Esta boleta ya fue usada."
            : `Esta boleta ya fue usada. Primer uso: ${formatDia(resultado.fechaUso)}, ${formatHora(resultado.fechaUso)}`}
        </p>
      ) : null}
      {fallo ? (
        <p role="alert" className={MENSAJE_DE_ERROR}>
          No pudimos validar el ingreso. Revisa tu conexión e inténtalo de
          nuevo.
        </p>
      ) : null}

      {usada ? null : (
        <button
          ref={botonRef}
          type="button"
          disabled={validando}
          onClick={validar}
          className={BOTON_VALIDAR}
        >
          {validando ? "Validando ingreso…" : "Validar ingreso"}
        </button>
      )}
    </section>
  );
}

function Dato({ termino, valor }: { termino: string; valor: ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
        {termino}
      </dt>
      <dd className="text-zinc-600 dark:text-zinc-400">{valor}</dd>
    </>
  );
}
