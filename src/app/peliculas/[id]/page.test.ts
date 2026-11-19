import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./page";

// Los mismos argumentos que Next le pasa a la ruta. `PageProps` exige también
// `searchParams`; se tipa con la firma real de generateMetadata para que
// `next build` compile estas pruebas sin copiar el tipo.
type Props = Parameters<typeof generateMetadata>[0];

function propsDeLaRuta(id: string): Props {
  return {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  };
}

// Película 3 de los datos de ejemplo del backend (contrato del plan).
const risasEnFamilia = {
  id: 3,
  titulo: "Risas en Familia",
  sinopsis:
    "Tres generaciones comparten una casa durante las vacaciones y nada sale como lo planearon.",
  duracionMinutos: 95,
  clasificacion: "TP",
  genero: "Comedia",
  imagenUrl: "https://placehold.co/400x600/png?text=Risas+en+Familia",
};

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateMetadata de /peliculas/[id]", () => {
  it("generateMetadata pone «{título} · Taquillera» como título de la pestaña", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(risasEnFamilia), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const metadata = await generateMetadata(propsDeLaRuta("3"));

    // El separador es «·» (U+00B7), el mismo del título del layout.
    expect(metadata.title).toBe("Risas en Familia · Taquillera");
  });

  it("generateMetadata no lanza cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const metadata = await generateMetadata(propsDeLaRuta("1"));

    // Sin película no se define título: la pestaña hereda el del layout (P3).
    expect(metadata.title).toBeUndefined();
  });
});
