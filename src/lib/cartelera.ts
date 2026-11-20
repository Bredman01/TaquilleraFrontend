import {
  CATEGORIAS,
  getCiudades,
  getEventos,
  type Evento,
  type Filtros,
} from "@/lib/eventos";

/** Los parámetros de la dirección, como los entrega Next: un parámetro repetido llega como arreglo. */
export type ParametrosDeLaDireccion = Record<
  string,
  string | string[] | undefined
>;

export type ResultadoCartelera =
  | { ok: true; eventos: Evento[]; ciudades: string[]; filtros: Filtros }
  | { ok: false };

/** Sin mayúsculas, tildes ni espacios al principio o al final: «  BOGOTÁ » y «bogota» coinciden. */
function comparable(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
}

/**
 * Convierte los parámetros de la dirección en filtros que el backend acepta.
 *
 * - La categoría solo vale si es exactamente una de las cuatro.
 * - La ciudad solo vale si coincide con una de la lista, sin distinguir
 *   mayúsculas, tildes ni espacios; se usa su nombre canónico.
 * - Todo lo demás es «Todas»: un valor desconocido, vacío o repetido (que llega
 *   como arreglo) no se envía nunca al backend, que respondería 400.
 */
export function leerFiltros(
  parametros: ParametrosDeLaDireccion,
  ciudades: string[],
): Filtros {
  const filtros: Filtros = {};

  const categoria = CATEGORIAS.find((valida) => valida === parametros.categoria);
  if (categoria) filtros.categoria = categoria;

  const escrita = parametros.ciudad;
  if (typeof escrita === "string") {
    const buscada = comparable(escrita);
    const ciudad = ciudades.find((canonica) => comparable(canonica) === buscada);
    if (ciudad) filtros.ciudad = ciudad;
  }

  return filtros;
}

/**
 * Carga todo lo que pinta la cartelera: primero las ciudades, porque el filtro
 * de la dirección se resuelve contra esa lista, y después los eventos ya
 * filtrados. Si cualquiera de las dos peticiones falla devuelve { ok: false }.
 */
export async function cargarCartelera(
  parametros: ParametrosDeLaDireccion,
): Promise<ResultadoCartelera> {
  const ciudades = await getCiudades();
  if (!ciudades.ok) return { ok: false };

  const filtros = leerFiltros(parametros, ciudades.ciudades);
  const eventos = await getEventos(filtros);
  if (!eventos.ok) return { ok: false };

  return {
    ok: true,
    eventos: eventos.eventos,
    ciudades: ciudades.ciudades,
    filtros,
  };
}
