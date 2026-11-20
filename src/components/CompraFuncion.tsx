import Link from "next/link";
import FormularioCompra from "@/components/FormularioCompra";
import type { PaginaCompra } from "@/lib/compras";
import { formatDia, formatHora, formatPrecio } from "@/lib/formato";
import type { FuncionConEvento } from "@/lib/funciones";

interface CompraFuncionProps {
  resultado: PaginaCompra;
}

const TITULO_PAGINA =
  "text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";

// «Botón principal» de la guía en un enlace: lleva `hover:` y no `enabled:hover:`,
// porque un enlace no se deshabilita.
const ENLACE_COMO_BOTON =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 py-3 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:outline-blue-400";

/**
 * Página de compra de una función. Pinta los cuatro estados que decide
 * `prepararCompra` (la compra lista, «sin asientos», «no encontrada» y «error») y,
 * arriba, el enlace para volver a la cartelera, que es el mismo en los cuatro.
 * Cada estado tiene su propio `h1` (un solo `h1` por página).
 *
 * Con la compra lista, debajo del resumen va el formulario de pago, que es el
 * único componente de cliente: el resto es de servidor y no formatea nada por su
 * cuenta (el dinero, el día y la hora salen de `lib/formato.ts`).
 */
export default function CompraFuncion({ resultado }: CompraFuncionProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-start gap-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:outline-blue-400"
      >
        Volver a la cartelera
      </Link>

      {resultado.estado === "lista" ? (
        <>
          <div className="flex w-full flex-col gap-6">
            <h1 className={TITULO_PAGINA}>Tu compra</h1>
            <Resumen
              funcion={resultado.funcion}
              asientos={resultado.asientos}
              total={resultado.total}
            />
          </div>
          <FormularioCompra
            funcionId={resultado.funcion.id}
            asientos={resultado.asientos}
            total={resultado.total}
          />
        </>
      ) : resultado.estado === "sin-asientos" ? (
        <div className="flex w-full flex-col gap-6">
          <h1 className={TITULO_PAGINA}>Elige tus asientos primero</h1>
          <div className="flex w-full flex-col items-start gap-4 rounded-xl border border-black/[.08] p-6 text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
            <Link
              href={`/funciones/${resultado.funcionId}`}
              className={ENLACE_COMO_BOTON}
            >
              Ir al mapa de asientos
            </Link>
          </div>
        </div>
      ) : resultado.estado === "no-encontrada" ? (
        <h1 className={TITULO_PAGINA}>No encontramos esa función</h1>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <h1 className={TITULO_PAGINA}>No pudimos cargar la compra</h1>
          <p
            role="alert"
            className="w-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            No pudimos cargar la compra. Intenta de nuevo en unos minutos.
          </p>
        </div>
      )}
    </div>
  );
}

function Resumen({
  funcion,
  asientos,
  total,
}: {
  funcion: FuncionConEvento;
  asientos: string[];
  total: number;
}) {
  return (
    <section
      aria-labelledby="titulo-resumen"
      className="flex w-full flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 shadow-sm dark:border-white/[.145] dark:bg-zinc-900"
    >
      <h2
        id="titulo-resumen"
        className="text-xl font-semibold text-zinc-950 dark:text-zinc-50"
      >
        Resumen
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <Dato termino="Evento" valor={funcion.titulo} />
        <Dato termino="Día" valor={formatDia(funcion.inicio)} />
        <Dato termino="Hora" valor={formatHora(funcion.inicio)} />
        <Dato termino="Lugar" valor={funcion.lugar} />
        <Dato termino="Asientos" valor={asientos.join(", ")} />
        <Dato termino="Total" valor={formatPrecio(total)} />
      </dl>
    </section>
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
