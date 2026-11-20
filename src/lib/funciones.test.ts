import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { API_URL } from "@/lib/eventos";
import {
  agruparPorDia,
  getFunciones,
  type DiaDeFunciones,
  type Funcion,
} from "@/lib/funciones";

// D5: las horas se agrupan por día de Colombia sin importar la zona de quien
// ejecuta. Estas pruebas corren con la zona del proceso en Tokio (14 h por
// delante), para que un error de hora local no pase en una máquina que está en
// Colombia.
//
// La zona se asigna con `vi.hoisted`, que Vitest ejecuta antes de evaluar los
// `import`. No puede ir en `beforeAll`: `funciones.ts` importa `formato.ts`, que
// crea sus formateadores al cargarse, y uno sin `timeZone` toma entonces la
// zona del proceso. Asignada después, esa zona sería la de la máquina y quitar
// `timeZone` no haría fallar nada en Colombia.
const zonaOriginal = vi.hoisted(() => {
  const original = process.env.TZ;
  process.env.TZ = "Asia/Tokyo";
  return original;
});

afterAll(() => {
  if (zonaOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = zonaOriginal;
});

// Funciones del evento 4 (Cartas a Medianoche) de los datos de ejemplo del
// backend, en el orden en que las responde la API: de la más próxima a la más
// lejana (contrato del plan, CA-1).
const funcion5: Funcion = {
  id: 5,
  eventoId: 4,
  inicio: "2026-11-21T16:00:00-05:00",
  precio: 25000,
};
const funcion4: Funcion = {
  id: 4,
  eventoId: 4,
  inicio: "2026-11-21T23:30:00-05:00",
  precio: 25000,
};
const funcion3: Funcion = {
  id: 3,
  eventoId: 4,
  inicio: "2026-11-22T19:30:00-05:00",
  precio: 25000,
};
const funcionesDelEvento4 = [funcion5, funcion4, funcion3];

// Funciones del evento 6 (Bambucos al Atardecer).
const funcion8: Funcion = {
  id: 8,
  eventoId: 6,
  inicio: "2026-11-21T17:30:00-05:00",
  precio: 40000,
};
const funcion7: Funcion = {
  id: 7,
  eventoId: 6,
  inicio: "2026-11-22T17:30:00-05:00",
  precio: 40000,
};

/** Respuesta HTTP real de `fetch` con el cuerpo en JSON. */
function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // D9: `getFunciones` registra cada fallo con console.error. Se silencia el
  // ruido y el espía se guarda para comprobar cuándo sí se registra y cuándo no.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

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

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 21 en Colombia y las 12:30 del 22 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-22T03:30:00Z").getHours()).toBe(12);
  });
});

describe("getFunciones", () => {
  it("getFunciones pide las funciones del evento al backend y las devuelve", async () => {
    fetchMock.mockResolvedValueOnce(responder(funcionesDelEvento4));

    const resultado = await getFunciones(4);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/eventos/4/funciones`);
    // La lista llega tal como la ordena el backend: la más próxima primero.
    expect(resultado).toEqual({ ok: true, funciones: funcionesDelEvento4 });
    expect(errorSpy).not.toHaveBeenCalled();

    // El id de la dirección es el del evento que se pide, no uno fijo.
    fetchMock.mockResolvedValueOnce(responder([funcion8, funcion7]));

    const otro = await getFunciones(6);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_URL}/eventos/6/funciones`);
    expect(otro).toEqual({ ok: true, funciones: [funcion8, funcion7] });
  });

  it("getFunciones devuelve una lista vacía cuando el evento no tiene funciones", async () => {
    // Un evento sin funciones no es un fallo: es un 200 con [].
    fetchMock.mockResolvedValueOnce(responder([]));

    const resultado = await getFunciones(10);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_URL}/eventos/10/funciones`,
    );
    expect(resultado).toEqual({ ok: true, funciones: [] });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getFunciones devuelve ok false sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getFunciones(4)).resolves.toEqual({ ok: false });
    // D9: el fallo queda en el registro del servidor.
    expect(errorSpy).toHaveBeenCalled();
  });

  it("getFunciones devuelve ok false cuando el backend responde con error", async () => {
    const casos: Array<[string, Response]> = [
      [
        "el backend responde 500",
        responder({ statusCode: 500, message: "Internal server error" }, 500),
      ],
      [
        // Solo ocurre si el evento desaparece entre las dos peticiones.
        "el backend responde 404",
        responder(
          {
            statusCode: 404,
            message: "El evento 9999 no existe",
            error: "Not Found",
          },
          404,
        ),
      ],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getFunciones(4);

      expect(resultado, `resultado cuando ${descripcion}`).toEqual({
        ok: false,
      });
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getFunciones devuelve ok false cuando la respuesta no es una lista de funciones", async () => {
    const casos: Array<[string, Response]> = [
      ["un 200 con null", responder(null)],
      ["un 200 con un texto", responder("funciones")],
      [
        "un 200 con un objeto en lugar de una lista",
        responder({ funciones: funcionesDelEvento4 }),
      ],
      [
        "un 200 que no es JSON",
        new Response("<html>Bad gateway</html>", { status: 200 }),
      ],
      ["un 200 con una lista que trae un null", responder([funcion5, null])],
      [
        "un elemento sin id",
        responder([{ eventoId: 4, inicio: funcion5.inicio, precio: 25000 }]),
      ],
      [
        "un elemento sin eventoId",
        responder([{ id: 5, inicio: funcion5.inicio, precio: 25000 }]),
      ],
      [
        "un elemento sin inicio",
        responder([{ id: 5, eventoId: 4, precio: 25000 }]),
      ],
      [
        "un elemento sin precio",
        responder([{ id: 5, eventoId: 4, inicio: funcion5.inicio }]),
      ],
      ["un id que es texto", responder([{ ...funcion5, id: "5" }])],
      ["un eventoId que es texto", responder([{ ...funcion5, eventoId: "4" }])],
      ["un precio que es texto", responder([{ ...funcion5, precio: "15000" }])],
      ["un precio nulo", responder([{ ...funcion5, precio: null }])],
      [
        // `Date.parse` no la entiende: `Intl` lanzaría al pintarla (D9).
        "un inicio que no es una fecha",
        responder([{ ...funcion5, inicio: "mañana" }]),
      ],
      ["un inicio nulo", responder([{ ...funcion5, inicio: null }])],
      [
        // Una función mala invalida la lista entera, no solo ese elemento.
        "una función válida seguida de otra con el precio en texto",
        responder([funcion5, { ...funcion4, precio: "25000" }]),
      ],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getFunciones(4);

      expect(resultado, `resultado cuando hay ${descripcion}`).toEqual({
        ok: false,
      });
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getFunciones corta la espera del backend a los 5 s", async () => {
    // Un backend colgado no puede dejar la sección cargando para siempre.
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getFunciones(4);

    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("agruparPorDia", () => {
  // El evento 4 con las funciones desordenadas, y la de las 11:30 p. m. escrita
  // con Z: es el mismo instante que `funcion4`, pero en UTC ya es el día 22.
  const funcion4Utc: Funcion = { ...funcion4, inicio: "2026-11-22T04:30:00Z" };

  it("agruparPorDia agrupa las funciones por día de Colombia y en orden de inicio", () => {
    const desordenadas = [funcion3, funcion4Utc, funcion5];

    const dias = agruparPorDia(desordenadas);

    const esperado: DiaDeFunciones[] = [
      {
        dia: "2026-11-21",
        etiqueta: "sábado, 21 de noviembre",
        funciones: [funcion5, funcion4Utc],
      },
      {
        dia: "2026-11-22",
        etiqueta: "domingo, 22 de noviembre",
        funciones: [funcion3],
      },
    ];
    expect(dias).toEqual(esperado);

    // Sin funciones no hay días.
    expect(agruparPorDia([])).toEqual([]);
  });

  it("agruparPorDia ordena por instante y no por el texto de la hora", () => {
    // El texto de `tardeConZ` («…-22T00:30Z») es posterior al de `noche`
    // («…-21T20:00-05:00»), pero el instante es anterior: 19:30 en Colombia
    // contra 20:00. Un orden alfabético las pondría al revés.
    const noche: Funcion = {
      id: 6,
      eventoId: 5,
      inicio: "2026-11-21T20:00:00-05:00",
      precio: 30000,
    };
    const tardeConZ: Funcion = {
      id: 12,
      eventoId: 5,
      inicio: "2026-11-22T00:30:00Z",
      precio: 30000,
    };
    // Las 10:30 del sábado en Colombia, escritas con el desfase de Tokio.
    const mananaConOtroDesfase: Funcion = {
      id: 13,
      eventoId: 5,
      inicio: "2026-11-22T00:30:00+09:00",
      precio: 30000,
    };

    const dias = agruparPorDia([noche, mananaConOtroDesfase, tardeConZ]);

    expect(dias).toHaveLength(1);
    expect(dias[0]?.dia).toBe("2026-11-21");
    expect(dias[0]?.funciones.map((funcion) => funcion.id)).toEqual([
      13, 12, 6,
    ]);
  });

  it("agruparPorDia no modifica la lista que recibe", () => {
    // D11: se ordena una copia. La lista de entrada queda como llegó.
    const entrada = [funcion3, funcion4Utc, funcion5];
    const copia = structuredClone(entrada);

    agruparPorDia(entrada);

    expect(entrada).toEqual(copia);
  });
});
