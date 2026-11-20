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
  rutaDeBoleta,
  rutaDeConsulta,
  validarIngreso,
  type ResultadoIngreso,
} from "@/lib/ingreso";

// Spec 006, T6: la validación del ingreso (D13) y las rutas de la boleta (D14).
// `ingreso.ts` corre en el navegador: aquí no se simula nada de Next. Tampoco se
// formatea ninguna fecha ni hora, así que no se fuerza la zona del proceso.

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

/** La fecha del primer uso, como la escribe el backend (contrato del plan). */
const FECHA_USO = "2026-11-22T14:45:12-05:00";

/** Lo que responde POST /boletas/K7Q2M9XA/ingreso con 200: la boleta, ya usada. */
const BOLETA_USADA = {
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

const ERROR: ResultadoIngreso = { ok: false, motivo: "error" };

/** El cuerpo con que el backend responde 409 (contrato del plan, D5). */
function cuerpo409(extra: object = {}) {
  return {
    statusCode: 409,
    message: "La boleta K7Q2M9XA ya fue usada",
    error: "Conflict",
    ...extra,
  };
}

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

/** El mismo objeto sin uno de sus campos. */
function sinCampo(objeto: object, campo: string): unknown {
  return Object.fromEntries(
    Object.entries(objeto).filter(([clave]) => clave !== campo),
  );
}

/** El mismo objeto con otro valor en un campo. */
function conCampo(objeto: object, campo: string, valor: unknown): unknown {
  return { ...objeto, [campo]: valor };
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // D13: `validarIngreso` registra cada fallo con console.error, salvo el 409
  // con su fecha. Se silencia el ruido y el espía se guarda para comprobar cuándo
  // sí se registra y cuándo no.
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
// validarIngreso (D13): CA-3, CA-4 y CA-5
// ---------------------------------------------------------------------------

describe("validarIngreso", () => {
  it("validarIngreso envía POST /boletas/{código}/ingreso sin cuerpo y con 200 devuelve la fecha de uso", async () => {
    fetchMock.mockResolvedValueOnce(responder(BOLETA_USADA));

    const resultado = await validarIngreso("K7Q2M9XA");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = peticion();
    expect(url).toBe(`${API_URL}/boletas/K7Q2M9XA/ingreso`);
    expect(init?.method).toBe("POST");
    // Va sin cuerpo y sin cabeceras propias: así es una petición simple de CORS
    // y `main.ts` no cambia (D13). Nada de `Content-Type`.
    expect(init?.body ?? null).toBeNull();
    const cabeceras = new Headers(init?.headers);
    expect(cabeceras.get("Content-Type")).toBeNull();
    expect(Array.from(cabeceras.keys())).toStrictEqual([]);
    // Hay una señal: es la que corta la espera a los 5 s.
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // El resultado trae solo la fecha de uso de la respuesta.
    expect(resultado).toStrictEqual({ ok: true, fechaUso: FECHA_USO });
    expect(errorSpy).not.toHaveBeenCalled();

    // La fecha es la de la respuesta, con el desfase que traiga: la que
    // `Date.parse` entienda.
    for (const fechaUso of ["2026-11-22T19:45:12Z", "2026-11-23T04:45:12+09:00"]) {
      fetchMock.mockResolvedValueOnce(
        responder({ ...BOLETA_USADA, fechaUso }),
      );

      await expect(
        validarIngreso("K7Q2M9XA"),
        `con la fecha ${fechaUso}`,
      ).resolves.toStrictEqual({ ok: true, fechaUso });
    }
    expect(errorSpy).not.toHaveBeenCalled();

    // El código va tal como llega, solo codificado. Los códigos codificados están
    // escritos a mano: la prueba no usa `encodeURIComponent` para decidir qué esperar.
    const casos: Array<[string, string]> = [
      ["k7q2m9xa", "k7q2m9xa"],
      ["A B/C?#", "A%20B%2FC%3F%23"],
    ];

    for (const [codigo, esperado] of casos) {
      fetchMock.mockResolvedValueOnce(responder(BOLETA_USADA));

      await validarIngreso(codigo);

      const otra = peticion(fetchMock.mock.calls.length - 1);
      expect(otra.url, `código «${codigo}»`).toBe(
        `${API_URL}/boletas/${esperado}/ingreso`,
      );
      expect(otra.init?.method).toBe("POST");
    }
  });

  it("validarIngreso con 409 devuelve ya-usada con la fecha del primer uso, sin registrar nada", async () => {
    fetchMock.mockResolvedValueOnce(
      responder(cuerpo409({ fechaUso: FECHA_USO }), 409),
    );

    const resultado = await validarIngreso("K7Q2M9XA");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(peticion().url).toBe(`${API_URL}/boletas/K7Q2M9XA/ingreso`);
    expect(peticion().init?.method).toBe("POST");
    // La fecha es la del primer uso, la que trae el 409.
    expect(resultado).toStrictEqual({
      ok: false,
      motivo: "ya-usada",
      fechaUso: FECHA_USO,
    });
    // Un 409 con su fecha es lo esperado: no es un fallo y no se registra.
    expect(errorSpy).not.toHaveBeenCalled();

    // Con otro desfase, mientras `Date.parse` lo entienda, es la misma fecha.
    fetchMock.mockResolvedValueOnce(
      responder(cuerpo409({ fechaUso: "2026-11-22T19:45:12Z" }), 409),
    );

    await expect(validarIngreso("K7Q2M9XA")).resolves.toStrictEqual({
      ok: false,
      motivo: "ya-usada",
      fechaUso: "2026-11-22T19:45:12Z",
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("validarIngreso con un 409 sin fecha válida devuelve ya-usada sin fecha y lo registra", async () => {
    const casos: Array<[string, Response]> = [
      ["el campo fechaUso ausente", responder(cuerpo409(), 409)],
      ["una fechaUso nula", responder(cuerpo409({ fechaUso: null }), 409)],
      [
        "una fechaUso que no es un texto",
        responder(cuerpo409({ fechaUso: 20261122 }), 409),
      ],
      [
        "una fechaUso que es una lista",
        responder(cuerpo409({ fechaUso: [FECHA_USO] }), 409),
      ],
      // `Date.parse` no la entiende: `Intl` lanzaría al pintarla.
      [
        "una fechaUso que no es una fecha",
        responder(cuerpo409({ fechaUso: "mañana" }), 409),
      ],
      ["una fechaUso vacía", responder(cuerpo409({ fechaUso: "" }), 409)],
      [
        "una fechaUso con mes y hora imposibles",
        responder(cuerpo409({ fechaUso: "2026-13-45T25:61:61-05:00" }), 409),
      ],
      ["un cuerpo nulo", responder(null, 409)],
      ["un cuerpo que es un texto", responder("conflicto", 409)],
      [
        "un cuerpo que no es JSON",
        new Response("<html>Conflict</html>", { status: 409 }),
      ],
      ["un cuerpo vacío", new Response(null, { status: 409 })],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      // La boleta ya se usó, aunque no se sepa cuándo: no es un error que invite
      // a reintentar (D13).
      await expect(
        validarIngreso("K7Q2M9XA"),
        `resultado con ${descripcion}`,
      ).resolves.toStrictEqual({
        ok: false,
        motivo: "ya-usada",
        fechaUso: null,
      });
      // Pero la respuesta no era la del contrato: queda en el registro.
      expect(errorSpy, `registro con ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("validarIngreso devuelve error y lo registra con 404, 500, un 200 inválido, sin respuesta o después de 5 s, y nunca lanza", async () => {
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
      await expect(
        validarIngreso("K7Q2M9XA"),
        descripcion,
      ).resolves.toStrictEqual(ERROR);
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    // 2. El backend responde, pero con un código que no es el 200 ni el 409.
    const respuestas: Array<[string, Response]> = [
      [
        "el backend responde 404",
        responder(cuerpo404("K7Q2M9XA"), 404),
      ],
      [
        "el backend responde 404 sin cuerpo",
        new Response(null, { status: 404 }),
      ],
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
        // El código manda: el cuerpo de una boleta usada con un 500 no es una validación.
        "el backend responde 500 con el cuerpo de una boleta usada",
        responder(BOLETA_USADA, 500),
      ],
    ];

    for (const [descripcion, respuesta] of respuestas) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      await expect(
        validarIngreso("K7Q2M9XA"),
        descripcion,
      ).resolves.toStrictEqual(ERROR);
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    // 3. Un 200 que no confirma el uso: el estado no es «usada» o no trae una
    // fecha que `Date.parse` entienda.
    const invalidas: Array<[string, Response]> = [
      [
        "un 200 con una boleta que sigue válida",
        responder({ ...BOLETA_USADA, estado: "valida", fechaUso: null }),
      ],
      [
        "un 200 con estado válida aunque trae una fecha",
        responder(conCampo(BOLETA_USADA, "estado", "valida")),
      ],
      ["un 200 sin estado", responder(sinCampo(BOLETA_USADA, "estado"))],
      ["un 200 con estado nulo", responder(conCampo(BOLETA_USADA, "estado", null))],
      [
        "un 200 con estado desconocido",
        responder(conCampo(BOLETA_USADA, "estado", "anulada")),
      ],
      [
        "un 200 con estado con mayúscula",
        responder(conCampo(BOLETA_USADA, "estado", "Usada")),
      ],
      ["un 200 sin fechaUso", responder(sinCampo(BOLETA_USADA, "fechaUso"))],
      ["un 200 con fechaUso nula", responder(conCampo(BOLETA_USADA, "fechaUso", null))],
      [
        "un 200 con fechaUso que es un número",
        responder(conCampo(BOLETA_USADA, "fechaUso", 20261122)),
      ],
      [
        "un 200 con fechaUso que no es una fecha",
        responder(conCampo(BOLETA_USADA, "fechaUso", "mañana")),
      ],
      ["un 200 con fechaUso vacía", responder(conCampo(BOLETA_USADA, "fechaUso", ""))],
      [
        "un 200 con fechaUso de mes y hora imposibles",
        responder(conCampo(BOLETA_USADA, "fechaUso", "2026-13-45T25:61:61-05:00")),
      ],
      // Un cuerpo que no es una boleta.
      ["un 200 con null", responder(null)],
      ["un 200 con un texto", responder("usada")],
      ["un 200 con un número", responder(5)],
      ["un 200 con un arreglo vacío", responder([])],
      ["un 200 con un arreglo que trae una boleta", responder([BOLETA_USADA])],
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

      await expect(
        validarIngreso("K7Q2M9XA"),
        descripcion,
      ).resolves.toStrictEqual(ERROR);
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    // Una petición por validación: un fallo no se reintenta por su cuenta (un
    // segundo POST podría ser la segunda validación de la misma boleta).
    const llamadasAntes =
      caidas.length + respuestas.length + invalidas.length;
    expect(fetchMock).toHaveBeenCalledTimes(llamadasAntes);

    // 4. El backend se cuelga: la espera se corta a los 5 s.
    expect(ESPERA_MAXIMA_MS).toBe(5000);
    errorSpy.mockClear();
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = validarIngreso("K7Q2M9XA");

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledTimes(llamadasAntes + 1),
    );
    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    const ultima = peticion(llamadasAntes);
    expect(ultima.url).toBe(`${API_URL}/boletas/K7Q2M9XA/ingreso`);
    expect(ultima.init?.method).toBe("POST");
    expect(ultima.init?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toStrictEqual(ERROR);
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// rutaDeBoleta y rutaDeConsulta (D14): CA-11
// ---------------------------------------------------------------------------

describe("rutaDeBoleta y rutaDeConsulta", () => {
  it("rutaDeConsulta devuelve null con el texto vacío o solo con espacios", () => {
    const vacios: Array<[string, string]> = [
      ["el texto vacío", ""],
      ["un espacio", " "],
      ["tres espacios", "   "],
      ["tabulaciones y saltos de línea", "\t\n \r\n"],
    ];

    for (const [descripcion, texto] of vacios) {
      expect(rutaDeConsulta(texto), `con ${descripcion}`).toBeNull();
    }
  });

  it("rutaDeConsulta recorta el código y lo codifica con encodeURIComponent, sin cambiar mayúsculas ni minúsculas", () => {
    // [lo que escribe quien consulta, la ruta]. Las rutas están escritas a mano.
    const casos: Array<[string, string]> = [
      // Se recorta, y las minúsculas se quedan como están.
      ["  k7q2m9xa ", "/boletas/k7q2m9xa"],
      ["K7Q2M9XA", "/boletas/K7Q2M9XA"],
      ["k7Q2m9XA", "/boletas/k7Q2m9XA"],
      // También se recortan las tabulaciones y los saltos de línea.
      ["\tK7Q2M9XA\n", "/boletas/K7Q2M9XA"],
      // Lo de adentro se codifica, y solo se recorta lo de los lados.
      [" A B/C ", "/boletas/A%20B%2FC"],
      ["A?B#C", "/boletas/A%3FB%23C"],
    ];

    for (const [texto, esperada] of casos) {
      expect(rutaDeConsulta(texto), `con «${texto}»`).toBe(esperada);
    }
  });

  it("rutaDeBoleta codifica el código con encodeURIComponent", () => {
    const casos: Array<[string, string]> = [
      ["K7Q2M9XA", "/boletas/K7Q2M9XA"],
      ["k7q2m9xa", "/boletas/k7q2m9xa"],
      ["A B/C?#", "/boletas/A%20B%2FC%3F%23"],
      ["%41", "/boletas/%2541"],
      ["ñandú", "/boletas/%C3%B1and%C3%BA"],
    ];

    for (const [codigo, esperada] of casos) {
      expect(rutaDeBoleta(codigo), `con «${codigo}»`).toBe(esperada);
    }
  });
});
