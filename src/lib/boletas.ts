import { unstable_rethrow } from "next/navigation";
import { API_URL, ESPERA_MAXIMA_MS } from "@/lib/api";

export type EstadoBoleta = "valida" | "usada";

/**
 * Boleta tal como la responde GET /boletas/:codigo en Taquillera-Backend: nueve
 * campos, todos obligatorios, y sin el correo. `inicio` y `fechaUso` son ISO 8601
 * con desfase («2026-11-22T14:45:12-05:00»). `fechaUso` es `null` mientras la
 * boleta es válida y un texto cuando ya está usada.
 */
export type Boleta = {
  codigo: string;
  titulo: string;
  inicio: string;
  lugar: string;
  ciudad: string;
  asientos: string[];
  nombre: string;
} & (
  | { estado: "valida"; fechaUso: null }
  | { estado: "usada"; fechaUso: string }
);

export type ResultadoBoleta =
  | { ok: true; boleta: Boleta }
  | { ok: false; motivo: "no-encontrada" | "error" };

/**
 * Un host, con su puerto si lo trae: un nombre o una IPv4, o una IPv6 entre
 * corchetes. No deja pasar `/`, `@`, espacios ni esquemas.
 */
const HOST_VALIDO = /^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(:\d{1,5})?$/;

/** Lo que va antes de la primera coma de una cabecera con una lista, recortado. */
function primerValor(cabecera: string | null): string | null {
  if (cabecera === null) return null;
  const coma = cabecera.indexOf(",");
  return (coma === -1 ? cabecera : cabecera.slice(0, coma)).trim();
}

/**
 * El origen de la petición («http://localhost:3000»), para armar la dirección
 * que lleva el código QR. Detrás de un proxy el `host` es el del servidor
 * interno, así que primero se miran las cabeceras `x-forwarded-*`:
 *
 * - Protocolo: el primer valor de `x-forwarded-proto` si es `http` o `https`; si
 *   no, `http`.
 * - Host: el primer valor de `x-forwarded-host` si cumple `HOST_VALIDO`; si no
 *   la cumple, `host` con la misma regla. Nunca se busca un segundo valor de la
 *   lista: quien manda la cabecera podría poner ahí lo que quisiera.
 *
 * Si ningún host es válido, devuelve `null` y la página no dibuja el QR.
 */
export function origenDeLaPeticion(
  cabeceras: Pick<Headers, "get">,
): string | null {
  const reenviado = primerValor(cabeceras.get("x-forwarded-host"));
  const directo = cabeceras.get("host");
  const host = [reenviado, directo].find(
    (candidato) => candidato !== null && HOST_VALIDO.test(candidato),
  );
  if (host === undefined || host === null) return null;

  const proto = primerValor(cabeceras.get("x-forwarded-proto"));
  const protocolo = proto === "http" || proto === "https" ? proto : "http";
  return `${protocolo}://${host}`;
}

function esListaDeTextos(dato: unknown): dato is string[] {
  return (
    Array.isArray(dato) && dato.every((elemento) => typeof elemento === "string")
  );
}

/** Un texto que `Date.parse` entiende: `Intl` lanzaría al pintar cualquier otro. */
function esFechaLegible(dato: unknown): dato is string {
  return typeof dato === "string" && !Number.isNaN(Date.parse(dato));
}

/**
 * Valida el cuerpo de un 200 y copia solo los nueve campos de la boleta: un
 * campo de más (el correo, por ejemplo) no llega a la pantalla. Si falta un
 * campo, es de otro tipo, `inicio` o `fechaUso` no son fechas legibles, o el
 * estado y la fecha de uso no van de acuerdo, devuelve `undefined`.
 */
function leerBoleta(dato: unknown): Boleta | undefined {
  if (dato === null || typeof dato !== "object") return undefined;
  const {
    codigo,
    titulo,
    inicio,
    lugar,
    ciudad,
    asientos,
    nombre,
    estado,
    fechaUso,
  } = dato as Record<string, unknown>;

  if (
    typeof codigo !== "string" ||
    typeof titulo !== "string" ||
    !esFechaLegible(inicio) ||
    typeof lugar !== "string" ||
    typeof ciudad !== "string" ||
    !esListaDeTextos(asientos) ||
    typeof nombre !== "string"
  ) {
    return undefined;
  }
  const comunes = {
    codigo,
    titulo,
    inicio,
    lugar,
    ciudad,
    asientos: [...asientos],
    nombre,
  };

  if (estado === "valida" && fechaUso === null) {
    return { ...comunes, estado, fechaUso };
  }
  if (estado === "usada" && esFechaLegible(fechaUso)) {
    return { ...comunes, estado, fechaUso };
  }
  return undefined;
}

/**
 * Obtiene una boleta por su código, tal como llega (la API acepta mayúsculas o
 * minúsculas). Nunca lanza.
 *
 * - `no-encontrada`: el backend responde 404. No se registra: no es un fallo.
 * - `error`: el backend no responde, tarda más de 5 s, responde con otro código
 *   o con un cuerpo que no es una boleta válida.
 *
 * No va envuelta en `cache`: solo la llama la página.
 */
export async function getBoleta(codigo: string): Promise<ResultadoBoleta> {
  const ruta = `/boletas/${encodeURIComponent(codigo)}`;

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });
    if (res.status === 404) {
      return { ok: false, motivo: "no-encontrada" };
    }
    if (res.status !== 200) {
      console.error(`GET ${ruta} respondió ${res.status}`);
      return { ok: false, motivo: "error" };
    }
    const boleta = leerBoleta(await res.json());
    if (boleta === undefined) {
      console.error(`GET ${ruta} no devolvió una boleta`);
      return { ok: false, motivo: "error" };
    }
    return { ok: true, boleta };
  } catch (error) {
    // Deja pasar las señales internas de Next (p. ej. el fin del prerender).
    unstable_rethrow(error);
    console.error("No se pudo conectar con la API de boletas:", error);
    return { ok: false, motivo: "error" };
  }
}
