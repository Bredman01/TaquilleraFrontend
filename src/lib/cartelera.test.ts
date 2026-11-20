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

// Regla de la fecha (D6 y D12), la misma que aplica el backend: exactamente
// AAAA-MM-DD, con el mes de 01 a 12 y el día de 01 al último del mes, con los
// bisiestos del calendario gregoriano y sin recortar espacios.
const FECHAS_VALIDAS = [
  "2026-11-21",
  "2026-11-22",
  "2026-01-31",
  "2026-02-28",
  "2026-04-30",
  "2026-12-31",
  "2000-02-29", // divisible por 400: bisiesto
  "2028-02-29", // divisible por 4 y no por 100: bisiesto
  // Solo febrero cambia en un año bisiesto: los demás meses conservan sus 30 o 31 días.
  "2028-01-31", // enero de un bisiesto: 31 días
  "2028-04-30", // abril de un bisiesto: 30 días
  "2000-12-31", // diciembre de un bisiesto divisible por 400: 31 días
];

const FECHAS_NO_VALIDAS = [
  "21-11-2026", // día-mes-año
  "2026-1-5", // sin ceros
  "2026-02-30", // febrero no tiene 30 días
  "2026-02-29", // 2026 no es bisiesto
  "1900-02-29", // divisible por 100 y no por 400: no es bisiesto
  "2100-02-29", // ídem
  "2026-13-01", // mes 13
  "2026-00-10", // mes 0
  "2026-11-00", // día 0
  "2026-04-31", // abril tiene 30 días
  "2026-11-31", // noviembre tiene 30 días
  " 2026-11-21", // espacio al principio
  "2026-11-21 ", // espacio al final
  "2026-11-21T00:00", // con hora
  "mañana",
];

/** Lo que la dirección puede traer en `fecha` y la cartelera trata como «Todas». */
const FECHAS_QUE_SON_TODAS: Array<string | string[] | undefined> = [
  ...FECHAS_NO_VALIDAS,
  "", // lo que envía el formulario con el campo vacío
  ["2026-11-21", "2026-11-22"], // /?fecha=…&fecha=… llega como arreglo
  ["2026-11-21", "2026-11-21"],
  undefined,
];

describe("leerFiltros", () => {
  it("leerFiltros toma la fecha de la dirección", () => {
    // CA-11: /?fecha=2026-11-21, sola.
    expect(leerFiltros({ fecha: "2026-11-21" }, CIUDADES)).toStrictEqual({
      fecha: "2026-11-21",
    });

    // /?categoria=teatro&ciudad=Neiva&fecha=2026-11-22, combinada.
    expect(
      leerFiltros(
        { categoria: "teatro", ciudad: "Neiva", fecha: "2026-11-22" },
        CIUDADES,
      ),
    ).toStrictEqual({
      categoria: "teatro",
      ciudad: "Neiva",
      fecha: "2026-11-22",
    });

    // Lo que envía el formulario con los dos desplegables en «Todas».
    expect(
      leerFiltros({ categoria: "", ciudad: "", fecha: "2026-11-21" }, CIUDADES),
    ).toStrictEqual({ fecha: "2026-11-21" });

    // La fecha no depende de los otros filtros: vale aunque ellos no valgan.
    expect(
      leerFiltros(
        { categoria: "magia", ciudad: "Narnia", fecha: "2026-11-21" },
        CIUDADES,
      ),
    ).toStrictEqual({ fecha: "2026-11-21" });

    // Cualquier día que existe vale, con los bisiestos incluidos.
    for (const fecha of FECHAS_VALIDAS) {
      expect(
        leerFiltros({ fecha }, CIUDADES),
        `filtros para la fecha «${fecha}»`,
      ).toStrictEqual({ fecha });
    }
  });

  it("leerFiltros trata como «Todas» una fecha que no es válida, vacía o repetida", () => {
    // Sin criterio (D12): el backend respondería 400 a una fecha inválida o
    // repetida, así que la dirección no la lleva al backend: queda en «Todas» y
    // el resultado no trae la clave `fecha`.
    for (const fecha of FECHAS_QUE_SON_TODAS) {
      expect(
        leerFiltros({ fecha }, CIUDADES),
        `filtros para la fecha ${JSON.stringify(fecha)}`,
      ).toStrictEqual({});
    }

    // Una fecha que no vale no arrastra los otros filtros: esos se conservan.
    for (const fecha of ["2026-02-30", "", ["2026-11-21", "2026-11-22"]]) {
      expect(
        leerFiltros({ categoria: "teatro", ciudad: "Neiva", fecha }, CIUDADES),
        `filtros para la fecha ${JSON.stringify(fecha)} junto a categoría y ciudad`,
      ).toStrictEqual({ categoria: "teatro", ciudad: "Neiva" });
    }
  });

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

  it("leerFiltros trata como «Todas» una ciudad repetida", () => {
    // Sin criterio (decisión del desarrollador, igual que la categoría repetida):
    // /?ciudad=Neiva&ciudad=Bogotá llega como arreglo, y el backend respondería
    // 400 («Cada filtro admite un solo valor»), así que no hay ciudad. Aunque
    // todos los valores sean válidos, o el mismo repetido, la dirección no
    // elige una ciudad: no se queda con el primero ni con el último.
    const repetidas: string[][] = [
      ["Neiva", "Bogotá"],
      ["Neiva", "Neiva"],
    ];

    for (const ciudad of repetidas) {
      expect(
        leerFiltros({ ciudad }, CIUDADES),
        `filtros para la ciudad ${JSON.stringify(ciudad)}`,
      ).toEqual({});
    }

    // Una ciudad repetida no arrastra la categoría: esa se conserva.
    expect(
      leerFiltros(
        { categoria: "teatro", ciudad: ["Neiva", "Bogotá"] },
        CIUDADES,
      ),
    ).toEqual({ categoria: "teatro" });
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

  it("cargarCartelera pide los eventos del día con los demás filtros", async () => {
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([cartasAMedianoche]),
    });

    // CA-11: /?categoria=teatro&ciudad=Neiva&fecha=2026-11-22.
    const combinada = await cargarCartelera({
      categoria: "teatro",
      ciudad: "Neiva",
      fecha: "2026-11-22",
    });

    // Primero las ciudades; después los eventos, con la fecha al final.
    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos?categoria=teatro&ciudad=Neiva&fecha=2026-11-22`,
    ]);
    expect(combinada).toEqual({
      ok: true,
      eventos: [cartasAMedianoche],
      ciudades: CIUDADES,
      filtros: { categoria: "teatro", ciudad: "Neiva", fecha: "2026-11-22" },
    });

    // /?fecha=2026-11-21: con solo la fecha, es lo único que se pide.
    fetchMock.mockClear();
    const sola = await cargarCartelera({ fecha: "2026-11-21" });

    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos?fecha=2026-11-21`,
    ]);
    expect(sola).toEqual({
      ok: true,
      eventos: [cartasAMedianoche],
      ciudades: CIUDADES,
      filtros: { fecha: "2026-11-21" },
    });
  });

  it("cargarCartelera no envía al backend una fecha que no es válida", async () => {
    // Sin criterio (D12): con una fecha inválida, vacía o repetida el backend
    // respondería 400 y la cartelera mostraría el aviso de error. El frontend
    // pide solo `/eventos` y deja la fecha en «Todas».
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([cartasAMedianoche]),
    });

    for (const fecha of FECHAS_QUE_SON_TODAS) {
      fetchMock.mockClear();

      const resultado = await cargarCartelera({ fecha });

      expect(
        urlsPedidas(),
        `peticiones para la fecha ${JSON.stringify(fecha)}`,
      ).toEqual([`${API_URL}/eventos/ciudades`, `${API_URL}/eventos`]);
      expect(
        resultado,
        `resultado para la fecha ${JSON.stringify(fecha)}`,
      ).toStrictEqual({
        ok: true,
        eventos: [cartasAMedianoche],
        ciudades: CIUDADES,
        filtros: {},
      });
    }

    // Los otros filtros válidos que llegan con ella sí se envían.
    fetchMock.mockClear();
    const conOtros = await cargarCartelera({
      categoria: "teatro",
      ciudad: "Neiva",
      fecha: "2026-02-30",
    });

    expect(urlsPedidas()).toEqual([
      `${API_URL}/eventos/ciudades`,
      `${API_URL}/eventos?categoria=teatro&ciudad=Neiva`,
    ]);
    expect(conOtros).toStrictEqual({
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

  it("cargarCartelera no envía al backend una ciudad repetida", async () => {
    // Sin criterio (decisión del desarrollador): con /?ciudad=Neiva&ciudad=Bogotá
    // el backend respondería 400; el frontend nunca envía un arreglo ni un valor
    // de un filtro repetido, y la cartelera queda en «Todas».
    simularBackend({
      ciudades: () => responder(CIUDADES),
      eventos: () => responder([cartasAMedianoche]),
    });

    const resultado = await cargarCartelera({ ciudad: ["Neiva", "Bogotá"] });

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
