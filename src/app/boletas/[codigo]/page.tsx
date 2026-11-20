import { headers } from "next/headers";
import { Suspense } from "react";
import VistaBoleta from "@/components/VistaBoleta";
import { getBoleta, origenDeLaPeticion } from "@/lib/boletas";

export default function BoletaPage({ params }: PageProps<"/boletas/[codigo]">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <p role="status" className="text-zinc-600 dark:text-zinc-400">
            Cargando boleta…
          </p>
        }
      >
        <BoletaCargada params={params} />
      </Suspense>
    </main>
  );
}

/**
 * Espera `params` dentro del `<Suspense>` (Cache Components), pide la boleta con
 * el código tal como llega (ya decodificado; la API acepta mayúsculas o
 * minúsculas) y lee las cabeceras de la petición para armar el origen del código
 * QR. `headers()` es un dato de la petición: solo se llama aquí, dentro del
 * `<Suspense>`, y la pregunta a la API y la lectura de las cabeceras van juntas.
 *
 * Un código que no existe responde 200 con su mensaje: no se usa `notFound()`.
 */
async function BoletaCargada({
  params,
}: Pick<PageProps<"/boletas/[codigo]">, "params">) {
  const { codigo } = await params;
  const [resultado, cabeceras] = await Promise.all([
    getBoleta(codigo),
    headers(),
  ]);

  return (
    <VistaBoleta resultado={resultado} origen={origenDeLaPeticion(cabeceras)} />
  );
}
