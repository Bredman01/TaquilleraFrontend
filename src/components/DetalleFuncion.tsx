import Link from "next/link";
import type { ReactNode } from "react";
import { formatDia, formatHora, formatPrecio } from "@/lib/formato";
import type { FuncionConEvento, ResultadoFuncion } from "@/lib/funciones";

interface DetalleFuncionProps {
  resultado: ResultadoFuncion;
  /** Lo que va dentro de la sección «Elige tus asientos». Solo se pinta con una función. */
  mapa?: ReactNode;
}

/**
 * Cabecera de la página de una función. Pinta los tres estados que devuelve
 * `getFuncion` (la función, «no encontrada» y «error») y, arriba, el enlace
 * para volver a la cartelera, que es el mismo en los tres. Cada estado tiene
 * su propio `h1` (un solo `h1` por página, también en los estados de error).
 *
 * Con una función, debajo de los datos va la sección «Elige tus asientos» con
 * lo que reciba `mapa`: la página lo carga aparte, para que la cabecera no
 * espere por él.
 */
export default function DetalleFuncion({
  resultado,
  mapa,
}: DetalleFuncionProps) {
  return (
    <div className="flex flex-col items-start gap-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:outline-blue-400"
      >
        Volver a la cartelera
      </Link>

      {resultado.ok ? (
        <>
          <Cabecera funcion={resultado.funcion} />
          <section
            aria-labelledby="titulo-asientos"
            className="flex w-full flex-col gap-4"
          >
            <h2
              id="titulo-asientos"
              className="text-xl font-semibold text-zinc-950 dark:text-zinc-50"
            >
              Elige tus asientos
            </h2>
            {mapa}
          </section>
        </>
      ) : resultado.motivo === "no-encontrado" ? (
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          No encontramos esa función
        </h1>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            No pudimos cargar la función
          </h1>
          <p
            role="alert"
            className="w-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            No pudimos cargar la función. Intenta de nuevo en unos minutos.
          </p>
        </div>
      )}
    </div>
  );
}

function Cabecera({ funcion }: { funcion: FuncionConEvento }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {funcion.titulo}
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <Dato termino="Día" valor={formatDia(funcion.inicio)} />
        <Dato termino="Hora" valor={formatHora(funcion.inicio)} />
        <Dato termino="Lugar" valor={funcion.lugar} />
        <Dato termino="Ciudad" valor={funcion.ciudad} />
        <Dato termino="Precio por boleta" valor={formatPrecio(funcion.precio)} />
      </dl>
    </div>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <>
      <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
        {termino}
      </dt>
      <dd className="text-zinc-600 dark:text-zinc-400">{valor}</dd>
    </>
  );
}
