import { unstable_rethrow } from "next/navigation";

export type Clasificacion = "TP" | "+7" | "+13" | "+16" | "+18";

/** Película tal como la responde GET /peliculas en Taquillera-Backend. */
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

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
