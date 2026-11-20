import { Suspense } from "react";
import AsientosFuncion from "@/components/AsientosFuncion";
import DetalleFuncion from "@/components/DetalleFuncion";
import { getAsientos, getFuncion } from "@/lib/funciones";

export default function FuncionPage({ params }: PageProps<"/funciones/[id]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <p role="status" className="text-zinc-600 dark:text-zinc-400">
            Cargando función…
          </p>
        }
      >
        <FuncionCargada params={params} />
      </Suspense>
    </main>
  );
}

/**
 * Espera `params` y la función dentro del `<Suspense>` (Cache Components). Los
 * asientos se piden después y en su propio `<Suspense>`: la cabecera no espera
 * por ellos, y solo se piden si la función existe. Con una función que no existe
 * o que no cargó, no hay mapa y no se llama a `getAsientos`.
 */
async function FuncionCargada({
  params,
}: {
  params: PageProps<"/funciones/[id]">["params"];
}) {
  const { id } = await params;
  const resultado = await getFuncion(id);
  return (
    <DetalleFuncion
      resultado={resultado}
      mapa={
        resultado.ok ? (
          <Suspense
            fallback={
              <p role="status" className="text-zinc-600 dark:text-zinc-400">
                Cargando asientos…
              </p>
            }
          >
            <AsientosCargados
              funcionId={resultado.funcion.id}
              precio={resultado.funcion.precio}
            />
          </Suspense>
        ) : undefined
      }
    />
  );
}

/** Espera los asientos de la función y los pinta; `getAsientos` no lanza. */
async function AsientosCargados({
  funcionId,
  precio,
}: {
  funcionId: number;
  precio: number;
}) {
  return (
    <AsientosFuncion
      resultado={await getAsientos(funcionId)}
      funcionId={funcionId}
      precio={precio}
    />
  );
}
