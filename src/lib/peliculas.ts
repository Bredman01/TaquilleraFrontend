import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

export type Clasificacion = "TP" | "+7" | "+13" | "+16" | "+18";

/**
 * Película tal como la responden GET /peliculas y GET /peliculas/:id en
 * Taquillera-Backend.
 */
export interface Pelicula {
  id: number;
  titulo: string;
  sinopsis: string;
  duracionMinutos: number;
  clasificacion: Clasificacion;
  genero: string;
  imagenUrl: string;
}

export type ResultadoPeliculas =
  | { ok: true; peliculas: Pelicula[] }
  | { ok: false };

export type ResultadoPelicula =
  | { ok: true; pelicula: Pelicula }
  | { ok: false; motivo: "no-encontrada" | "error" };

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Entero positivo sin ceros a la izquierda: "1" y "42" sí; "0", "01", "1.5", "-1" y "abc" no. */
const ID_VALIDO = /^[1-9]\d*$/;

/**
 * Obtiene la cartelera desde el backend. Nunca lanza: si la API no responde
 * o la respuesta no es válida devuelve { ok: false } para que la página
 * muestre un mensaje en lugar de romperse.
 */
export async function getPeliculas(): Promise<ResultadoPeliculas> {
  try {
    const res = await fetch(`${API_URL}/peliculas`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`GET /peliculas respondió ${res.status}`);
      return { ok: false };
    }
    const datos: unknown = await res.json();
    if (!Array.isArray(datos)) {
      console.error("GET /peliculas no devolvió un arreglo");
      return { ok: false };
    }
    return { ok: true, peliculas: datos as Pelicula[] };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de películas:", error);
    return { ok: false };
  }
}

/**
 * Obtiene una película por id desde el backend. Nunca lanza.
 *
 * - `no-encontrada`: el id no es un entero positivo (ni se llama al backend) o
 *   el backend responde 404 o 400. No se registra: no es un fallo.
 * - `error`: el backend no responde, tarda más de 5 s, responde con otro código
 *   o con un cuerpo que no es una película.
 *
 * Va envuelta en `cache` para que `generateMetadata` y la página, que la llaman
 * en la misma petición, no pidan dos veces la misma película.
 */
export const getPelicula = cache(
  async (id: string): Promise<ResultadoPelicula> => {
    if (!ID_VALIDO.test(id)) {
      return { ok: false, motivo: "no-encontrada" };
    }
    try {
      const res = await fetch(`${API_URL}/peliculas/${id}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 404 || res.status === 400) {
        return { ok: false, motivo: "no-encontrada" };
      }
      if (!res.ok) {
        console.error(`GET /peliculas/${id} respondió ${res.status}`);
        return { ok: false, motivo: "error" };
      }
      const datos: unknown = await res.json();
      if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
        console.error(`GET /peliculas/${id} no devolvió una película`);
        return { ok: false, motivo: "error" };
      }
      return { ok: true, pelicula: datos as Pelicula };
    } catch (error) {
      // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
      unstable_rethrow(error);
      console.error("No se pudo conectar con la API de películas:", error);
      return { ok: false, motivo: "error" };
    }
  },
);
