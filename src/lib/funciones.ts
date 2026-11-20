import { unstable_rethrow } from "next/navigation";
import { API_URL } from "@/lib/eventos";
import { diaEnColombia, formatDia } from "@/lib/formato";

/**
 * Función tal como la responde GET /eventos/:id/funciones en Taquillera-Backend.
 * `inicio` es ISO 8601 con desfase («2026-11-21T16:00:00-05:00») y `precio`
 * son pesos colombianos enteros.
 */
export interface Funcion {
  id: number;
  eventoId: number;
  inicio: string;
  precio: number;
}

export type ResultadoFunciones =
  | { ok: true; funciones: Funcion[] }
  | { ok: false };

/** Las funciones de un mismo día de Colombia, con el día ya escrito. */
export interface DiaDeFunciones {
  /** `AAAA-MM-DD`. */
  dia: string;
  /** «sábado, 21 de noviembre». */
  etiqueta: string;
  funciones: Funcion[];
}

/** Un backend que no responde en este tiempo se da por caído. */
const ESPERA_MAXIMA_MS = 5000;

/**
 * Los cuatro campos son obligatorios. Un `inicio` que `Date.parse` no entiende
 * haría lanzar a `Intl` al pintar la sección, así que se rechaza aquí.
 */
function esFuncion(dato: unknown): dato is Funcion {
  if (dato === null || typeof dato !== "object") return false;
  const { id, eventoId, inicio, precio } = dato as Record<string, unknown>;
  return (
    typeof id === "number" &&
    typeof eventoId === "number" &&
    typeof precio === "number" &&
    typeof inicio === "string" &&
    !Number.isNaN(Date.parse(inicio))
  );
}

/**
 * Obtiene las funciones de un evento, de la más próxima a la más lejana (el
 * backend las ordena). Nunca lanza: devuelve { ok: false } si la API no
 * responde, tarda más de 5 s, responde con un código que no es 2xx (también
 * 404) o con un cuerpo que no es una lista de funciones válidas. Un evento sin
 * funciones es un 200 con `[]`, no un fallo.
 *
 * No va envuelta en `cache`: solo la llama la página.
 */
export async function getFunciones(
  eventoId: number,
): Promise<ResultadoFunciones> {
  const ruta = `/eventos/${eventoId}/funciones`;

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (!res.ok) {
      console.error(`GET ${ruta} respondió ${res.status}`);
      return { ok: false };
    }
    const datos: unknown = await res.json();
    if (!Array.isArray(datos) || !datos.every(esFuncion)) {
      console.error(`GET ${ruta} no devolvió una lista de funciones`);
      return { ok: false };
    }
    return { ok: true, funciones: datos };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de eventos:", error);
    return { ok: false };
  }
}

/**
 * Agrupa las funciones por día de Colombia, en orden de inicio. Ordena por
 * instante (no por el texto de la hora, que puede venir con otro desfase) y
 * sobre una copia: la lista que recibe queda como llegó.
 */
export function agruparPorDia(funciones: Funcion[]): DiaDeFunciones[] {
  const ordenadas = funciones.toSorted(
    (a, b) => Date.parse(a.inicio) - Date.parse(b.inicio),
  );
  const dias = new Map<string, DiaDeFunciones>();

  for (const funcion of ordenadas) {
    const dia = diaEnColombia(funcion.inicio);
    const grupo = dias.get(dia);
    if (grupo) {
      grupo.funciones.push(funcion);
    } else {
      dias.set(dia, {
        dia,
        etiqueta: formatDia(funcion.inicio),
        funciones: [funcion],
      });
    }
  }

  return [...dias.values()];
}
