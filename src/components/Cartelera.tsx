import VistaCartelera from "@/components/VistaCartelera";
import { cargarCartelera } from "@/lib/cartelera";

/**
 * Server Component asíncrono que solo conecta piezas: espera los parámetros de
 * la dirección, carga la cartelera y la pinta. Va dentro de un `<Suspense>`
 * porque `searchParams` se conoce solo al recibir la petición.
 */
export default async function Cartelera({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  const resultado = await cargarCartelera(await searchParams);

  return <VistaCartelera resultado={resultado} />;
}
