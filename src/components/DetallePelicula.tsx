import Image from "next/image";
import Link from "next/link";
import { formatDuracion } from "@/lib/formato";
import type { Pelicula, ResultadoPelicula } from "@/lib/peliculas";

interface DetallePeliculaProps {
  resultado: ResultadoPelicula;
}

/**
 * Página de detalle de una película. Pinta los tres estados que devuelve
 * `getPelicula` (la ficha, «no encontrada» y «error») y, arriba, el enlace
 * para volver a la cartelera, que es el mismo en los tres.
 */
export default function DetallePelicula({ resultado }: DetallePeliculaProps) {
  return (
    <div className="flex flex-col items-start gap-8">
      <Link
        href="/"
        className="rounded-sm text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:outline-blue-400"
      >
        Volver a la cartelera
      </Link>

      {resultado.ok ? (
        <Ficha pelicula={resultado.pelicula} />
      ) : resultado.motivo === "no-encontrada" ? (
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          No encontramos esa película
        </h1>
      ) : (
        <p
          role="alert"
          className="w-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          No pudimos cargar la película. Intenta de nuevo en unos minutos.
        </p>
      )}
    </div>
  );
}

function Ficha({ pelicula }: { pelicula: Pelicula }) {
  return (
    <article className="flex w-full flex-col gap-8 md:flex-row">
      <div className="relative aspect-[2/3] w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
        <Image
          src={pelicula.imagenUrl}
          alt={`Póster de ${pelicula.titulo}`}
          fill
          sizes="320px"
          className="object-cover"
          loading="eager"
        />
      </div>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {pelicula.titulo}
        </h1>
        <p className="max-w-prose text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          {pelicula.sinopsis}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Género
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {pelicula.genero}
          </dd>
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Clasificación
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {pelicula.clasificacion}
          </dd>
          <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
            Duración
          </dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {formatDuracion(pelicula.duracionMinutos)}
          </dd>
        </dl>
      </div>
    </article>
  );
}
