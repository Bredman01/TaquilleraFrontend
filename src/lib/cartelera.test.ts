import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarCartelera, leerFiltros } from "@/lib/cartelera";
import { API_URL, type Evento } from "@/lib/eventos";

// Ciudades de los datos de ejemplo del backend, como las responde
// GET /eventos/ciudades: sin repetir y en orden alfabético del español.
const CIUDADES = ["Bogotá", "Íquira", "Neiva", "Pitalito"];

// Evento 4 de los datos de ejemplo del backend (contrato del plan).
const cartasAMedianoche: Evento = {
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

/** Respuesta HTTP real de `fetch` con el cuerpo en JSON. */
function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Respuesta = () => Response | Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // Las funciones registran los fallos con console.error; se silencia el ruido.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/**
 * Backend simulado por ruta: cada petición recibe la respuesta de su ruta, sin
 * depender del orden en que se haga. El orden de las peticiones se comprueba
 * aparte con `urlsPedidas`. Cada llamada crea una respuesta nueva, porque el
 * cuerpo de una `Response` se lee una sola vez.
 */
function simularBackend(rutas: { ciudades: Respuesta; eventos: Respuesta }) {
  fetchMock.mockImplementation(async (entrada) => {
    const url = String(entrada);
    if (url === `${API_URL}/eventos/ciudades`) return rutas.ciudades();
    if (url === `${API_URL}/eventos` || url.startsWith(`${API_URL}/eventos?`)) {
      return rutas.eventos();
    }
    throw new Error(`Petición inesperada: ${url}`);
  });
}

/** Las direcciones que pidió `fetch`, en el orden en que las pidió. */
function urlsPedidas(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

describe("leerFiltros", () => {
  it("leerFiltros toma la categoría y la ciudad de la dirección", () => {
    // /?categoria=teatro&ciudad=Neiva
    expect(
      leerFiltros({ categoria: "teatro", ciudad: "Neiva" }, CIUDADES),
    ).toEqual({ categoria: "teatro", ciudad: "Neiva" });

    // Las cuatro categorías valen.
    for (const categoria of ["cine", "teatro", "concierto", "charla"] as const) {
      expect(
        leerFiltros({ categoria }, CIUDADES),
        `filtros para la categoría «${categoria}»`,
      ).toEqual({ categoria });
    }

    // Sin parámetros no hay filtros: «Todas» en los dos.
    expect(leerFiltros({}, CIUDADES)).toEqual({});
  });

  it("leerFiltros trata como «Todas» una categoría que no existe", () => {
    // CA-11: «magia» no es una categoría, «Teatro» no está escrito como el
    // contrato (minúsculas), una cadena vacía es «Todas» y una dirección con la
    // categoría repetida tampoco tiene una categoría.
    const noValen: Array<string | string[]> = [
      "magia",
      "Teatro",
      "",
      ["teatro", "cine"],
    ];

    for (const categoria of noValen) {
      expect(
        leerFiltros({ categoria }, CIUDADES),
        `filtros para la categoría ${JSON.stringify(categoria)}`,
      ).toEqual({});
    }

    // Una categoría que no existe no arrastra la ciudad: esa se conserva.
    expect(
      leerFiltros({ categoria: "magia", ciudad: "Neiva" }, CIUDADES),
    ).toEqual({ ciudad: "Neiva" });
  });

  it("leerFiltros reconoce la ciudad sin distinguir mayúsculas ni tildes y trata como «Todas» una que no está en la lista", () => {
    // Sin criterio (D10, P2): la ciudad de la dirección se resuelve contra la
    // lista y se usa su nombre canónico, con tildes.
    const seReconocen: Array<[string, string]> = [
      ["bogota", "Bogotá"],
      ["BOGOTÁ", "Bogotá"],
      ["NEIVA", "Neiva"],
      [" Neiva ", "Neiva"],
      ["iquira", "Íquira"],
      ["Pitalito", "Pitalito"],
    ];

    for (const [escrita, canonica] of seReconocen) {
      expect(
        leerFiltros({ ciudad: escrita }, CIUDADES),
        `filtros para la ciudad «${escrita}»`,
      ).toEqual({ ciudad: canonica });
    }

    // Una ciudad que no está en la lista, vacía o en blanco es «Todas».
    for (const ciudad of ["Medellín", "Narnia", "", "   "]) {
      expect(
        leerFiltros({ ciudad }, CIUDADES),
        `filtros para la ciudad «${ciudad}»`,
      ).toEqual({});
    }

    // Con la lista vacía ninguna ciudad vale.
    expect(leerFiltros({ ciudad: "Neiva" }, [])).toEqual({});
  });
});

describe("cargarCartelera", () => {
  it("cargarCartelera pide los eventos con los filtros de la dirección", async () => {
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([cartasAMedianoche]),
    });

    const resultado = await cargarCartelera({
      categoria: "teatro",
      ciudad: "Neiva",
    });

    // Primero las ciudades; después los eventos, ya con los filtros.
    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos?categoria=teatro&ciudad=Neiva`,
    ]);
    expect(resultado).toEqual({
      ok: true,
      eventos: [cartasAMedianoche],
      ciudades: CIUDADES,
      filtros: { categoria: "teatro", ciudad: "Neiva" },
    });
  });

  it("cargarCartelera no envía al backend una categoría que no existe", async () => {
    // CA-11: con «magia» el backend respondería 400; el frontend nunca la envía.
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([cartasAMedianoche]),
    });

    const resultado = await cargarCartelera({ categoria: "magia" });

    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos`,
    ]);
    expect(resultado).toEqual({
      ok: true,
      eventos: [cartasAMedianoche],
      ciudades: CIUDADES,
      filtros: {},
    });
  });

  it("cargarCartelera pide al backend el nombre canónico de la ciudad", async () => {
    // Sin criterio (D10): /?ciudad=bogota pide /eventos?ciudad=Bogot%C3%A1 y
    // deja «Bogotá» como la ciudad marcada.
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([]),
    });

    const resultado = await cargarCartelera({ ciudad: "bogota" });

    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos?ciudad=Bogot%C3%A1`,
    ]);
    expect(resultado).toEqual({
      ok: true,
      eventos: [],
      ciudades: CIUDADES,
      filtros: { ciudad: "Bogotá" },
    });
  });

  it("cargarCartelera no envía al backend una ciudad que no está en la lista", async () => {
    // Sin criterio (P2): una ciudad desconocida en la dirección cuenta como «Todas».
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([cartasAMedianoche]),
    });

    const resultado = await cargarCartelera({ ciudad: "Narnia" });

    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos`,
    ]);
    expect(resultado).toEqual({
      ok: true,
      eventos: [cartasAMedianoche],
      ciudades: CIUDADES,
      filtros: {},
    });
  });

  it("cargarCartelera devuelve ok false si fallan las ciudades o los eventos", async () => {
    // Sin criterio: si cualquiera de las dos peticiones falla, la cartelera
    // muestra el aviso en lugar de romperse.
    const sinRespuesta: Respuesta = () =>
      Promise.reject(new TypeError("fetch failed"));
    const conError500: Respuesta = () =>
      responder({ statusCode: 500, message: "Internal server error" }, 500);
    const ciudadesBien: Respuesta = () => responder(CIUDADES);
    const eventosBien: Respuesta = () => responder([cartasAMedianoche]);

    const casos: Array<[string, { ciudades: Respuesta; eventos: Respuesta }]> = [
      ["las ciudades responden 500", { ciudades: conError500, eventos: eventosBien }],
      ["las ciudades no responden", { ciudades: sinRespuesta, eventos: eventosBien }],
      [
        "las ciudades no son una lista de textos",
        { ciudades: () => responder({ ciudades: CIUDADES }), eventos: eventosBien },
      ],
      ["los eventos responden 500", { ciudades: ciudadesBien, eventos: conError500 }],
      ["los eventos no responden", { ciudades: ciudadesBien, eventos: sinRespuesta }],
      [
        "los eventos no son un arreglo",
        { ciudades: ciudadesBien, eventos: () => responder(cartasAMedianoche) },
      ],
    ];

    for (const [descripcion, rutas] of casos) {
      simularBackend(rutas);

      const resultado = await cargarCartelera({});

      expect(resultado, `resultado cuando ${descripcion}`).toEqual({
        ok: false,
      });
    }
  });
});
