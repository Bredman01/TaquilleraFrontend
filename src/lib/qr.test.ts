import { describe, expect, it } from "vitest";
import { matrizQr, trazoQr, ZONA_DE_SILENCIO } from "@/lib/qr";

// Spec 006, T6: la matriz del código QR y su trazo (D8 y D9). Estas pruebas usan
// `qrcode-generator` de verdad, sin simularlo: lo que comprueban es lo que sale
// de la librería y cómo `qr.ts` la configura (nivel M, versión automática, modo
// Byte) y la lee (fila y columna en su sitio, `true` es un módulo oscuro).
//
// Vitest no puede decodificar un QR sin otra dependencia: que el código contenga
// la dirección y se lea lo comprueba la prueba de recorrido (T13) con `jsqr`.

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

/** La dirección de una boleta desde el mismo equipo: 38 bytes. */
const DIRECCION = "http://localhost:3000/boletas/K7Q2M9XA";

/**
 * Las dos direcciones que separan la versión 3 de la 4 con el nivel M. La
 * capacidad de la norma para el nivel M en modo Byte es de 42 bytes en la versión
 * 3 (29 × 29 módulos) y de 62 en la versión 4 (33 × 33).
 */
const DIRECCION_DE_42_BYTES = "http://192.168.1.100:3000/boletas/K7Q2M9XA";
const DIRECCION_DE_43_BYTES = "http://192.168.10.100:3000/boletas/K7Q2M9XA";

/** Cuántos bytes ocupa un texto (la dirección es ASCII: un byte por carácter). */
function bytesDe(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

/** Cuántos módulos oscuros tiene una matriz. */
function modulosOscuros(matriz: readonly (readonly boolean[])[]): number {
  return matriz.flat().filter((modulo) => modulo).length;
}

/**
 * ¿Hay un patrón de posición de 7 × 7 con la esquina en (fila, columna)? El
 * anillo exterior es oscuro, el interior es claro y el centro de 3 × 3, oscuro.
 */
function hayPatronDePosicion(
  matriz: readonly (readonly boolean[])[],
  fila: number,
  columna: number,
): boolean {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const distanciaAlCentro = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      // 3: anillo exterior (oscuro). 2: anillo interior (claro). 0 y 1: centro (oscuro).
      const esperado = distanciaAlCentro !== 2;
      if (matriz[fila + r]?.[columna + c] !== esperado) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// matrizQr (D8): CA-7
// ---------------------------------------------------------------------------

describe("matrizQr", () => {
  it("matrizQr da una matriz cuadrada con los tres patrones de posición y el módulo oscuro fijo", () => {
    const matriz = matrizQr(DIRECCION);

    // Cuadrada: tantas filas como columnas, y todo son módulos claros u oscuros.
    // 38 bytes con el nivel M caben en la versión 3: 17 + 4 × 3 = 29 módulos.
    expect(bytesDe(DIRECCION)).toBe(38);
    const lado = matriz.length;
    expect(lado).toBe(29);
    for (const fila of matriz) {
      expect(fila).toHaveLength(lado);
      for (const modulo of fila) expect(typeof modulo).toBe("boolean");
    }

    // Los tres patrones de posición: arriba a la izquierda, arriba a la derecha y
    // abajo a la izquierda.
    expect(hayPatronDePosicion(matriz, 0, 0), "arriba a la izquierda").toBe(true);
    expect(hayPatronDePosicion(matriz, 0, lado - 7), "arriba a la derecha").toBe(
      true,
    );
    expect(hayPatronDePosicion(matriz, lado - 7, 0), "abajo a la izquierda").toBe(
      true,
    );
    // Y no hay un cuarto abajo a la derecha: ahí van los datos.
    expect(
      hayPatronDePosicion(matriz, lado - 7, lado - 7),
      "abajo a la derecha",
    ).toBe(false);

    // El módulo oscuro fijo del estándar: en la fila 4 × versión + 9 y la columna
    // 8. Con la fila y la columna cambiadas de lugar, no estaría ahí.
    const version = (lado - 17) / 4;
    expect(version).toBe(3);
    expect(matriz[4 * version + 9]?.[8]).toBe(true);
  });

  it("matrizQr usa el nivel M: una dirección de 42 bytes da 29 × 29 módulos y una de 43 bytes, 33 × 33", () => {
    // Si los textos no miden lo que dice el nombre, la prueba no prueba nada.
    expect(bytesDe(DIRECCION_DE_42_BYTES)).toBe(42);
    expect(bytesDe(DIRECCION_DE_43_BYTES)).toBe(43);

    // Con el nivel M, 42 bytes son el tope de la versión 3. Con el nivel L darían
    // 29 × 29 las dos; con Q o H, la de 42 bytes ya pasaría a una versión mayor.
    const de42 = matrizQr(DIRECCION_DE_42_BYTES);
    expect(de42).toHaveLength(29);
    for (const fila of de42) expect(fila).toHaveLength(29);

    const de43 = matrizQr(DIRECCION_DE_43_BYTES);
    expect(de43).toHaveLength(33);
    for (const fila of de43) expect(fila).toHaveLength(33);
  });

  it("matrizQr da la misma matriz para la misma dirección y otra para otra dirección", () => {
    const primera = matrizQr(DIRECCION);
    const segunda = matrizQr(DIRECCION);

    // La misma dirección, el mismo dibujo; pero cada llamada trae su propia matriz.
    expect(segunda).toStrictEqual(primera);
    expect(segunda).not.toBe(primera);

    // Otra boleta, con el mismo largo: el tamaño es el mismo y el dibujo, no.
    const otraBoleta = matrizQr("http://localhost:3000/boletas/K7Q2M9XB");
    expect(otraBoleta).toHaveLength(primera.length);
    expect(otraBoleta).not.toStrictEqual(primera);

    // Mayúsculas y minúsculas son otros bytes: otra dirección, otro dibujo.
    const enMinusculas = matrizQr("http://localhost:3000/boletas/k7q2m9xa");
    expect(enMinusculas).not.toStrictEqual(primera);

    // Otro origen, con otro largo: otra versión.
    const otroOrigen = matrizQr(DIRECCION_DE_43_BYTES);
    expect(otroOrigen).not.toStrictEqual(primera);
    expect(otroOrigen.length).not.toBe(primera.length);
  });
});

// ---------------------------------------------------------------------------
// trazoQr (D9): CA-7
// ---------------------------------------------------------------------------

describe("trazoQr", () => {
  it("trazoQr dibuja un cuadrado de 1 × 1 por módulo oscuro, corrido 4 módulos por la zona de silencio", () => {
    // La zona de silencio de la norma: 4 módulos claros alrededor del código.
    expect(ZONA_DE_SILENCIO).toBe(4);

    // La fila del plan: dos módulos en la diagonal.
    expect(
      trazoQr([
        [true, false],
        [false, true],
      ]),
    ).toBe("M4 4h1v1h-1zM5 5h1v1h-1z");

    // La columna es la x y la fila es la y, cada una corrida 4.
    expect(
      trazoQr([
        [false, true],
        [false, false],
      ]),
      "un módulo en la fila 0 y la columna 1",
    ).toBe("M5 4h1v1h-1z");
    expect(
      trazoQr([
        [false, false],
        [true, false],
      ]),
      "un módulo en la fila 1 y la columna 0",
    ).toBe("M4 5h1v1h-1z");
    expect(trazoQr([[true, true]]), "dos módulos en una fila").toBe(
      "M4 4h1v1h-1zM5 4h1v1h-1z",
    );
    expect(trazoQr([[true], [true]]), "dos módulos en una columna").toBe(
      "M4 4h1v1h-1zM4 5h1v1h-1z",
    );
    expect(
      trazoQr([
        [false, false, false],
        [false, false, false],
        [false, false, true],
      ]),
      "un módulo en la última fila y columna",
    ).toBe("M6 6h1v1h-1z");

    // Sin módulos oscuros no hay nada que dibujar.
    expect(trazoQr([])).toBe("");
    expect(
      trazoQr([
        [false, false],
        [false, false],
      ]),
    ).toBe("");

    // Con una matriz real: un cuadrado por cada módulo oscuro, en el sitio de ese
    // módulo. El contrato no fija el orden de los cuadrados, así que no se mira.
    const matriz = matrizQr(DIRECCION);
    const trazo = trazoQr(matriz);

    // Tantos cuadrados como módulos oscuros, y el trazo no trae nada más.
    const oscuros = modulosOscuros(matriz);
    expect(oscuros).toBeGreaterThan(0);
    expect(trazo.match(/M/g) ?? []).toHaveLength(oscuros);
    expect(trazo).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);

    // Cada cuadrado está sobre un módulo oscuro, corrido 4 módulos; y ningún
    // módulo oscuro queda sin su cuadrado.
    const dibujados = new Set<string>();
    for (const coincidencia of trazo.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
      const x = Number(coincidencia[1]) - ZONA_DE_SILENCIO;
      const y = Number(coincidencia[2]) - ZONA_DE_SILENCIO;
      expect(matriz[y]?.[x], `el módulo de la fila ${y} y la columna ${x}`).toBe(
        true,
      );
      dibujados.add(`${y},${x}`);
    }
    expect(dibujados.size).toBe(oscuros);
  });
});
