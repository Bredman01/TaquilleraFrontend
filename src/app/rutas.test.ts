import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Esta prueba vive en src/app, así que la carpeta de rutas es la de este mismo
// archivo: no depende del directorio desde el que se ejecute Vitest.
const carpetaDeRutas = dirname(fileURLToPath(import.meta.url));

describe("rutas de la aplicación", () => {
  it("no queda la carpeta de rutas src/app/peliculas", () => {
    // Guarda: si la carpeta de rutas se resolviera mal, «no existe» pasaría sin
    // querer. La portada sí está ahí.
    expect(existsSync(resolve(carpetaDeRutas, "page.tsx"))).toBe(true);

    // CA-13: /peliculas/1 ya no existe. Si vuelve la carpeta, Next vuelve a
    // servir esa dirección.
    expect(existsSync(resolve(carpetaDeRutas, "peliculas"))).toBe(false);
  });
});
