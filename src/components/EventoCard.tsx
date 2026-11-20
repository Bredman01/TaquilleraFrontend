import Image from "next/image";
import Link from "next/link";
import { NOMBRE_CATEGORIA, type Evento } from "@/lib/eventos";
import { formatDuracion } from "@/lib/formato";

interface EventoCardProps {
  evento: Evento;
  prioridad?: boolean;
}

export default function EventoCard({
  evento,
  prioridad = false,
}: EventoCardProps) {
  return (
    <Link
      href={`/eventos/${evento.id}`}
      className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-sm transition-shadow group-hover:shadow-md dark:border-white/[.145] dark:bg-zinc-900">
        <div className="relative aspect-[2/3] w-full bg-zinc-200 dark:bg-zinc-800">
          <Image
            src={evento.imagenUrl}
            alt={`Afiche de ${evento.titulo}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            loading={prioridad ? "eager" : "lazy"}
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold leading-snug text-zinc-950 dark:text-zinc-50">
              {evento.titulo}
            </h3>
            <span
              aria-label={`Clasificación ${evento.clasificacion}`}
              className="shrink-0 rounded-md border border-zinc-300 px-2 py-0.5 text-sm font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              {evento.clasificacion}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {NOMBRE_CATEGORIA[evento.categoria]} · {evento.ciudad} ·{" "}
            {formatDuracion(evento.duracionMinutos)}
          </p>
        </div>
      </article>
    </Link>
  );
}
