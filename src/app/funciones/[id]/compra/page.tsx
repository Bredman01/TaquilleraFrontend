import { Suspense } from "react";
import CompraFuncion from "@/components/CompraFuncion";
import { prepararCompra } from "@/lib/compras";
import { getAsientos, getFuncion } from "@/lib/funciones";

export default function CompraPage({
  params,
  searchParams,
}: PageProps<"/funciones/[id]/compra">) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <p role="status" className="text-zinc-600 dark:text-zinc-400">
            Cargando compra…
          </p>
        }
      >
        <CompraCargada params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * Espera `params` y `searchParams` dentro del `<Suspense>` (Cache Components),
 * pide la función y, solo si existe, sus asientos, y deja que `prepararCompra`
 * decida qué se pinta. `?asientos=A1,A2` llega ya decodificado: Next escribe la
 * coma como `%2C` al navegar, pero `searchParams` la entrega como coma.
 *
 * Con una función que no existe o que no cargó, no se llama a `getAsientos`.
 */
async function CompraCargada({
  params,
  searchParams,
}: Pick<PageProps<"/funciones/[id]/compra">, "params" | "searchParams">) {
  const { id } = await params;
  const { asientos: direccion } = await searchParams;
  const funcion = await getFuncion(id);
  const asientos = funcion.ok ? await getAsientos(funcion.funcion.id) : null;

  return (
    <CompraFuncion resultado={prepararCompra(funcion, asientos, direccion)} />
  );
}
