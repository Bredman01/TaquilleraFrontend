import { API_URL, ESPERA_MAXIMA_MS } from "@/lib/api";

export type ResultadoIngreso =
  | { ok: true; fechaUso: string }
  | { ok: false; motivo: "ya-usada"; fechaUso: string | null }
  | { ok: false; motivo: "error" };

/** La ruta de la página de una boleta; el código se codifica para la dirección. */
export function rutaDeBoleta(codigo: string): string {
  return `/boletas/${encodeURIComponent(codigo)}`;
}

/**
 * La ruta a la que lleva el formulario «Consultar boleta»: el texto recortado,
 * sin cambiar mayúsculas ni minúsculas (la API acepta las dos). Con el campo
 * vacío o solo con espacios devuelve `null`: no hay a dónde ir.
 */
export function rutaDeConsulta(texto: string): string | null {
  const codigo = texto.trim();
  return codigo === "" ? null : rutaDeBoleta(codigo);
}

/** Lee el cuerpo como JSON; si no lo es (o está vacío), devuelve `undefined`. */
async function leerJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

/** Los campos de un cuerpo que es un objeto; de cualquier otro, ninguno. */
function camposDe(cuerpo: unknown): Record<string, unknown> {
  return cuerpo !== null && typeof cuerpo === "object"
    ? (cuerpo as Record<string, unknown>)
    : {};
}

/**
 * La fecha de uso si es un texto que `Date.parse` entiende; si no,
 * `undefined`. `Intl` lanzaría al pintar cualquier otro texto.
 */
function fechaLegible(dato: unknown): string | undefined {
  return typeof dato === "string" && !Number.isNaN(Date.parse(dato))
    ? dato
    : undefined;
}

function registrarFallo(detalle: unknown): void {
  console.error("No se pudo validar el ingreso con la API:", detalle);
}

/**
 * Valida el ingreso desde el navegador: `POST /boletas/:codigo/ingreso`, sin
 * cuerpo y sin cabeceras propias (así es una petición simple de CORS). Nunca
 * lanza, ni siquiera al leer el JSON.
 *
 * - 200 con `estado: "usada"` y una fecha de uso válida → `{ ok: true, fechaUso }`.
 * - 409 con una fecha de uso válida → `ya-usada` con la fecha del primer uso, sin
 *   registro. Si el 409 no la trae (o no es legible), `ya-usada` con `null`, y se
 *   registra: la boleta ya se usó, aunque no se sepa cuándo.
 * - Cualquier otra cosa (404, 5xx, otro código, un 200 inválido, sin respuesta o
 *   más de 5 s) → `error`, y se registra. No se reintenta: un segundo POST podría
 *   ser la segunda validación de la misma boleta.
 */
export async function validarIngreso(
  codigo: string,
): Promise<ResultadoIngreso> {
  const ruta = `${rutaDeBoleta(codigo)}/ingreso`;

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      method: "POST",
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });

    if (res.status === 200) {
      const campos = camposDe(await leerJson(res));
      const fechaUso = fechaLegible(campos.fechaUso);
      if (campos.estado === "usada" && fechaUso !== undefined) {
        return { ok: true, fechaUso };
      }
      registrarFallo(`POST ${ruta} no devolvió una boleta usada`);
      return { ok: false, motivo: "error" };
    }

    if (res.status === 409) {
      const fechaUso = fechaLegible(camposDe(await leerJson(res)).fechaUso);
      if (fechaUso === undefined) {
        registrarFallo(`POST ${ruta} respondió 409 sin la fecha de uso`);
        return { ok: false, motivo: "ya-usada", fechaUso: null };
      }
      return { ok: false, motivo: "ya-usada", fechaUso };
    }

    registrarFallo(`POST ${ruta} respondió ${res.status}`);
    return { ok: false, motivo: "error" };
  } catch (error) {
    registrarFallo(error);
    return { ok: false, motivo: "error" };
  }
}
