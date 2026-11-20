import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { API_URL, ESPERA_MAXIMA_MS } from "@/lib/api";

// `API_URL` vive en `lib/api.ts`; se vuelve a exportar para que sigan valiendo
// los imports que ya la piden de aquí.
export { API_URL };

export type Categoria = "cine" | "teatro" | "concierto" | "charla";

/** Las cuatro categorías, en el orden en que se ofrecen en el filtro. */
export const CATEGORIAS: readonly Categoria[] = [
  "cine",
  "teatro",
  "concierto",
  "charla",
];

/** Cómo se muestra cada categoría: igual en el filtro, la tarjeta y la ficha. */
export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  cine: "Cine",
  teatro: "Teatro",
  concierto: "Concierto",
  charla: "Charla",
};

export type Clasificacion = "TP" | "+7" | "+13" | "+16" | "+18";

/**
 * Evento tal como lo responden GET /eventos y GET /eventos/:id en
 * Taquillera-Backend.
 */
export interface Evento {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  ciudad: string;
  lugar: string;
  duracionMinutos: number;
  clasificacion: Clasificacion;
  imagenUrl: string;
}

/** Filtros de la cartelera. Un filtro ausente es «Todas». La fecha es `AAAA-MM-DD`. */
export interface Filtros {
  categoria?: Categoria;
  ciudad?: string;
  fecha?: string;
}

export type ResultadoEventos =
  | { ok: true; eventos: Evento[] }
  | { ok: false };

export type ResultadoCiudades =
  | { ok: true; ciudades: string[] }
  | { ok: false };

export type ResultadoEvento =
  | { ok: true; evento: Evento }
  | { ok: false; motivo: "no-encontrado" | "error" };

/**
 * Entero positivo sin ceros a la izquierda: "1" y "42" sí; "0", "01", "1.5", "-1" y "abc" no.
 * Es la única regla de id del frontend: `getEvento` y `getFuncion` la comparten.
 */
export const ID_VALIDO = /^[1-9]\d*$/;

/**
 * Obtiene la lista de eventos desde el backend, con los filtros que lleguen.
 * Nunca lanza: si la API no responde o la respuesta no es válida devuelve
 * { ok: false } para que la página muestre un mensaje en lugar de romperse.
 *
 * Sin filtros pide `/eventos` sin consulta; con filtros agrega `categoria`,
 * `ciudad` y `fecha`, en ese orden y codificados, y solo los que lleguen.
 */
export async function getEventos(filtros: Filtros): Promise<ResultadoEventos> {
  const consulta = new URLSearchParams();
  if (filtros.categoria) consulta.set("categoria", filtros.categoria);
  if (filtros.ciudad) consulta.set("ciudad", filtros.ciudad);
  if (filtros.fecha) consulta.set("fecha", filtros.fecha);
  const texto = consulta.toString();
  const ruta = texto ? `/eventos?${texto}` : "/eventos";

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (!res.ok) {
      console.error(`GET ${ruta} respondió ${res.status}`);
      return { ok: false };
    }
    const datos: unknown = await res.json();
    if (!Array.isArray(datos)) {
      console.error(`GET ${ruta} no devolvió un arreglo`);
      return { ok: false };
    }
    return { ok: true, eventos: datos as Evento[] };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de eventos:", error);
    return { ok: false };
  }
}

/**
 * Obtiene las ciudades que tienen eventos, para el filtro «Ciudad». Nunca
 * lanza: devuelve { ok: false } si la API no responde o si la respuesta no es
 * una lista de textos.
 */
export async function getCiudades(): Promise<ResultadoCiudades> {
  try {
    const res = await fetch(`${API_URL}/eventos/ciudades`, {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (!res.ok) {
      console.error(`GET /eventos/ciudades respondió ${res.status}`);
      return { ok: false };
    }
    const datos: unknown = await res.json();
    if (
      !Array.isArray(datos) ||
      !datos.every((ciudad) => typeof ciudad === "string")
    ) {
      console.error("GET /eventos/ciudades no devolvió una lista de textos");
      return { ok: false };
    }
    return { ok: true, ciudades: datos as string[] };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de eventos:", error);
    return { ok: false };
  }
}

/**
 * Obtiene un evento por id desde el backend. Nunca lanza.
 *
 * - `no-encontrado`: el id no es un entero positivo (ni se llama al backend) o
 *   el backend responde 404 o 400. No se registra: no es un fallo.
 * - `error`: el backend no responde, tarda más de 5 s, responde con otro código
 *   o con un cuerpo que no es un evento.
 *
 * Va envuelta en `cache` para que `generateMetadata` y la página, que la llaman
 * en la misma petición, no pidan dos veces el mismo evento.
 */
export const getEvento = cache(
  async (id: string): Promise<ResultadoEvento> => {
    if (!ID_VALIDO.test(id)) {
      return { ok: false, motivo: "no-encontrado" };
    }
    try {
      const res = await fetch(`${API_URL}/eventos/${id}`, {
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
      if (res.status === 404 || res.status === 400) {
        return { ok: false, motivo: "no-encontrado" };
      }
      if (!res.ok) {
        console.error(`GET /eventos/${id} respondió ${res.status}`);
        return { ok: false, motivo: "error" };
      }
      const datos: unknown = await res.json();
      if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
        console.error(`GET /eventos/${id} no devolvió un evento`);
        return { ok: false, motivo: "error" };
      }
      return { ok: true, evento: datos as Evento };
    } catch (error) {
      // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
      unstable_rethrow(error);
      console.error("No se pudo conectar con la API de eventos:", error);
      return { ok: false, motivo: "error" };
    }
  },
);
