"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrecio } from "@/lib/formato";
import type { Asiento } from "@/lib/funciones";
import { agruparPorFila, alternarAsiento, rutaDeCompra } from "@/lib/mapa";

interface MapaAsientosProps {
  funcionId: number;
  /** Pesos colombianos por boleta. */
  precio: number;
  asientos: Asiento[];
}

// Las clases salen de las piezas «Asiento disponible», «Asiento seleccionado» y
// «Asiento ocupado» de la guía visual: el mismo botón en los tres estados, que
// cambia por sus atributos (`aria-pressed` y `disabled`), no por clases propias.
const CLASES_ASIENTO =
  "inline-flex size-11 items-center justify-center gap-0.5 rounded-md border border-zinc-300 bg-white text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:enabled:hover:bg-zinc-800 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 " +
  "aria-pressed:border-zinc-950 aria-pressed:bg-zinc-950 aria-pressed:text-white aria-pressed:enabled:hover:bg-zinc-800 dark:aria-pressed:border-zinc-50 dark:aria-pressed:bg-zinc-50 dark:aria-pressed:text-zinc-950 dark:aria-pressed:enabled:hover:bg-zinc-200 " +
  "disabled:cursor-not-allowed disabled:border-dashed disabled:line-through disabled:opacity-50";

// «Botón principal» y, para el botón sin asientos, «Botón o control deshabilitado».
const CLASES_CONTINUAR =
  "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-950 px-5 py-3 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:outline-blue-400 sm:w-auto";

const MARCA_DE_ELEGIDO = (
  <svg
    aria-hidden="true"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3"
  >
    <path d="M2 6.5 4.75 9 10 3" />
  </svg>
);

/**
 * El mapa de asientos de una función: el escenario, las filas, el aviso del
 * máximo, el resumen de la selección con su total y «Continuar». Es el único
 * componente de cliente de la pantalla: solo la selección necesita el navegador.
 * Lo que decide qué cambia al pulsar un asiento está en `lib/mapa.ts`.
 */
export default function MapaAsientos({
  funcionId,
  precio,
  asientos,
}: MapaAsientosProps) {
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [avisoMaximo, setAvisoMaximo] = useState(false);
  const filas = agruparPorFila(asientos);
  const elegidos = new Set(seleccion);

  function alternar(asiento: Asiento) {
    const cambio = alternarAsiento(asientos, seleccion, asiento);
    if (cambio.ok) {
      setSeleccion(cambio.seleccion);
      setAvisoMaximo(false);
    } else if (cambio.motivo === "maximo") {
      setAvisoMaximo(true);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Ocho asientos de 44 px y siete huecos suman 366 px: salir 8 px por cada lado cabe en 390 px. */}
      <div className="-mx-2 sm:mx-0">
        <div className="mx-auto flex w-fit flex-col gap-3 sm:mx-0">
          <p className="block rounded-md border border-zinc-300 px-2 py-2 text-center text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
            Escenario o pantalla
          </p>
          {filas.map(({ fila, asientos: deLaFila }) => (
            <div
              key={fila}
              role="group"
              aria-labelledby={`fila-${fila}`}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
            >
              <span
                id={`fila-${fila}`}
                className="text-sm font-semibold text-zinc-950 sm:w-14 dark:text-zinc-50"
              >
                {`Fila ${fila}`}
              </span>
              <div className="flex gap-0.5 sm:gap-2">
                {deLaFila.map((asiento) => {
                  const elegido = elegidos.has(asiento.id);
                  return (
                    <button
                      key={asiento.id}
                      type="button"
                      aria-label={`Fila ${asiento.fila}, asiento ${asiento.numero}, ${asiento.estado}`}
                      aria-pressed={elegido}
                      disabled={asiento.estado === "ocupado"}
                      onClick={() => alternar(asiento)}
                      className={CLASES_ASIENTO}
                    >
                      {elegido && MARCA_DE_ELEGIDO}
                      {asiento.numero}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:max-w-sm lg:flex-1">
        {avisoMaximo && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            Puedes comprar máximo 6 boletas por compra
          </p>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-6 shadow-sm dark:border-white/[.145] dark:bg-zinc-900">
          <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Tu selección
          </h3>
          <div role="status" className="flex flex-col gap-3">
            {seleccion.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">
                Aún no has elegido asientos
              </p>
            ) : (
              <ul aria-label="Asientos elegidos" className="flex flex-wrap gap-2">
                {seleccion.map((id) => (
                  <li
                    key={id}
                    className="rounded-md border border-zinc-300 px-2 py-0.5 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                  >
                    {id}
                  </li>
                ))}
              </ul>
            )}
            <p className="font-semibold text-zinc-950 dark:text-zinc-50">
              {`Total: ${formatPrecio(precio * seleccion.length)}`}
            </p>
          </div>
        </div>

        {seleccion.length === 0 ? (
          <button
            type="button"
            disabled
            className={`${CLASES_CONTINUAR} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Continuar
          </button>
        ) : (
          <Link
            href={rutaDeCompra(funcionId, seleccion)}
            prefetch={false}
            className={CLASES_CONTINUAR}
          >
            Continuar
          </Link>
        )}
      </div>
    </div>
  );
}
