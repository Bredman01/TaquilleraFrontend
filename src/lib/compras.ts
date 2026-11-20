import { API_URL, ESPERA_MAXIMA_MS } from "@/lib/api";
import type {
  FuncionConEvento,
  ResultadoAsientos,
  ResultadoFuncion,
} from "@/lib/funciones";
import { MAXIMO_POR_COMPRA } from "@/lib/mapa";

/**
 * Compra tal como la responde POST /funciones/:id/compras en Taquillera-Backend
 * con un 201: exactamente estos cinco campos. `total` son pesos enteros y
 * `fecha` es ISO 8601 en hora de Colombia («2026-11-19T15:04:05-05:00»).
 */
export interface CompraCreada {
  codigo: string;
  funcionId: number;
  asientos: string[];
  total: number;
  fecha: string;
}

/**
 * Lo que pasó al pagar. `no-disponibles` trae los asientos que ya no se pueden
 * comprar; `error` es cualquier otro fallo y la pantalla solo avisa que se
 * puede intentar de nuevo.
 */
export type ResultadoCompra =
  | { ok: true; compra: CompraCreada }
  | { ok: false; motivo: "no-disponibles"; asientos: string[] }
  | { ok: false; motivo: "error" };

/** Qué pinta la página de compra, ya decidido a partir de lo que respondió la API. */
export type PaginaCompra =
  | {
      estado: "lista";
      funcion: FuncionConEvento;
      asientos: string[];
      total: number;
    }
  | { estado: "sin-asientos"; funcionId: number }
  | { estado: "no-encontrada" }
  | { estado: "error" };

/** El mensaje de cada campo del comprador que no pasó la validación. */
export interface ErroresComprador {
  nombre?: string;
  correo?: string;
}

const MAXIMO_NOMBRE = 100;
const MAXIMO_CORREO = 254;
/** La misma expresión que usa la API para el correo. */
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Decide qué pinta la página de compra. Mira primero la función, después los
 * asientos y solo al final la dirección (`?asientos=A1,A2`):
 *
 * - la función no existe → `no-encontrada`; no cargó (o sus asientos no
 *   cargaron) → `error`;
 * - la dirección no trae un texto, trae un elemento vacío, un asiento que no
 *   está en la lista que respondió la API, repetidos o más de
 *   `MAXIMO_POR_COMPRA` → `sin-asientos`;
 * - en otro caso → `lista`, con los asientos en el orden de esa lista (el del
 *   mapa, no el de la dirección) y el total (precio × cantidad).
 *
 * El plano no se copia aquí: vale lo que respondió la API. Un asiento que ya
 * está ocupado no cambia nada, porque la ocupación puede variar hasta el pago y
 * quien manda es la respuesta del POST. No modifica lo que recibe.
 */
export function prepararCompra(
  funcion: ResultadoFuncion,
  asientos: ResultadoAsientos | null,
  parametro: string | string[] | undefined,
): PaginaCompra {
  if (!funcion.ok) {
    return funcion.motivo === "no-encontrado"
      ? { estado: "no-encontrada" }
      : { estado: "error" };
  }
  if (asientos === null || !asientos.ok) {
    return { estado: "error" };
  }

  const sinAsientos: PaginaCompra = {
    estado: "sin-asientos",
    funcionId: funcion.funcion.id,
  };
  // Un parámetro repetido en la dirección llega como arreglo.
  if (typeof parametro !== "string") return sinAsientos;

  const pedidos = parametro.split(",");
  const elegidos = new Set(pedidos);
  const delMapa = new Set(asientos.asientos.map(({ id }) => id));
  if (
    pedidos.length > MAXIMO_POR_COMPRA ||
    elegidos.size !== pedidos.length ||
    pedidos.some((id) => id === "" || !delMapa.has(id))
  ) {
    return sinAsientos;
  }

  const ids = asientos.asientos
    .map(({ id }) => id)
    .filter((id) => elegidos.has(id));
  return {
    estado: "lista",
    funcion: funcion.funcion,
    asientos: ids,
    total: funcion.funcion.precio * ids.length,
  };
}

/**
 * Valida los datos del comprador con las mismas reglas que la API: el nombre,
 * recortado, tiene de 1 a 100 caracteres, y el correo, recortado, tiene
 * formato `algo@algo.algo` y máximo 254. Devuelve solo los campos que fallan;
 * sin errores, un objeto vacío.
 */
export function validarComprador(datos: {
  nombre: string;
  correo: string;
}): ErroresComprador {
  const errores: ErroresComprador = {};

  const nombre = datos.nombre.trim();
  if (nombre === "") {
    errores.nombre = "Escribe tu nombre completo";
  } else if (nombre.length > MAXIMO_NOMBRE) {
    errores.nombre = `El nombre admite máximo ${MAXIMO_NOMBRE} caracteres`;
  }

  const correo = datos.correo.trim();
  if (correo === "") {
    errores.correo = "Escribe tu correo electrónico";
  } else if (correo.length > MAXIMO_CORREO || !CORREO_VALIDO.test(correo)) {
    errores.correo = "Escribe un correo electrónico válido";
  }

  return errores;
}

/** Lee el cuerpo como JSON; si no lo es (o está vacío), devuelve `undefined`. */
async function leerJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function esListaDeTextos(dato: unknown): dato is string[] {
  return (
    Array.isArray(dato) && dato.every((elemento) => typeof elemento === "string")
  );
}

/**
 * Los cinco campos son obligatorios y de su tipo. Una `fecha` que `Date.parse`
 * no entiende no es una fecha, así que el 201 no valdría.
 */
function esCompraCreada(dato: unknown): dato is CompraCreada {
  if (dato === null || typeof dato !== "object") return false;
  const { codigo, funcionId, asientos, total, fecha } = dato as Record<
    string,
    unknown
  >;
  return (
    typeof codigo === "string" &&
    typeof funcionId === "number" &&
    esListaDeTextos(asientos) &&
    typeof total === "number" &&
    typeof fecha === "string" &&
    !Number.isNaN(Date.parse(fecha))
  );
}

/**
 * Los asientos no disponibles que trae el cuerpo de un 409: una lista no vacía
 * de textos en el campo `asientos`. Si el cuerpo no la trae, `undefined`.
 */
function asientosDelConflicto(cuerpo: unknown): string[] | undefined {
  if (cuerpo === null || typeof cuerpo !== "object") return undefined;
  const { asientos } = cuerpo as Record<string, unknown>;
  return esListaDeTextos(asientos) && asientos.length > 0
    ? [...asientos]
    : undefined;
}

function registrarFallo(detalle: unknown): void {
  console.error("No se pudo completar la compra con la API:", detalle);
}

/**
 * Envía la compra a la API desde el navegador: `POST /funciones/:id/compras`
 * con los asientos, el nombre y el correo (los dos últimos, recortados). Nunca
 * lanza, ni siquiera al leer el JSON.
 *
 * - 201 con una compra válida → `{ ok: true, compra }`.
 * - 409 con la lista `asientos` → `no-disponibles` con esa lista, sin registro.
 *   Si el 409 no la trae, `no-disponibles` con los asientos pedidos, y se
 *   registra: el usuario igual debe poder elegir otros.
 * - Cualquier otra cosa (400, 404, 5xx, otro código, un 201 inválido, sin
 *   respuesta o más de 5 s) → `error`, y se registra.
 */
export async function comprar(
  funcionId: number,
  pedido: { asientos: readonly string[]; nombre: string; correo: string },
): Promise<ResultadoCompra> {
  const ruta = `/funciones/${funcionId}/compras`;
  const asientos = [...pedido.asientos];

  try {
    const res = await fetch(`${API_URL}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asientos,
        nombre: pedido.nombre.trim(),
        correo: pedido.correo.trim(),
      }),
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    });

    if (res.status === 201) {
      const datos = await leerJson(res);
      if (!esCompraCreada(datos)) {
        registrarFallo(`POST ${ruta} no devolvió una compra`);
        return { ok: false, motivo: "error" };
      }
      // Se copian solo los cinco campos: ni uno de más ni el arreglo de la respuesta.
      return {
        ok: true,
        compra: {
          codigo: datos.codigo,
          funcionId: datos.funcionId,
          asientos: [...datos.asientos],
          total: datos.total,
          fecha: datos.fecha,
        },
      };
    }

    if (res.status === 409) {
      const noDisponibles = asientosDelConflicto(await leerJson(res));
      if (noDisponibles === undefined) {
        registrarFallo(`POST ${ruta} respondió 409 sin la lista de asientos`);
      }
      return {
        ok: false,
        motivo: "no-disponibles",
        asientos: noDisponibles ?? asientos,
      };
    }

    registrarFallo(`POST ${ruta} respondió ${res.status}`);
    return { ok: false, motivo: "error" };
  } catch (error) {
    registrarFallo(error);
    return { ok: false, motivo: "error" };
  }
}
