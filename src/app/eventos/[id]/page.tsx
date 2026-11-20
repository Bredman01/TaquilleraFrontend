import type { Metadata } from "next";
import { Suspense } from "react";
import DetalleEvento from "@/components/DetalleEvento";
import FuncionesEvento from "@/components/FuncionesEvento";
import { getEvento } from "@/lib/eventos";
import { getFunciones } from "@/lib/funciones";

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

/**
 * Espera `params` y el evento dentro del `<Suspense>` (Cache Components). Las
 * funciones se piden después y en su propio `<Suspense>`: la ficha no espera por
 * ellas, y solo se piden si el evento existe (`DetalleEvento` solo pinta el
 * hueco con un evento).
 */
async function DetalleCargado({
  params,
}: {
  params: PageProps<"/eventos/[id]">["params"];
}) {
  const { id } = await params;
  const resultado = await getEvento(id);
  return (
    <DetalleEvento
      resultado={resultado}
      funciones={
        <Suspense
          fallback={
            <p role="status" className="text-zinc-600 dark:text-zinc-400">
              Cargando funciones…
            </p>
          }
        >
          {/* `Number(id)` es válido: el hueco solo se pinta si `getEvento` aceptó el id. */}
          <FuncionesCargadas eventoId={Number(id)} />
        </Suspense>
      }
    />
  );
}

/** Espera las funciones del evento y las pinta; `getFunciones` no lanza. */
async function FuncionesCargadas({ eventoId }: { eventoId: number }) {
  return <FuncionesEvento resultado={await getFunciones(eventoId)} />;
}
