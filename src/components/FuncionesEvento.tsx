import Link from "next/link";
import { formatHora, formatPrecio } from "@/lib/formato";
import { agruparPorDia, type ResultadoFunciones } from "@/lib/funciones";

interface FuncionesEventoProps {
  resultado: ResultadoFunciones;
}

/**
 * Las funciones de un evento, agrupadas por día. Pinta los tres estados de
 * `getFunciones`: el aviso de error, el evento sin funciones y la lista. Cada
 * función es un enlace a `/funciones/{id}`; hasta que exista esa página,
 * pulsarlo lleva al 404 de Next, y por eso el enlace no se precarga.
 */
export default function FuncionesEvento({ resultado }: FuncionesEventoProps) {
  if (!resultado.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        No pudimos cargar las funciones. Intenta de nuevo en unos minutos.
      </p>
    );
  }

  if (resultado.funciones.length === 0) {
    return (
      <p className="rounded-xl border border-black/[.08] p-6 text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
        No hay funciones programadas
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {agruparPorDia(resultado.funciones).map(({ dia, etiqueta, funciones }) => (
        <div key={dia} className="flex flex-col gap-3">
          <h3
            id={`dia-funciones-${dia}`}
            className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
          >
            {etiqueta}
          </h3>
          <ul
            aria-labelledby={`dia-funciones-${dia}`}
            className="flex flex-wrap gap-3"
          >
            {funciones.map((funcion) => {
              const hora = formatHora(funcion.inicio);
              const precio = formatPrecio(funcion.precio);
              return (
                <li key={funcion.id}>
                  {/* El nombre lleva el día porque el recorrido con Tab lee el nombre del enlace, no el encabezado. */}
                  <Link
                    href={`/funciones/${funcion.id}`}
                    prefetch={false}
                    aria-label={`${etiqueta}, ${hora}, ${precio}`}
                    className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-zinc-300 px-5 py-3 text-base font-semibold text-zinc-950 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:focus-visible:outline-blue-400"
                  >
                    <span>{hora}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {precio}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
