import type { Asiento } from "@/lib/funciones";

/** Cuántas boletas se pueden comprar en una sola compra. */
export const MAXIMO_POR_COMPRA = 6;

/** Los asientos de una fila, ordenados por número. */
export interface FilaDeAsientos {
  fila: string;
  asientos: Asiento[];
}

/**
 * Lo que pasa al pulsar un asiento: la selección nueva, en el orden del mapa, o
 * el motivo por el que el asiento no se puede elegir.
 */
export type CambioDeSeleccion =
  | { ok: true; seleccion: string[] }
  | { ok: false; motivo: "ocupado" | "maximo" };

function comparar(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * Agrupa los asientos por fila, con las filas en orden alfabético y los asientos
 * de cada una por número (como número: el 10 va después del 2). No modifica la
 * lista que recibe.
 */
export function agruparPorFila(asientos: readonly Asiento[]): FilaDeAsientos[] {
  const filas = new Map<string, Asiento[]>();
  for (const asiento of asientos) {
    const deLaFila = filas.get(asiento.fila);
    if (deLaFila) {
      deLaFila.push(asiento);
    } else {
      filas.set(asiento.fila, [asiento]);
    }
  }

  return [...filas]
    .toSorted(([a], [b]) => comparar(a, b))
    .map(([fila, deLaFila]) => ({
      fila,
      asientos: deLaFila.toSorted((a, b) => a.numero - b.numero),
    }));
}

/**
 * Elige o quita un asiento. Un asiento ocupado no se puede elegir; uno ya
 * elegido se quita; uno nuevo se agrega solo si no se llegó a
 * `MAXIMO_POR_COMPRA`. La selección nueva queda en el orden del mapa (fila y
 * número) sin importar el orden de los clics, y la que se recibe no cambia.
 */
export function alternarAsiento(
  asientos: readonly Asiento[],
  seleccion: readonly string[],
  asiento: Asiento,
): CambioDeSeleccion {
  if (asiento.estado === "ocupado") {
    return { ok: false, motivo: "ocupado" };
  }

  const yaElegido = seleccion.includes(asiento.id);
  if (!yaElegido && seleccion.length >= MAXIMO_POR_COMPRA) {
    return { ok: false, motivo: "maximo" };
  }

  const elegidos = new Set(seleccion);
  if (yaElegido) {
    elegidos.delete(asiento.id);
  } else {
    elegidos.add(asiento.id);
  }

  const ordenDelMapa = agruparPorFila(asientos).flatMap(({ asientos: deLaFila }) =>
    deLaFila.map(({ id }) => id),
  );
  return { ok: true, seleccion: ordenDelMapa.filter((id) => elegidos.has(id)) };
}

/**
 * La dirección de la compra: `/funciones/5/compra?asientos=A1,A2`. Cada id sale
 * codificado, y la coma que los separa no (por eso no se usa `URLSearchParams`,
 * que la escribiría como `%2C`).
 */
export function rutaDeCompra(
  funcionId: number,
  seleccion: readonly string[],
): string {
  const asientos = seleccion.map((id) => encodeURIComponent(id)).join(",");
  return `/funciones/${funcionId}/compra?asientos=${asientos}`;
}
