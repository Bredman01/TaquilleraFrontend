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

// Evento 4 de los datos de ejemplo del backend (contrato del plan).
const cartasAMedianoche = {
  id: 4,
  titulo: "Cartas a Medianoche",
  descripcion:
    "Una actriz retirada recibe cada noche una carta sin remitente.",
  categoria: "teatro",
  ciudad: "Neiva",
  lugar: "Teatro Municipal de Neiva",
  duracionMinutos: 90,
  clasificacion: "+13",
  imagenUrl: "https://placehold.co/400x600/png?text=Cartas+a+Medianoche",
};

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateMetadata de /eventos/[id]", () => {
  it("generateMetadata pone «{título} · Taquillera» como título de la pestaña", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(cartasAMedianoche), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const metadata = await generateMetadata(propsDeLaRuta("4"));

    // El separador es «·» (U+00B7), el mismo del título del layout.
    expect(metadata.title).toBe("Cartas a Medianoche · Taquillera");
  });

  it("generateMetadata no lanza cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const metadata = await generateMetadata(propsDeLaRuta("1"));

    // Sin evento no se define título: la pestaña hereda el del layout.
    expect(metadata.title).toBeUndefined();
  });

  it("generateMetadata hereda el título del layout cuando el evento no existe", async () => {
    // Con un 404 la promesa se resuelve y no se define título.
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 404,
          message: "El evento 9999 no existe",
          error: "Not Found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const metadata = await generateMetadata(propsDeLaRuta("9999"));

    // Con un id válido sí se pregunta al backend: el 404 es lo que decide.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(metadata.title).toBeUndefined();
  });

  it("generateMetadata hereda el título del layout cuando el id no es un entero positivo", async () => {
    // Un id inválido ni siquiera llega al backend y no define título.
    const metadata = await generateMetadata(propsDeLaRuta("abc"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(metadata.title).toBeUndefined();
  });
});
