import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { API_URL, ESPERA_MAXIMA_MS } from "@/lib/api";
import {
  getBoleta,
  origenDeLaPeticion,
  type Boleta,
  type ResultadoBoleta,
} from "@/lib/boletas";

// Spec 006, T6: la lectura de la boleta en el servidor (D11) y el origen de la
// dirección que lleva el QR (D10). Aquí no se formatea ninguna fecha ni hora, así
// que no se fuerza la zona del proceso.

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

/** La fecha en que se usó la boleta, como la escribe el backend (contrato del plan). */
const FECHA_USO = "2026-11-22T14:45:12-05:00";

/** Los nueve campos de la boleta, todos obligatorios (contrato del plan, D6). */
const NUEVE_CAMPOS = [
  "codigo",
  "titulo",
  "inicio",
  "lugar",
  "ciudad",
  "asientos",
  "nombre",
  "estado",
  "fechaUso",
];

/** Lo que responde GET /boletas/K7Q2M9XA con la boleta válida. */
const BOLETA_VALIDA: Boleta = {
  codigo: "K7Q2M9XA",
  titulo: "El Último Faro",
  inicio: "2026-11-22T15:00:00-05:00",
  lugar: "Cine Club La Gaitana",
  ciudad: "Neiva",
  asientos: ["D1", "D2"],
  nombre: "Ana Pérez",
  estado: "valida",
  fechaUso: null,
};

/** La misma boleta, ya usada: la fecha de uso es un texto. */
const BOLETA_USADA: Boleta = {
  codigo: "K7Q2M9XA",
  titulo: "El Último Faro",
  inicio: "2026-11-22T15:00:00-05:00",
  lugar: "Cine Club La Gaitana",
  ciudad: "Neiva",
  asientos: ["D1", "D2"],
  nombre: "Ana Pérez",
  estado: "usada",
  fechaUso: FECHA_USO,
};

const ERROR: ResultadoBoleta = { ok: false, motivo: "error" };

/** El cuerpo con que el backend responde 404 (contrato del plan). */
function cuerpo404(codigo: string) {
  return {
    statusCode: 404,
    message: `La boleta ${codigo} no existe`,
    error: "Not Found",
  };
}

/** Respuesta HTTP real de `fetch` con el cuerpo en JSON. */
function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** El mismo objeto sin uno de sus campos: para probar que ninguno es opcional. */
function sinCampo(objeto: object, campo: string): unknown {
  return Object.fromEntries(
    Object.entries(objeto).filter(([clave]) => clave !== campo),
  );
}

/** El mismo objeto con otro valor en un campo. */
function conCampo(objeto: object, campo: string, valor: unknown): unknown {
  return { ...objeto, [campo]: valor };
}

/** La boleta de un resultado correcto; si no lo es, la prueba falla con el motivo. */
function boletaDe(resultado: ResultadoBoleta): Boleta {
  if (!resultado.ok) {
    throw new Error(`se esperaba una boleta y llegó «${resultado.motivo}»`);
  }
  return resultado.boleta;
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // D11: `getBoleta` registra cada fallo con console.error, salvo el 404. Se
  // silencia el ruido y el espía se guarda para comprobar cuándo sí se registra
  // y cuándo no.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

/** La dirección y las opciones con que se llamó a `fetch` (la llamada `indice`). */
function peticion(indice = 0) {
  const llamada = fetchMock.mock.calls[indice];
  return { url: llamada?.[0], init: llamada?.[1] };
}

/**
 * Backend colgado: la promesa de `fetch` no se resuelve nunca y solo se rechaza
 * cuando se aborta la señal que recibió, como hace el `fetch` real. La prueba no
 * espera 5 s: sustituye `AbortSignal.timeout` por una señal que ella controla.
 */
function simularBackendColgado() {
  const corte = new AbortController();
  const timeoutSpy = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(corte.signal);
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise<Response>((_resolver, rechazar) => {
        const senal = init?.signal;
        if (senal) {
          senal.addEventListener("abort", () => rechazar(senal.reason));
        }
      }),
  );
  return { corte, timeoutSpy };
}

/** Vencen los 5 s: la señal se aborta con un TimeoutError, como la real. */
function vencenLosCincoSegundos(corte: AbortController) {
  corte.abort(new DOMException("The operation timed out.", "TimeoutError"));
}

// ---------------------------------------------------------------------------
// getBoleta (D11): CA-1 y CA-2
// ---------------------------------------------------------------------------

describe("getBoleta", () => {
  it("getBoleta pide GET /boletas/{código} y devuelve la boleta con sus nueve campos, válida o usada", async () => {
    fetchMock.mockResolvedValueOnce(responder(BOLETA_VALIDA));

    const valida = await getBoleta("K7Q2M9XA");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = peticion();
    expect(url).toBe(`${API_URL}/boletas/K7Q2M9XA`);
    // Es una lectura: el método es GET (el de `fetch` por omisión o escrito) y no
    // lleva cuerpo.
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.body ?? null).toBeNull();
    // Hay una señal: es la que corta la espera a los 5 s.
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // La boleta válida: los nueve campos, con `fechaUso` en null.
    expect(valida).toStrictEqual({ ok: true, boleta: BOLETA_VALIDA });
    expect(Object.keys(boletaDe(valida)).sort()).toStrictEqual(
      [...NUEVE_CAMPOS].sort(),
    );
    expect(errorSpy).not.toHaveBeenCalled();

    // La boleta usada trae la fecha de uso tal como la responde el backend.
    fetchMock.mockResolvedValueOnce(responder(BOLETA_USADA));

    const usada = await getBoleta("K7Q2M9XA");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usada).toStrictEqual({ ok: true, boleta: BOLETA_USADA });
    expect(boletaDe(usada).estado).toBe("usada");
    expect(boletaDe(usada).fechaUso).toBe(FECHA_USO);
    expect(Object.keys(boletaDe(usada)).sort()).toStrictEqual(
      [...NUEVE_CAMPOS].sort(),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getBoleta con 404 devuelve no-encontrada sin registrar nada", async () => {
    const casos: Array<[string, Response]> = [
      ["el cuerpo del contrato", responder(cuerpo404("ZZZZ9999"), 404)],
      // El código del estado decide: no hace falta que el cuerpo se pueda leer.
      ["un cuerpo vacío", new Response(null, { status: 404 })],
    ];

    for (const [descripcion, respuesta] of casos) {
      fetchMock.mockResolvedValueOnce(respuesta);

      await expect(
        getBoleta("ZZZZ9999"),
        `con ${descripcion}`,
      ).resolves.toStrictEqual({ ok: false, motivo: "no-encontrada" });
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
        `${API_URL}/boletas/ZZZZ9999`,
      );
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
    // Una boleta que no existe no es un fallo: el verificador-ui bloquea
    // cualquier línea de registro del frontend que diga «error».
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getBoleta devuelve error y lo registra si el backend no responde, tarda más de 5 s, responde 500 o una boleta inválida, y nunca lanza", async () => {
    // 1. El backend no responde: `fetch` rechaza, o lanza, por distintas causas.
    const caidas: Array<[string, () => void]> = [
      [
        "fetch rechaza con un TypeError",
        () => fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")),
      ],
      [
        "fetch rechaza con un TimeoutError",
        () =>
          fetchMock.mockRejectedValueOnce(
            new DOMException("The operation timed out.", "TimeoutError"),
          ),
      ],
      [
        "fetch rechaza con un AbortError",
        () =>
          fetchMock.mockRejectedValueOnce(
            new DOMException("The operation was aborted.", "AbortError"),
          ),
      ],
      [
        "fetch rechaza con un texto",
        () => fetchMock.mockRejectedValueOnce("sin conexión"),
      ],
      [
        "fetch lanza sin devolver una promesa",
        () =>
          fetchMock.mockImplementationOnce(() => {
            throw new TypeError("Failed to parse URL");
          }),
      ],
    ];

    for (const [descripcion, preparar] of caidas) {
      errorSpy.mockClear();
      preparar();

      // `resolves`: la promesa se resuelve. Nunca se rechaza.
      await expect(getBoleta("K7Q2M9XA"), descripcion).resolves.toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    // 2. El backend responde, pero con un código que no es el 200 (ni el 404).
    const respuestas: Array<[string, Response]> = [
      [
        "el backend responde 500",
        responder(
          {
            statusCode: 500,
            message: "Internal server error",
            error: "Internal Server Error",
          },
          500,
        ),
      ],
      [
        "el backend responde 502 con una página HTML",
        new Response("<html>Bad gateway</html>", { status: 502 }),
      ],
      [
        "el backend responde 503",
        responder({ statusCode: 503, message: "Service unavailable" }, 503),
      ],
      [
        "el backend responde 403",
        responder({ statusCode: 403, message: "Forbidden" }, 403),
      ],
      [
        // La API no tiene un 400 en esta ruta: es un código inesperado, no «no existe».
        "el backend responde 400",
        responder(
          {
            statusCode: 400,
            message: "Bad Request",
            error: "Bad Request",
          },
          400,
        ),
      ],
      [
        // El código manda: el cuerpo de una boleta con un 500 no es una boleta.
        "el backend responde 500 con el cuerpo de una boleta",
        responder(BOLETA_VALIDA, 500),
      ],
    ];

    for (const [descripcion, respuesta] of respuestas) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      await expect(getBoleta("K7Q2M9XA"), descripcion).resolves.toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    // 3. Un 200 con un cuerpo que no es una boleta de nueve campos.
    const invalidas: Array<[string, Response]> = [
      // Los nueve campos son obligatorios: ninguno es opcional.
      ...NUEVE_CAMPOS.map((campo): [string, Response] => [
        `un 200 sin ${campo}`,
        responder(sinCampo(BOLETA_VALIDA, campo)),
      ]),
      // Un tipo equivocado en cada campo de texto.
      ["un codigo que es un número", responder(conCampo(BOLETA_VALIDA, "codigo", 12345678))],
      ["un codigo nulo", responder(conCampo(BOLETA_VALIDA, "codigo", null))],
      ["un titulo que es un número", responder(conCampo(BOLETA_VALIDA, "titulo", 5))],
      ["un inicio que es un número", responder(conCampo(BOLETA_VALIDA, "inicio", 20261122))],
      ["un inicio nulo", responder(conCampo(BOLETA_VALIDA, "inicio", null))],
      ["un lugar que es un número", responder(conCampo(BOLETA_VALIDA, "lugar", 7))],
      ["una ciudad nula", responder(conCampo(BOLETA_VALIDA, "ciudad", null))],
      ["un nombre que es un número", responder(conCampo(BOLETA_VALIDA, "nombre", 9))],
      // Los asientos son una lista de textos.
      [
        "unos asientos que son un texto",
        responder(conCampo(BOLETA_VALIDA, "asientos", "D1,D2")),
      ],
      [
        "unos asientos con números en lugar de textos",
        responder(conCampo(BOLETA_VALIDA, "asientos", [1, 2])),
      ],
      [
        "unos asientos con un null",
        responder(conCampo(BOLETA_VALIDA, "asientos", ["D1", null])),
      ],
      [
        "unos asientos que son una lista de listas",
        responder(conCampo(BOLETA_VALIDA, "asientos", [["D1"]])),
      ],
      [
        "unos asientos que son un objeto en lugar de una lista",
        responder(conCampo(BOLETA_VALIDA, "asientos", { 0: "D1" })),
      ],
      ["unos asientos nulos", responder(conCampo(BOLETA_VALIDA, "asientos", null))],
      // El estado es exactamente «valida» o «usada», en minúsculas.
      ["un estado desconocido", responder(conCampo(BOLETA_VALIDA, "estado", "anulada"))],
      ["un estado con mayúscula", responder(conCampo(BOLETA_VALIDA, "estado", "Valida"))],
      ["un estado nulo", responder(conCampo(BOLETA_VALIDA, "estado", null))],
      ["un estado que es un número", responder(conCampo(BOLETA_VALIDA, "estado", 1))],
      // El estado y la fecha de uso tienen que ir de acuerdo.
      [
        "una boleta usada con la fecha de uso en null",
        responder(conCampo(BOLETA_USADA, "fechaUso", null)),
      ],
      [
        "una boleta usada con la fecha de uso que es un número",
        responder(conCampo(BOLETA_USADA, "fechaUso", 20261122)),
      ],
      [
        "una boleta válida con una fecha de uso",
        responder(conCampo(BOLETA_VALIDA, "fechaUso", FECHA_USO)),
      ],
      // Un cuerpo que no es una boleta.
      ["un 200 con null", responder(null)],
      ["un 200 con un texto", responder("boleta")],
      ["un 200 con un número", responder(5)],
      ["un 200 con true", responder(true)],
      ["un 200 con un arreglo vacío", responder([])],
      ["un 200 con un arreglo que trae una boleta", responder([BOLETA_VALIDA])],
      ["un 200 con un objeto vacío", responder({})],
      [
        "un 200 que no es JSON",
        new Response("<html>OK</html>", { status: 200 }),
      ],
      ["un 200 sin cuerpo", new Response(null, { status: 200 })],
    ];

    for (const [descripcion, respuesta] of invalidas) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      await expect(getBoleta("K7Q2M9XA"), descripcion).resolves.toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    // Una petición por lectura: un fallo no se reintenta por su cuenta.
    const llamadasAntes =
      caidas.length + respuestas.length + invalidas.length;
    expect(fetchMock).toHaveBeenCalledTimes(llamadasAntes);

    // 4. El backend se cuelga: la espera se corta a los 5 s.
    expect(ESPERA_MAXIMA_MS).toBe(5000);
    errorSpy.mockClear();
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getBoleta("K7Q2M9XA");

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledTimes(llamadasAntes + 1),
    );
    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    const ultima = peticion(llamadasAntes);
    expect(ultima.url).toBe(`${API_URL}/boletas/K7Q2M9XA`);
    expect(ultima.init?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toStrictEqual(ERROR);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("getBoleta devuelve error y lo registra si inicio o fechaUso no son fechas que Date.parse entienda", async () => {
    // CA-1, aclara D11. `formatDia` y `formatHora` lanzarían con una fecha que
    // `Date.parse` no entiende y tumbarían la página: se rechaza aquí, en la
    // lectura, como hacen `getFuncion` con `inicio` y `comprar` con `fecha`.
    // [descripción, campo, boleta de la que parte, texto ilegible]. La boleta
    // solo falla en esa fecha: lo demás es válido.
    const ilegibles: Array<[string, "inicio" | "fechaUso", Boleta, string]> = [
      ["un inicio vacío", "inicio", BOLETA_VALIDA, ""],
      [
        "un inicio que no es una fecha",
        "inicio",
        BOLETA_VALIDA,
        "no es una fecha",
      ],
      [
        "un inicio con el formato ISO pero con el mes 13, el día 45 y la hora 25",
        "inicio",
        BOLETA_VALIDA,
        "2026-13-45T25:00:00-05:00",
      ],
      [
        "una boleta usada con una fecha de uso que no es una fecha",
        "fechaUso",
        BOLETA_USADA,
        "no es una fecha",
      ],
      [
        // Con el formato ISO, pero fuera de rango: `Date.parse` da NaN.
        "una boleta usada con una fecha de uso con el mes 13, el día 45 y la hora 25",
        "fechaUso",
        BOLETA_USADA,
        "2026-13-45T25:61:61-05:00",
      ],
    ];

    for (const [descripcion, campo, base, texto] of ilegibles) {
      // La premisa de la prueba: ese texto es de los que `Date.parse` no entiende.
      expect(Date.parse(texto), `Date.parse(«${texto}»)`).toBeNaN();
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(responder(conCampo(base, campo, texto)));

      // `resolves`: la promesa se resuelve con el error. Nunca se rechaza.
      await expect(getBoleta("K7Q2M9XA"), descripcion).resolves.toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(ilegibles.length);

    // El caso contrario: con fechas ISO con -05:00 que `Date.parse` sí entiende
    // la boleta pasa tal como llega, válida o usada. Así no sirve una
    // implementación que rechace todas las boletas.
    const inicioOtroDia = "2026-12-05T19:30:00-05:00";
    const usoOtroDia = "2026-12-05T19:02:41-05:00";
    expect(Date.parse(inicioOtroDia)).not.toBeNaN();
    expect(Date.parse(usoOtroDia)).not.toBeNaN();
    const validaOtroDia: Boleta = {
      codigo: "K7Q2M9XA",
      titulo: "El Último Faro",
      inicio: inicioOtroDia,
      lugar: "Cine Club La Gaitana",
      ciudad: "Neiva",
      asientos: ["D1", "D2"],
      nombre: "Ana Pérez",
      estado: "valida",
      fechaUso: null,
    };
    const usadaOtroDia: Boleta = {
      codigo: "K7Q2M9XA",
      titulo: "El Último Faro",
      inicio: inicioOtroDia,
      lugar: "Cine Club La Gaitana",
      ciudad: "Neiva",
      asientos: ["D1", "D2"],
      nombre: "Ana Pérez",
      estado: "usada",
      fechaUso: usoOtroDia,
    };
    errorSpy.mockClear();

    fetchMock.mockResolvedValueOnce(responder(validaOtroDia));
    await expect(getBoleta("K7Q2M9XA")).resolves.toStrictEqual({
      ok: true,
      boleta: validaOtroDia,
    });

    fetchMock.mockResolvedValueOnce(responder(usadaOtroDia));
    await expect(getBoleta("K7Q2M9XA")).resolves.toStrictEqual({
      ok: true,
      boleta: usadaOtroDia,
    });

    expect(fetchMock).toHaveBeenCalledTimes(ilegibles.length + 2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getBoleta envía el código tal como llega, codificado: en minúsculas y con caracteres especiales", async () => {
    // [lo que llega, lo que va en la dirección]. Los códigos codificados están
    // escritos a mano: la prueba no usa `encodeURIComponent` para decidir qué esperar.
    const casos: Array<[string, string]> = [
      // CA-2: la API acepta mayúsculas o minúsculas, así que el frontend no las cambia.
      ["k7q2m9xa", "k7q2m9xa"],
      ["K7q2M9xA", "K7q2M9xA"],
      ["K7Q2M9XA", "K7Q2M9XA"],
      // Un código que viene de la dirección puede traer cualquier carácter.
      ["A B/C?#", "A%20B%2FC%3F%23"],
      ["%41", "%2541"],
      ["ñandú", "%C3%B1and%C3%BA"],
    ];

    for (const [codigo, esperado] of casos) {
      fetchMock.mockResolvedValueOnce(responder(BOLETA_VALIDA));

      const resultado = await getBoleta(codigo);

      expect(fetchMock.mock.calls.at(-1)?.[0], `código «${codigo}»`).toBe(
        `${API_URL}/boletas/${esperado}`,
      );
      // La boleta es la de la respuesta: el frontend no reescribe su código.
      expect(boletaDe(resultado).codigo).toBe("K7Q2M9XA");
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getBoleta copia solo los nueve campos: un correo de más no llega a la boleta", async () => {
    // D11: aunque el backend se equivocara y respondiera el correo, no puede
    // llegar a la pantalla.
    const conDeMas = {
      ...BOLETA_VALIDA,
      correo: "ana@correo.co",
      funcionId: 1,
      total: 30000,
    };
    fetchMock.mockResolvedValueOnce(responder(conDeMas));

    const valida = await getBoleta("K7Q2M9XA");

    // `toStrictEqual` falla si la boleta trae una clave de más.
    expect(valida).toStrictEqual({ ok: true, boleta: BOLETA_VALIDA });
    expect(Object.keys(boletaDe(valida)).sort()).toStrictEqual(
      [...NUEVE_CAMPOS].sort(),
    );
    expect(JSON.stringify(valida)).not.toContain("ana@correo.co");

    // Lo mismo con la boleta usada.
    fetchMock.mockResolvedValueOnce(
      responder({ ...BOLETA_USADA, correo: "ana@correo.co", total: 30000 }),
    );

    const usada = await getBoleta("K7Q2M9XA");

    expect(usada).toStrictEqual({ ok: true, boleta: BOLETA_USADA });
    expect(Object.keys(boletaDe(usada)).sort()).toStrictEqual(
      [...NUEVE_CAMPOS].sort(),
    );
    expect(JSON.stringify(usada)).not.toContain("ana@correo.co");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// origenDeLaPeticion (D10): CA-7
// ---------------------------------------------------------------------------

describe("origenDeLaPeticion", () => {
  it("origenDeLaPeticion arma el origen con x-forwarded-proto y x-forwarded-host, o con host si no vienen", () => {
    const casos: Array<[string, Record<string, string>, string]> = [
      [
        "x-forwarded-proto http y x-forwarded-host localhost:3000",
        { "x-forwarded-proto": "http", "x-forwarded-host": "localhost:3000" },
        "http://localhost:3000",
      ],
      [
        // Detrás de un proxy las cabeceras traen una lista: vale el primer valor.
        "listas con varios valores: el primero de cada una",
        {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": "taquillera.example, otro.example",
        },
        "https://taquillera.example",
      ],
      [
        "https con un puerto",
        {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "taquillera.example:8443",
        },
        "https://taquillera.example:8443",
      ],
      [
        // Con la dirección de la red local, para abrir la boleta desde un celular.
        "solo host con una IPv4 y un puerto",
        { host: "192.168.1.10:3000" },
        "http://192.168.1.10:3000",
      ],
      [
        "solo host con una IPv6 entre corchetes y un puerto",
        { host: "[::1]:3000" },
        "http://[::1]:3000",
      ],
      ["solo host sin puerto", { host: "localhost" }, "http://localhost"],
      [
        "solo host con una IPv6 entre corchetes y sin puerto",
        { host: "[::1]" },
        "http://[::1]",
      ],
      [
        // Detrás de un proxy, `host` es el del servidor interno: gana x-forwarded-host.
        "x-forwarded-host gana a host",
        { "x-forwarded-host": "taquillera.example", host: "localhost:3000" },
        "http://taquillera.example",
      ],
      [
        // El protocolo y el host se leen por separado.
        "x-forwarded-proto con el host de host",
        { "x-forwarded-proto": "https", host: "taquillera.example" },
        "https://taquillera.example",
      ],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });

  it("origenDeLaPeticion descarta un host o un protocolo con formato inválido y devuelve null si no queda ninguno", () => {
    // 1. Un x-forwarded-host que no es un host: se usa `host`.
    const hostsInvalidos: Array<[string, string]> = [
      ["una ruta", "evil.example/ruta"],
      ["una arroba", "usuario@evil.example"],
      ["un espacio", "evil example"],
      ["un puerto que no es un número", "evil.example:abc"],
      ["un puerto de seis dígitos", "evil.example:123456"],
      ["dos puntos sin puerto", "evil.example:"],
      ["un esquema", "http://evil.example"],
      ["un esquema javascript", "javascript:alert(1)"],
      ["un texto vacío", ""],
    ];

    for (const [descripcion, reenviado] of hostsInvalidos) {
      expect(
        origenDeLaPeticion(
          new Headers({
            "x-forwarded-host": reenviado,
            host: "localhost:3000",
          }),
        ),
        `x-forwarded-host con ${descripcion}`,
      ).toBe("http://localhost:3000");
    }

    // 2. Un x-forwarded-proto que no es http ni https: el protocolo es http.
    const protocolosInvalidos: Array<[string, string]> = [
      ["javascript", "javascript"],
      ["ftp", "ftp"],
      ["un esquema completo", "https://evil.example"],
      ["un texto vacío", ""],
      // Vale solo el primer valor de la lista.
      ["javascript como primer valor de una lista", "javascript, https"],
    ];

    for (const [descripcion, protocolo] of protocolosInvalidos) {
      expect(
        origenDeLaPeticion(
          new Headers({
            "x-forwarded-proto": protocolo,
            "x-forwarded-host": "localhost:3000",
          }),
        ),
        `x-forwarded-proto con ${descripcion}`,
      ).toBe("http://localhost:3000");
    }

    // 3. Ninguna cabecera da un host válido: no hay origen y la página no dibuja
    // el QR.
    const sinHostValido: Array<[string, Record<string, string>]> = [
      ["ninguna cabecera", {}],
      ["solo x-forwarded-proto", { "x-forwarded-proto": "https" }],
      ["un host con una ruta", { host: "evil.example/ruta" }],
      ["un host con un esquema", { host: "http://localhost:3000" }],
      ["un host con un espacio", { host: "evil example" }],
      ["un host con una arroba", { host: "usuario@evil.example" }],
      ["un host con un puerto de seis dígitos", { host: "localhost:123456" }],
      ["un host vacío", { host: "" }],
      [
        "los dos hosts inválidos",
        { "x-forwarded-host": "evil.example/ruta", host: "evil example" },
      ],
      [
        "x-forwarded-host inválido y sin host",
        { "x-forwarded-host": "usuario@evil.example" },
      ],
    ];

    for (const [descripcion, cabeceras] of sinHostValido) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBeNull();
    }
  });

  it("origenDeLaPeticion usa solo el primer valor de x-forwarded-host: si ese no cumple, pasa a host y no a un segundo valor", () => {
    // CA-7, aclara D10. Solo cuenta lo que está antes de la primera coma, sin los
    // espacios de alrededor. Si ese primer valor no es un host válido, la regla es
    // la de siempre: se pasa a `host`. No se busca un segundo valor en la lista,
    // porque quien manda la cabecera podría poner ahí lo que quisiera.
    const casos: Array<[string, Record<string, string>, string | null]> = [
      [
        // El primero no cumple (lleva una ruta): gana `host`, no «otro.example».
        "el primer valor con una ruta y un segundo valor válido, con host",
        { "x-forwarded-host": "a/b, otro.example", host: "localhost:3000" },
        "http://localhost:3000",
      ],
      [
        // Los espacios alrededor del primer valor no cuentan.
        "el primer valor con espacios alrededor y un segundo valor",
        { "x-forwarded-host": " taquillera.example , otro.example" },
        "http://taquillera.example",
      ],
      [
        // El primero no cumple (lleva un espacio dentro) y no hay `host`: no hay
        // origen, aunque el segundo valor sea válido.
        "el primer valor con un espacio dentro, un segundo valor válido y sin host",
        { "x-forwarded-host": "a b, otro.example" },
        null,
      ],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });

  // -------------------------------------------------------------------------
  // El tope del nombre del host (CA-7, D10; M2 de la revisión)
  // -------------------------------------------------------------------------
  //
  // El nombre del host, sin contar el puerto, admite como máximo 253 caracteres,
  // que es el máximo de un nombre de dominio: con 254 no es válido. Vale igual
  // para `x-forwarded-host` y para `host`. Sin ese tope, un host de unos 2300
  // caracteres hace que `qr.make()` lance «code length overflow» al dibujar el QR
  // y la página da error.
  //
  // Los nombres se arman con etiquetas de 63 caracteres separadas por puntos:
  // tres etiquetas de 63 y una última de 61 suman 253 con los puntos; con una
  // última de 62, suman 254.

  /** Tres etiquetas de 63 caracteres y una última de `ultima`, unidas con puntos. */
  function nombreDeHost(letra: string, ultima: number): string {
    const etiqueta = letra.repeat(63);
    return [etiqueta, etiqueta, etiqueta, letra.repeat(ultima)].join(".");
  }

  const HOST_253 = nombreDeHost("a", 61);
  const HOST_254 = nombreDeHost("a", 62);
  const OTRO_HOST_253 = nombreDeHost("c", 61);
  const OTRO_HOST_254 = nombreDeHost("d", 62);

  it("origenDeLaPeticion admite un nombre de host de hasta 253 caracteres y descarta uno de 254, en x-forwarded-host y en host", () => {
    expect(HOST_253).toHaveLength(253);
    expect(HOST_254).toHaveLength(254);

    const casos: Array<[string, Record<string, string>, string | null]> = [
      [
        "x-forwarded-host de 253 caracteres",
        { "x-forwarded-host": HOST_253 },
        `http://${HOST_253}`,
      ],
      [
        // Sin otro host al que pasar: el de 254 no sirve y no hay origen.
        "x-forwarded-host de 254 caracteres y sin host",
        { "x-forwarded-host": HOST_254 },
        null,
      ],
      [
        // Los espacios de alrededor no cuentan para el largo: el primer valor se
        // recorta antes de medirlo.
        "x-forwarded-host de 253 caracteres con un espacio antes de la coma de la lista",
        { "x-forwarded-host": `${HOST_253} , otro.example` },
        `http://${HOST_253}`,
      ],
      ["host de 253 caracteres", { host: HOST_253 }, `http://${HOST_253}`],
      ["host de 254 caracteres", { host: HOST_254 }, null],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });

  it("origenDeLaPeticion no cuenta el puerto en el tope: 253 caracteres con un puerto son válidos y 254 con un puerto no, en x-forwarded-host y en host", () => {
    expect(HOST_253).toHaveLength(253);
    expect(HOST_254).toHaveLength(254);

    const casos: Array<[string, Record<string, string>, string | null]> = [
      [
        "x-forwarded-host de 253 caracteres con :3000",
        { "x-forwarded-host": `${HOST_253}:3000` },
        `http://${HOST_253}:3000`,
      ],
      [
        // 253 + «:65535» son 259 caracteres en total: solo el nombre está topado.
        "x-forwarded-host de 253 caracteres con :65535",
        { "x-forwarded-host": `${HOST_253}:65535` },
        `http://${HOST_253}:65535`,
      ],
      [
        "x-forwarded-host de 254 caracteres con :3000",
        { "x-forwarded-host": `${HOST_254}:3000` },
        null,
      ],
      [
        "host de 253 caracteres con :3000",
        { host: `${HOST_253}:3000` },
        `http://${HOST_253}:3000`,
      ],
      [
        "host de 253 caracteres con :65535",
        { host: `${HOST_253}:65535` },
        `http://${HOST_253}:65535`,
      ],
      ["host de 254 caracteres con :3000", { host: `${HOST_254}:3000` }, null],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });

  it("origenDeLaPeticion descarta un host entre corchetes de 300 caracteres y sigue admitiendo una IPv6 normal", () => {
    // 300 caracteres hexadecimales entre corchetes: pasaría la expresión de
    // siempre, pero ninguna IPv6 es tan larga y haría fallar el QR.
    const hexadecimal = "ab12".repeat(75);
    expect(hexadecimal).toHaveLength(300);

    const casos: Array<[string, Record<string, string>, string | null]> = [
      [
        "host con 300 caracteres hexadecimales entre corchetes",
        { host: `[${hexadecimal}]` },
        null,
      ],
      [
        "host con 300 caracteres hexadecimales entre corchetes y :3000",
        { host: `[${hexadecimal}]:3000` },
        null,
      ],
      [
        "x-forwarded-host con 300 caracteres hexadecimales entre corchetes y sin host",
        { "x-forwarded-host": `[${hexadecimal}]` },
        null,
      ],
      [
        "x-forwarded-host con 300 caracteres hexadecimales entre corchetes y un host válido",
        { "x-forwarded-host": `[${hexadecimal}]`, host: "localhost:3000" },
        "http://localhost:3000",
      ],
      // Las IPv6 de verdad, con su puerto, siguen valiendo.
      ["host [::1]:3000", { host: "[::1]:3000" }, "http://[::1]:3000"],
      [
        "host [2001:db8::1]:3000",
        { host: "[2001:db8::1]:3000" },
        "http://[2001:db8::1]:3000",
      ],
      [
        "x-forwarded-host [2001:db8::1]:3000 con otro host",
        { "x-forwarded-host": "[2001:db8::1]:3000", host: "localhost:3000" },
        "http://[2001:db8::1]:3000",
      ],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });

  it("origenDeLaPeticion pasa a host si el x-forwarded-host es demasiado largo, y devuelve null si los dos lo son", () => {
    expect(HOST_253).toHaveLength(253);
    expect(HOST_254).toHaveLength(254);
    expect(OTRO_HOST_253).toHaveLength(253);
    expect(OTRO_HOST_254).toHaveLength(254);

    const casos: Array<[string, Record<string, string>, string | null]> = [
      [
        "x-forwarded-host de 254 caracteres y host válido",
        { "x-forwarded-host": HOST_254, host: "localhost:3000" },
        "http://localhost:3000",
      ],
      [
        "x-forwarded-host de 254 caracteres y host de 253",
        { "x-forwarded-host": HOST_254, host: OTRO_HOST_253 },
        `http://${OTRO_HOST_253}`,
      ],
      [
        // El protocolo se lee aparte: no se pierde al pasar a `host`.
        "x-forwarded-host de 254 caracteres, x-forwarded-proto https y host válido",
        {
          "x-forwarded-proto": "https",
          "x-forwarded-host": HOST_254,
          host: "localhost:3000",
        },
        "https://localhost:3000",
      ],
      [
        "x-forwarded-host y host de 254 caracteres",
        { "x-forwarded-host": HOST_254, host: OTRO_HOST_254 },
        null,
      ],
      [
        // D10: solo cuenta el primer valor. Si no sirve, se pasa a `host`; el
        // segundo valor, aunque sea válido, no se toma.
        "x-forwarded-host de 254 caracteres seguido de otro valor válido, con host",
        {
          "x-forwarded-host": `${HOST_254}, otro.example`,
          host: "localhost:3000",
        },
        "http://localhost:3000",
      ],
      [
        "x-forwarded-host de 254 caracteres seguido de otro valor válido, sin host",
        { "x-forwarded-host": `${HOST_254}, otro.example` },
        null,
      ],
      [
        // Si el primero sirve, el `host` de 254 no se mira.
        "x-forwarded-host de 253 caracteres y host de 254",
        { "x-forwarded-host": HOST_253, host: OTRO_HOST_254 },
        `http://${HOST_253}`,
      ],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });

  it("origenDeLaPeticion conserva el protocolo de x-forwarded-proto con un x-forwarded-host de 253 caracteres", () => {
    // Protección de lo que ya funciona: el tope no toca el protocolo.
    expect(HOST_253).toHaveLength(253);

    const casos: Array<[string, Record<string, string>, string | null]> = [
      [
        "x-forwarded-proto https",
        { "x-forwarded-proto": "https", "x-forwarded-host": HOST_253 },
        `https://${HOST_253}`,
      ],
      [
        "x-forwarded-proto https y un puerto",
        {
          "x-forwarded-proto": "https",
          "x-forwarded-host": `${HOST_253}:8443`,
        },
        `https://${HOST_253}:8443`,
      ],
      [
        "listas con varios valores: el primero de cada una",
        {
          "x-forwarded-proto": "https, http",
          "x-forwarded-host": `${HOST_253}, otro.example`,
        },
        `https://${HOST_253}`,
      ],
    ];

    for (const [descripcion, cabeceras, esperado] of casos) {
      expect(
        origenDeLaPeticion(new Headers(cabeceras)),
        `origen con ${descripcion}`,
      ).toBe(esperado);
    }
  });
});
