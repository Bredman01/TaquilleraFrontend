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
  getAsientos,
  getFuncion,
  getFunciones,
  type Asiento,
  type DiaDeFunciones,
  type Funcion,
  type FuncionConEvento,
  type ResultadoFuncion,
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

// ---------------------------------------------------------------------------
// Spec 004: la función por id (CA-1, CA-10) y sus asientos (CA-2, CA-10).
// ---------------------------------------------------------------------------

// GET /funciones/:id responde un objeto plano con exactamente siete campos
// (contrato del plan, D3): los cuatro de `Funcion` más el título, la ciudad y el
// lugar del evento. Son las funciones 5 y 10 de los datos de ejemplo.
const funcionConEvento5: FuncionConEvento = {
  id: 5,
  eventoId: 4,
  titulo: "Cartas a Medianoche",
  ciudad: "Neiva",
  lugar: "Teatro Municipal de Neiva",
  inicio: "2026-11-21T16:00:00-05:00",
  precio: 25000,
};
const funcionConEvento10: FuncionConEvento = {
  id: 10,
  eventoId: 8,
  titulo: "Del Grano a la Taza",
  ciudad: "Neiva",
  lugar: "Biblioteca Departamental",
  inicio: "2026-11-22T10:30:00-05:00",
  precio: 8000,
};

const funcionNoEncontrada: ResultadoFuncion = {
  ok: false,
  motivo: "no-encontrado",
};
const funcionConError: ResultadoFuncion = { ok: false, motivo: "error" };

/** El cuerpo con que el backend responde 404 (contrato del plan). */
function cuerpo404(id: number) {
  return {
    statusCode: 404,
    message: `La función ${id} no existe`,
    error: "Not Found",
  };
}

/** El cuerpo con que el backend responde 400 cuando el id no es un entero. */
const cuerpo400 = {
  statusCode: 400,
  message: "Validation failed (numeric string is expected)",
  error: "Bad Request",
};

/** El mismo objeto sin uno de sus campos: para probar que ninguno es opcional. */
function sinCampo(objeto: object, campo: string): unknown {
  return Object.fromEntries(
    Object.entries(objeto).filter(([clave]) => clave !== campo),
  );
}

describe("getFuncion", () => {
  it("getFuncion pide la función al backend y la devuelve", async () => {
    fetchMock.mockResolvedValueOnce(responder(funcionConEvento5));

    const resultado = await getFuncion("5");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/funciones/5`);
    // Los siete campos, tal como los responde la API.
    expect(resultado).toEqual({ ok: true, funcion: funcionConEvento5 });
    expect(errorSpy).not.toHaveBeenCalled();

    // El id de la dirección es el que se pide, no uno fijo.
    fetchMock.mockResolvedValueOnce(responder(funcionConEvento10));

    const otra = await getFuncion("10");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${API_URL}/funciones/10`);
    expect(otra).toEqual({ ok: true, funcion: funcionConEvento10 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getFuncion devuelve no-encontrado sin registrar nada cuando el backend responde 404 o 400", async () => {
    const casos: Array<[string, string, Response]> = [
      // Un entero sin función: el cuerpo del contrato.
      ["404", "9999", responder(cuerpo404(9999), 404)],
      // Solo ocurre si el backend valida distinto que el frontend (D11).
      ["400", "5", responder(cuerpo400, 400)],
    ];

    for (const [codigo, id, respuesta] of casos) {
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getFuncion(id);

      expect(resultado, `resultado cuando el backend responde ${codigo}`).toEqual(
        funcionNoEncontrada,
      );
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
        `${API_URL}/funciones/${id}`,
      );
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
    // Una función que no existe no es un fallo: el verificador-ui bloquea
    // cualquier línea de registro del frontend que diga «error».
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getFuncion devuelve no-encontrado sin llamar al backend cuando el id no es un entero positivo", async () => {
    // «01» no llega al backend aunque `ParseIntPipe` lo aceptaría (plan, «Cómo lo
    // usa el frontend»); «5abc» y el texto vacío tampoco.
    for (const id of ["abc", "0", "01", "-1", "1.5", "", "5abc"]) {
      const resultado = await getFuncion(id);

      expect(resultado, `resultado para el id «${id}»`).toEqual(
        funcionNoEncontrada,
      );
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // Con un id válido sí se pregunta al backend: la respuesta decide.
    fetchMock.mockResolvedValueOnce(responder(cuerpo404(9999), 404));

    await expect(getFuncion("9999")).resolves.toEqual(funcionNoEncontrada);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("getFuncion devuelve error sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getFuncion("5")).resolves.toEqual(funcionConError);
    // D11: el fallo queda en el registro del servidor.
    expect(errorSpy).toHaveBeenCalled();
  });

  it("getFuncion devuelve error cuando el backend responde con otro código", async () => {
    const casos: Array<[string, Response]> = [
      [
        "el backend responde 500",
        responder({ statusCode: 500, message: "Internal server error" }, 500),
      ],
      [
        "el backend responde 503",
        responder({ statusCode: 503, message: "Service unavailable" }, 503),
      ],
      [
        // Ni 404 ni 400 ni 2xx: tampoco es «no encontrado».
        "el backend responde 403",
        responder({ statusCode: 403, message: "Forbidden" }, 403),
      ],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getFuncion("5");

      expect(resultado, `resultado cuando ${descripcion}`).toEqual(
        funcionConError,
      );
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getFuncion devuelve error cuando la respuesta no es una función", async () => {
    const casos: Array<[string, Response]> = [
      ["un 200 con null", responder(null)],
      ["un 200 con un texto", responder("funcion")],
      ["un 200 con un número", responder(5)],
      [
        // Las funciones de un evento en lugar de una sola.
        "un 200 con un arreglo",
        responder([funcionConEvento5]),
      ],
      [
        "un 200 que no es JSON",
        new Response("<html>Bad gateway</html>", { status: 200 }),
      ],
      [
        // Las siete claves son obligatorias: ninguna es opcional.
        "una función sin id",
        responder(sinCampo(funcionConEvento5, "id")),
      ],
      [
        "una función sin eventoId",
        responder(sinCampo(funcionConEvento5, "eventoId")),
      ],
      [
        "una función sin titulo",
        responder(sinCampo(funcionConEvento5, "titulo")),
      ],
      [
        "una función sin ciudad",
        responder(sinCampo(funcionConEvento5, "ciudad")),
      ],
      [
        "una función sin lugar",
        responder(sinCampo(funcionConEvento5, "lugar")),
      ],
      [
        "una función sin inicio",
        responder(sinCampo(funcionConEvento5, "inicio")),
      ],
      [
        "una función sin precio",
        responder(sinCampo(funcionConEvento5, "precio")),
      ],
      ["un id que es texto", responder({ ...funcionConEvento5, id: "5" })],
      [
        "un eventoId que es texto",
        responder({ ...funcionConEvento5, eventoId: "4" }),
      ],
      [
        "un precio que es texto",
        responder({ ...funcionConEvento5, precio: "25000" }),
      ],
      ["un precio nulo", responder({ ...funcionConEvento5, precio: null })],
      ["un titulo que es un número", responder({ ...funcionConEvento5, titulo: 5 })],
      ["una ciudad nula", responder({ ...funcionConEvento5, ciudad: null })],
      ["un lugar que es un número", responder({ ...funcionConEvento5, lugar: 7 })],
      [
        // `Date.parse` no la entiende: `Intl` lanzaría al pintar la cabecera (D11).
        "un inicio que no es una fecha",
        responder({ ...funcionConEvento5, inicio: "mañana" }),
      ],
      ["un inicio nulo", responder({ ...funcionConEvento5, inicio: null })],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getFuncion("5");

      expect(resultado, `resultado cuando hay ${descripcion}`).toEqual(
        funcionConError,
      );
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getFuncion acepta un inicio con cualquier desfase válido", async () => {
    // Contrato del plan: en los datos el desfase siempre es -05:00, pero el
    // frontend acepta cualquier ISO 8601 que `Date.parse` entienda.
    for (const inicio of [
      "2026-11-22T04:30:00Z",
      "2026-11-22T13:30:00+09:00",
    ]) {
      const funcion = { ...funcionConEvento5, inicio };
      fetchMock.mockResolvedValueOnce(responder(funcion));

      const resultado = await getFuncion("5");

      expect(resultado, `resultado con el inicio ${inicio}`).toEqual({
        ok: true,
        funcion,
      });
    }

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getFuncion corta la espera del backend a los 5 s", async () => {
    // Un backend colgado no puede dejar la página cargando para siempre.
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getFuncion("5");

    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/funciones/5`);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toEqual(funcionConError);
    expect(errorSpy).toHaveBeenCalled();
  });
});

// El plano de todos los lugares: cinco filas, de la A a la E, con ocho asientos.
// Los asientos llegan ordenados por fila y por número (contrato del plan, D4).
const FILAS_DEL_PLANO = ["A", "B", "C", "D", "E"];
const OCUPADOS_DE_LA_FUNCION_5 = ["A3", "A4", "C1", "C8", "D5", "E8"];

/** Los 40 asientos del plano, con los ids que se pasen como ocupados. */
function asientosDelPlano(ocupados: readonly string[] = []): Asiento[] {
  return FILAS_DEL_PLANO.flatMap((fila) =>
    Array.from({ length: 8 }, (_, indice): Asiento => {
      const id = `${fila}${indice + 1}`;
      return {
        id,
        fila,
        numero: indice + 1,
        estado: ocupados.includes(id) ? "ocupado" : "disponible",
      };
    }),
  );
}

const asientosFuncion5 = asientosDelPlano(OCUPADOS_DE_LA_FUNCION_5);
const asientosFuncion10 = asientosDelPlano();

const asientoA1: Asiento = {
  id: "A1",
  fila: "A",
  numero: 1,
  estado: "disponible",
};
const asientoA2: Asiento = {
  id: "A2",
  fila: "A",
  numero: 2,
  estado: "disponible",
};
const asientoA3Ocupado: Asiento = {
  id: "A3",
  fila: "A",
  numero: 3,
  estado: "ocupado",
};

describe("getAsientos", () => {
  it("getAsientos pide los asientos de la función al backend y los devuelve", async () => {
    fetchMock.mockResolvedValueOnce(responder(asientosFuncion5));

    const resultado = await getAsientos(5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/funciones/5/asientos`);
    // Los 40, en el orden en que los ordena el backend y con los seis ocupados.
    expect(resultado).toEqual({ ok: true, asientos: asientosFuncion5 });
    expect(errorSpy).not.toHaveBeenCalled();

    // El id de la dirección es el de la función que se pide, no uno fijo.
    fetchMock.mockResolvedValueOnce(responder(asientosFuncion10));

    const otra = await getAsientos(10);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `${API_URL}/funciones/10/asientos`,
    );
    expect(otra).toEqual({ ok: true, asientos: asientosFuncion10 });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getAsientos devuelve ok false sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getAsientos(5)).resolves.toEqual({ ok: false });
    // D11: el fallo queda en el registro del servidor.
    expect(errorSpy).toHaveBeenCalled();
  });

  it("getAsientos devuelve ok false cuando el backend responde con error", async () => {
    const casos: Array<[string, Response]> = [
      [
        // Solo ocurre si la función desaparece entre las dos peticiones.
        "el backend responde 404",
        responder(cuerpo404(5), 404),
      ],
      [
        "el backend responde 500",
        responder({ statusCode: 500, message: "Internal server error" }, 500),
      ],
      [
        // D11: todo lo que no es 2xx es un fallo de los asientos.
        "el backend responde 400",
        responder(cuerpo400, 400),
      ],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getAsientos(5);

      expect(resultado, `resultado cuando ${descripcion}`).toEqual({
        ok: false,
      });
      // También el 404: aquí no hay un «no encontrado» que se pueda mostrar.
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getAsientos devuelve ok false cuando la respuesta no es una lista de asientos", async () => {
    const casos: Array<[string, Response]> = [
      ["un 200 con null", responder(null)],
      ["un 200 con un texto", responder("asientos")],
      [
        "un 200 con un objeto en lugar de una lista",
        responder({ asientos: asientosFuncion5 }),
      ],
      [
        "un 200 que no es JSON",
        new Response("<html>Bad gateway</html>", { status: 200 }),
      ],
      ["una lista que trae un null", responder([asientoA1, null])],
      [
        // Los cuatro campos son obligatorios.
        "un asiento sin id",
        responder([sinCampo(asientoA1, "id")]),
      ],
      ["un asiento sin fila", responder([sinCampo(asientoA1, "fila")])],
      ["un asiento sin numero", responder([sinCampo(asientoA1, "numero")])],
      ["un asiento sin estado", responder([sinCampo(asientoA1, "estado")])],
      ["un id que es un número", responder([{ ...asientoA1, id: 1 }])],
      ["una fila que es un número", responder([{ ...asientoA1, fila: 1 }])],
      ["un numero que es texto", responder([{ ...asientoA1, numero: "1" }])],
      [
        // Con un estado desconocido el mapa no sabría si se puede elegir (D11).
        "un estado desconocido",
        responder([{ ...asientoA1, estado: "reservado" }]),
      ],
      [
        // La enumeración es exactamente `disponible` u `ocupado`, en minúsculas.
        "un estado con mayúscula",
        responder([{ ...asientoA1, estado: "Disponible" }]),
      ],
      ["un estado nulo", responder([{ ...asientoA1, estado: null }])],
      [
        // Un asiento malo invalida la lista entera, no solo ese elemento.
        "un asiento válido seguido de otro con el numero en texto",
        responder([asientoA1, { ...asientoA2, numero: "2" }]),
      ],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await getAsientos(5);

      expect(resultado, `resultado cuando hay ${descripcion}`).toEqual({
        ok: false,
      });
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getAsientos devuelve la lista tal como llega aunque no tenga 40 asientos", async () => {
    // D11: no exige 40 asientos; el mapa pinta las filas que lleguen.
    const parcial: Asiento[] = [asientoA1, asientoA3Ocupado];
    fetchMock.mockResolvedValueOnce(responder(parcial));

    await expect(getAsientos(5)).resolves.toEqual({
      ok: true,
      asientos: parcial,
    });

    fetchMock.mockResolvedValueOnce(responder([]));

    await expect(getAsientos(5)).resolves.toEqual({ ok: true, asientos: [] });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("getAsientos corta la espera del backend a los 5 s", async () => {
    // Un backend colgado no puede dejar la sección cargando para siempre.
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getAsientos(5);

    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/funciones/5/asientos`);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalled();
  });
});
