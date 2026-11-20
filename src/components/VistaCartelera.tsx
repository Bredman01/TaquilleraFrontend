import Link from "next/link";
import EventoCard from "@/components/EventoCard";
import FiltrosCartelera from "@/components/FiltrosCartelera";
import type { ResultadoCartelera } from "@/lib/cartelera";

interface VistaCarteleraProps {
  resultado: ResultadoCartelera;
}

/**
 * Lo que pinta la cartelera según `cargarCartelera`: el aviso de error, o los
 * filtros con las tarjetas de los eventos, o el mensaje de que no hay ninguno
 * (con una salida si hay filtros puestos).
 */
export default function VistaCartelera({ resultado }: VistaCarteleraProps) {
  if (!resultado.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        No pudimos cargar la cartelera. Intenta de nuevo en unos minutos.
      </p>
    );
  }

  const { eventos, ciudades, filtros } = resultado;
  const hayFiltros =
    filtros.categoria !== undefined ||
    filtros.ciudad !== undefined ||
    filtros.fecha !== undefined;

  return (
    <div className="flex flex-col gap-8">
      {/* La key reinicia los campos cuando cambia la dirección. */}
      <FiltrosCartelera
        key={`${filtros.categoria ?? ""}|${filtros.ciudad ?? ""}|${filtros.fecha ?? ""}`}
        ciudades={ciudades}
        filtros={filtros}
      />

      {eventos.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {eventos.map((evento, indice) => (
            <li key={evento.id}>
              <EventoCard evento={evento} prioridad={indice === 0} />
            </li>
          ))}
        </ul>
      ) : hayFiltros ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-black/[.08] p-6 text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
          <p>No hay eventos con esos filtros</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:outline-blue-400"
          >
            Ver todos los eventos
          </Link>
        </div>
      ) : (
        <p className="rounded-xl border border-black/[.08] p-6 text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
          No hay eventos en cartelera.
        </p>
      )}
    </div>
  );
}
