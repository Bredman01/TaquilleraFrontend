import Image from "next/image";
import { formatDuracion } from "@/lib/formato";
import type { Pelicula } from "@/lib/peliculas";

interface PeliculaCardProps {
  pelicula: Pelicula;
  prioridad?: boolean;
}

export default function PeliculaCard({
  pelicula,
  prioridad = false,
}: PeliculaCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-sm dark:border-white/[.145] dark:bg-zinc-900">
      <div className="relative aspect-[2/3] w-full bg-zinc-200 dark:bg-zinc-800">
        <Image
          src={pelicula.imagenUrl}
          alt={`Póster de ${pelicula.titulo}`}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          loading={prioridad ? "eager" : "lazy"}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug text-zinc-950 dark:text-zinc-50">
            {pelicula.titulo}
          </h3>
          <span
            aria-label={`Clasificación ${pelicula.clasificacion}`}
            className="shrink-0 rounded-md border border-zinc-300 px-2 py-0.5 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          >
            {pelicula.clasificacion}
          </span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {pelicula.genero} · {formatDuracion(pelicula.duracionMinutos)}
        </p>
      </div>
    </article>
  );
}
