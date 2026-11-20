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

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Calendario gregoriano: divisible por 4 y no por 100, o divisible por 400. */
function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/**
 * `AAAA-MM-DD` con un mes del 01 al 12 y un día del 01 al último de ese mes.
 * Es la misma regla que aplica el backend, con aritmética y sin `Date` (que
 * dependería de la zona horaria). No recorta espacios: « 2026-11-21» no vale.
 */
function esFechaValida(fecha: string): boolean {
  const partes = FORMATO_FECHA.exec(fecha);
  if (partes === null) return false;

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12) return false;

  const ultimoDia = mes === 2 && esBisiesto(anio) ? 29 : DIAS_POR_MES[mes - 1];
  return dia >= 1 && dia <= ultimoDia;
}

/**
 * Convierte los parámetros de la dirección en filtros que el backend acepta.
 *
 * - La categoría solo vale si es exactamente una de las cuatro.
 * - La ciudad solo vale si coincide con una de la lista, sin distinguir
 *   mayúsculas, tildes ni espacios; se usa su nombre canónico.
 * - La fecha solo vale si es un texto `AAAA-MM-DD` de un día que existe; no
 *   depende de los otros filtros.
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

  const fecha = parametros.fecha;
  if (typeof fecha === "string" && esFechaValida(fecha)) filtros.fecha = fecha;

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
