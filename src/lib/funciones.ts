import { unstable_rethrow } from "next/navigation";
import { API_URL, ID_VALIDO } from "@/lib/eventos";
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

/**
 * Función tal como la responde GET /funciones/:id en Taquillera-Backend: los
 * cuatro campos de `Funcion` más el título, la ciudad y el lugar de su evento.
 */
export interface FuncionConEvento extends Funcion {
  titulo: string;
  ciudad: string;
  lugar: string;
}

export type ResultadoFuncion =
  | { ok: true; funcion: FuncionConEvento }
  | { ok: false; motivo: "no-encontrado" | "error" };

export type EstadoAsiento = "disponible" | "ocupado";

/**
 * Asiento tal como lo responde GET /funciones/:id/asientos. `id` es la fila más
 * el número («A1»).
 */
export interface Asiento {
  id: string;
  fila: string;
  numero: number;
  estado: EstadoAsiento;
}

export type ResultadoAsientos =
  | { ok: true; asientos: Asiento[] }
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
 * Los siete campos son obligatorios: los cuatro de `Funcion` (con el `inicio`
 * que `Date.parse` entiende) y los tres textos del evento.
 */
function esFuncionConEvento(dato: unknown): dato is FuncionConEvento {
  if (!esFuncion(dato)) return false;
  const { titulo, ciudad, lugar } = dato as Funcion & Record<string, unknown>;
  return (
    typeof titulo === "string" &&
    typeof ciudad === "string" &&
    typeof lugar === "string"
  );
}

/**
 * Los cuatro campos son obligatorios. Con un `estado` que no sea exactamente
 * `disponible` u `ocupado`, el mapa no sabría si el asiento se puede elegir.
 */
function esAsiento(dato: unknown): dato is Asiento {
  if (dato === null || typeof dato !== "object") return false;
  const { id, fila, numero, estado } = dato as Record<string, unknown>;
  return (
    typeof id === "string" &&
    typeof fila === "string" &&
    typeof numero === "number" &&
    (estado === "disponible" || estado === "ocupado")
  );
}

/**
 * Obtiene una función por id desde el backend, con el título, la ciudad y el
 * lugar de su evento. Nunca lanza.
 *
 * - `no-encontrado`: el id no es un entero positivo (ni se llama al backend) o
 *   el backend responde 404 o 400. No se registra: no es un fallo.
 * - `error`: el backend no responde, tarda más de 5 s, responde con otro código
 *   o con un cuerpo que no es una función con sus siete campos.
 *
 * No va envuelta en `cache`: solo la llama la página.
 */
export async function getFuncion(id: string): Promise<ResultadoFuncion> {
  if (!ID_VALIDO.test(id)) {
    return { ok: false, motivo: "no-encontrado" };
  }
  const ruta = `/funciones/${id}`;

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (res.status === 404 || res.status === 400) {
      return { ok: false, motivo: "no-encontrado" };
    }
    if (!res.ok) {
      console.error(`GET ${ruta} respondió ${res.status}`);
      return { ok: false, motivo: "error" };
    }
    const datos: unknown = await res.json();
    if (!esFuncionConEvento(datos)) {
      console.error(`GET ${ruta} no devolvió una función`);
      return { ok: false, motivo: "error" };
    }
    return { ok: true, funcion: datos };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de funciones:", error);
    return { ok: false, motivo: "error" };
  }
}

/**
 * Obtiene los asientos de una función, en el orden en que los ordena el backend
 * (por fila y por número). Nunca lanza: devuelve { ok: false } si la API no
 * responde, tarda más de 5 s, responde con un código que no es 2xx (también
 * 404) o con un cuerpo que no es una lista de asientos válidos. No exige 40
 * asientos: el mapa pinta las filas que lleguen.
 *
 * No va envuelta en `cache`: solo la llama la página.
 */
export async function getAsientos(
  funcionId: number,
): Promise<ResultadoAsientos> {
  const ruta = `/funciones/${funcionId}/asientos`;

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (!res.ok) {
      console.error(`GET ${ruta} respondió ${res.status}`);
      return { ok: false };
    }
    const datos: unknown = await res.json();
    if (!Array.isArray(datos) || !datos.every(esAsiento)) {
      console.error(`GET ${ruta} no devolvió una lista de asientos`);
      return { ok: false };
    }
    return { ok: true, asientos: datos };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de funciones:", error);
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
