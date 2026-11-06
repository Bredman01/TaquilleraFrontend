import PeliculaCard from "@/components/PeliculaCard";
import { getPeliculas } from "@/lib/peliculas";

export default async function Cartelera() {
  const resultado = await getPeliculas();

  return !resultado.ok ? (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      No pudimos cargar la cartelera. Intenta de nuevo en unos minutos.
    </p>
  ) : resultado.peliculas.length === 0 ? (
    <p className="rounded-xl border border-black/[.08] p-6 text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
      No hay películas en cartelera.
    </p>
  ) : (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resultado.peliculas.map((pelicula, indice) => (
        <li key={pelicula.id}>
          <PeliculaCard pelicula={pelicula} prioridad={indice === 0} />
        </li>
      ))}
    </ul>
  );
}
