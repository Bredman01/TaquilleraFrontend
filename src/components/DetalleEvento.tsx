import Image from "next/image";
import Link from "next/link";
import {
  NOMBRE_CATEGORIA,
  type Evento,
  type ResultadoEvento,
} from "@/lib/eventos";
import { formatDuracion } from "@/lib/formato";

interface DetalleEventoProps {
  resultado: ResultadoEvento;
}

/**
 * Página de detalle de un evento. Pinta los tres estados que devuelve
 * `getEvento` (la ficha, «no encontrado» y «error») y, arriba, el enlace
 * para volver a la cartelera, que es el mismo en los tres.
 */
export default function DetalleEvento({ resultado }: DetalleEventoProps) {
  return (
    <div className="flex flex-col items-start gap-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:outline-blue-400"
      >
        Volver a la cartelera
      </Link>

      {resultado.ok ? (
        <Ficha evento={resultado.evento} />
      ) : resultado.motivo === "no-encontrado" ? (
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          No encontramos ese evento
        </h1>
      ) : (
        <p
          role="alert"
          className="w-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          No pudimos cargar el evento. Intenta de nuevo en unos minutos.
        </p>
      )}
    </div>
  );
}

function Ficha({ evento }: { evento: Evento }) {
  return (
    <article className="flex w-full flex-col gap-8 md:flex-row">
      <div className="relative aspect-[2/3] w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
        <Image
          src={evento.imagenUrl}
          alt={`Afiche de ${evento.titulo}`}
          fill
          sizes="320px"
          className="object-cover"
          loading="eager"
        />
      </div>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {evento.titulo}
        </h1>
        <p className="max-w-prose text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          {evento.descripcion}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Categoría
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {NOMBRE_CATEGORIA[evento.categoria]}
          </dd>
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Ciudad
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{evento.ciudad}</dd>
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Lugar
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{evento.lugar}</dd>
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Clasificación
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {evento.clasificacion}
          </dd>
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Duración
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {formatDuracion(evento.duracionMinutos)}
          </dd>
        </dl>
      </div>
    </article>
  );
}
