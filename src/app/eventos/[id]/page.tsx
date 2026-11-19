import type { Metadata } from "next";
import { Suspense } from "react";
import DetalleEvento from "@/components/DetalleEvento";
import { getEvento } from "@/lib/eventos";

/**
 * El título de la pestaña es «{título} · Taquillera». Si no hay evento
 * (no existe, el id no es válido o el backend no responde) no define título y
 * la pestaña hereda el del layout. No lanza nunca: `getEvento` devuelve el
 * fallo como valor.
 */
export async function generateMetadata({
  params,
}: PageProps<"/eventos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const resultado = await getEvento(id);
  return resultado.ok
    ? { title: `${resultado.evento.titulo} · Taquillera` }
    : {};
}

export default function EventoPage({ params }: PageProps<"/eventos/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <p role="status" className="text-zinc-600 dark:text-zinc-400">
            Cargando evento…
          </p>
        }
      >
        <DetalleCargado params={params} />
      </Suspense>
    </main>
  );
}

/** Espera `params` y el evento dentro del `<Suspense>` (Cache Components). */
async function DetalleCargado({
  params,
}: {
  params: PageProps<"/eventos/[id]">["params"];
}) {
  const { id } = await params;
  return <DetalleEvento resultado={await getEvento(id)} />;
}
