import qrcode from "qrcode-generator";

/**
 * Módulos claros que la norma pide alrededor del código. El trazo ya los
 * cuenta: la página dibuja el QR en un lado igual al tamaño más el doble de este.
 */
export const ZONA_DE_SILENCIO = 4;

/**
 * La matriz de módulos del código QR de un texto: `matriz[fila][columna]` es
 * `true` si el módulo es oscuro. Es cuadrada. Nivel de corrección M, modo Byte
 * (la dirección lleva minúsculas, `:` y `/`) y versión automática: la menor en
 * que cabe el texto.
 *
 * Es el único archivo que importa `qrcode-generator`, y solo corre en el
 * servidor.
 */
export function matrizQr(texto: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(texto, "Byte");
  qr.make();

  const lado = qr.getModuleCount();
  return Array.from({ length: lado }, (_, fila) =>
    Array.from({ length: lado }, (_, columna) => qr.isDark(fila, columna)),
  );
}

/**
 * El trazo de un `<path>` svg con un cuadrado de 1 × 1 por cada módulo oscuro
 * (`M{x} {y}h1v1h-1z`), corrido `ZONA_DE_SILENCIO` módulos para dejar el borde
 * claro. Un solo `<path>` pesa unas tres veces menos que un `<rect>` por módulo.
 */
export function trazoQr(matriz: readonly (readonly boolean[])[]): string {
  const cuadrados: string[] = [];
  matriz.forEach((fila, y) => {
    fila.forEach((oscuro, x) => {
      if (oscuro) {
        cuadrados.push(
          `M${x + ZONA_DE_SILENCIO} ${y + ZONA_DE_SILENCIO}h1v1h-1z`,
        );
      }
    });
  });
  return cuadrados.join("");
}
