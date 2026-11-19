import type { Metadata } from "next";
import { Suspense } from "react";
import DetallePelicula from "@/components/DetallePelicula";
import { getPelicula } from "@/lib/peliculas";

/**
 * El título de la pestaña es «{título} · Taquillera». Si no hay película
 * (no existe, el id no es válido o el backend no responde) no define título y
 * la pestaña hereda el del layout. No lanza nunca: `getPelicula` devuelve el
 * fallo como valor.
 */
export async function generateMetadata({
  params,
}: PageProps<"/peliculas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const resultado = await getPelicula(id);
  return resultado.ok
    ? { title: `${resultado.pelicula.titulo} · Taquillera` }
    : {};
}

export default function PeliculaPage({ params }: PageProps<"/peliculas/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <p role="status" className="text-zinc-600 dark:text-zinc-400">
            Cargando película…
          </p>
        }
      >
        <DetalleCargado params={params} />
      </Suspense>
    </main>
  );
}

/** Espera `params` y la película dentro del `<Suspense>` (Cache Components). */
async function DetalleCargado({
  params,
}: {
  params: PageProps<"/peliculas/[id]">["params"];
}) {
  const { id } = await params;
  return <DetallePelicula resultado={await getPelicula(id)} />;
}
