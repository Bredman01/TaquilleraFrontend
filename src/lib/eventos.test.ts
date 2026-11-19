import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import {
  API_URL,
  getCiudades,
  getEvento,
  getEventos,
  type Evento,
  type ResultadoEvento,
} from "@/lib/eventos";

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

const elUltimoFaro: Evento = {
  id: 1,
  titulo: "El Último Faro",
  descripcion:
    "Un farero solitario descubre un mensaje que cambia la historia de su pueblo.",
  categoria: "cine",
  ciudad: "Neiva",
  lugar: "Cine Club La Gaitana",
  duracionMinutos: 118,
  clasificacion: "+13",
  imagenUrl: "https://placehold.co/400x600/png?text=El+Ultimo+Faro",
};

const noEncontrado: ResultadoEvento = { ok: false, motivo: "no-encontrado" };
const conError: ResultadoEvento = { ok: false, motivo: "error" };

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
  // Las funciones registran los fallos con console.error; se silencia el ruido.
  // El espía se guarda para poder comprobar cuándo NO se registra nada.
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

describe("getEvento", () => {
  it("getEvento pide el evento al backend y lo devuelve cuando responde 200", async () => {
    fetchMock.mockResolvedValueOnce(responder(cartasAMedianoche));

    const resultado = await getEvento("4");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/eventos/4`);
    expect(resultado).toEqual({ ok: true, evento: cartasAMedianoche });
  });

  it("getEvento devuelve no encontrado cuando el backend responde 404", async () => {
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 404,
          message: "El evento 9999 no existe",
          error: "Not Found",
        },
        404,
      ),
    );

    const resultado = await getEvento("9999");

    // Con un id válido sí se pregunta al backend: la respuesta decide.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual(noEncontrado);
  });

  it("getEvento trata como no encontrado un id que no es entero positivo, sin llamar al backend", async () => {
    for (const id of ["abc", "1.5", "0", "-1"]) {
      const resultado = await getEvento(id);

      expect(resultado, `resultado para el id «${id}»`).toEqual(noEncontrado);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getEvento trata una respuesta 400 del backend como evento no encontrado", async () => {
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 400,
          message: "Validation failed (numeric string is expected)",
          error: "Bad Request",
        },
        400,
      ),
    );

    const resultado = await getEvento("5");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual(noEncontrado);
  });

  it("getEvento devuelve error sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getEvento("1")).resolves.toEqual(conError);
  });

  it("getEvento corta la espera del backend a los 5 s", async () => {
    // Un backend colgado no puede dejar la página cargando para siempre.
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getEvento("1");

    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toEqual(conError);
  });

  it("getEvento devuelve error cuando el backend responde 500", async () => {
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 500,
          message: "Internal server error",
        },
        500,
      ),
    );

    await expect(getEvento("2")).resolves.toEqual(conError);
  });

  it("getEvento devuelve error cuando la respuesta no es un evento", async () => {
    // Un 200 con null y otro con un arreglo (la cartelera en lugar de un evento).
    fetchMock.mockResolvedValueOnce(responder(null));
    fetchMock.mockResolvedValueOnce(responder([cartasAMedianoche]));

    await expect(getEvento("4")).resolves.toEqual(conError);
    await expect(getEvento("6")).resolves.toEqual(conError);
  });

  it("getEvento devuelve error cuando la respuesta es un valor que no es objeto", async () => {
    // Contrato, «200 con un cuerpo que no es objeto → error»: JSON válido, pero
    // un texto, un número o un booleano en lugar de un evento.
    for (const cuerpo of ["texto", 42, true]) {
      fetchMock.mockResolvedValueOnce(responder(cuerpo));

      const resultado = await getEvento("4");

      expect(
        resultado,
        `resultado para un 200 con el cuerpo ${JSON.stringify(cuerpo)}`,
      ).toEqual(conError);
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("getEvento no registra console.error cuando el evento no existe", async () => {
    // Un evento inexistente no es un fallo. El verificador-ui bloquea cualquier
    // línea de registro del frontend que contenga «error».
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 404,
          message: "El evento 9999 no existe",
          error: "Not Found",
        },
        404,
      ),
    );

    // Un 404 del backend: la petición sí se hace y el resultado es «no encontrado».
    await expect(getEvento("9999")).resolves.toEqual(noEncontrado);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Un id inválido: ni siquiera se llama al backend.
    await expect(getEvento("abc")).resolves.toEqual(noEncontrado);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("getEventos", () => {
  it("getEventos pide /eventos con la categoría y la ciudad en la consulta", async () => {
    fetchMock.mockResolvedValueOnce(responder([]));

    await getEventos({ categoria: "teatro", ciudad: "Bogotá" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // La tilde viaja codificada: Bogotá → Bogot%C3%A1.
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `${API_URL}/eventos?categoria=teatro&ciudad=Bogot%C3%A1`,
    );
  });

  it("getEventos pide solo el filtro que recibe", async () => {
    // CA-3: la lista se filtra por categoría, por ciudad o por las dos a la vez.
    // Un filtro ausente no viaja, ni siquiera vacío.
    fetchMock.mockImplementation(async () => responder([]));

    await getEventos({ categoria: "charla" });
    await getEventos({ ciudad: "Neiva" });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/eventos?categoria=charla`,
      `${API_URL}/eventos?ciudad=Neiva`,
    ]);
  });

  it("getEventos sin filtros pide /eventos sin consulta", async () => {
    fetchMock.mockResolvedValueOnce(responder([]));

    await getEventos({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/eventos`);
  });

  it("getEventos devuelve los eventos cuando el backend responde 200", async () => {
    fetchMock.mockResolvedValueOnce(
      responder([elUltimoFaro, cartasAMedianoche]),
    );

    const resultado = await getEventos({});

    expect(resultado).toEqual({
      ok: true,
      eventos: [elUltimoFaro, cartasAMedianoche],
    });
  });

  it("getEventos devuelve ok false cuando el backend responde con error", async () => {
    fetchMock.mockResolvedValueOnce(
      responder({ statusCode: 500, message: "Internal server error" }, 500),
    );

    await expect(getEventos({})).resolves.toEqual({ ok: false });
  });

  it("getEventos devuelve ok false sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getEventos({})).resolves.toEqual({ ok: false });
  });

  it("getEventos devuelve ok false cuando la respuesta no es un arreglo", async () => {
    // Un 200 con un solo evento (lo que responde /eventos/:id), no un arreglo.
    fetchMock.mockResolvedValueOnce(responder(cartasAMedianoche));

    await expect(getEventos({})).resolves.toEqual({ ok: false });
  });

  it("getEventos corta la espera del backend a los 5 s", async () => {
    // Sin criterio (D9): las funciones de lib/ cortan a los 5 s, no solo getEvento.
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getEventos({});

    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toEqual({ ok: false });
  });
});

describe("getCiudades", () => {
  it("getCiudades pide las ciudades al backend y las devuelve", async () => {
    const ciudades = ["Bogotá", "Íquira", "Neiva", "Pitalito"];
    fetchMock.mockResolvedValueOnce(responder(ciudades));

    const resultado = await getCiudades();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/eventos/ciudades`);
    expect(resultado).toEqual({ ok: true, ciudades });
  });

  it("getCiudades devuelve ok false si el backend falla o la respuesta no es una lista de textos", async () => {
    const casos: Array<[string, () => void]> = [
      [
        "el backend responde 500",
        () =>
          fetchMock.mockResolvedValueOnce(
            responder({ statusCode: 500, message: "Internal server error" }, 500),
          ),
      ],
      [
        "el backend no responde",
        () => fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")),
      ],
      [
        "un 200 con null",
        () => fetchMock.mockResolvedValueOnce(responder(null)),
      ],
      [
        "un 200 con un objeto en lugar de una lista",
        () =>
          fetchMock.mockResolvedValueOnce(responder({ ciudades: ["Neiva"] })),
      ],
      [
        "un 200 con una lista de números",
        () => fetchMock.mockResolvedValueOnce(responder([1, 2])),
      ],
      [
        "un 200 con una lista que mezcla textos y números",
        () => fetchMock.mockResolvedValueOnce(responder(["Neiva", 3])),
      ],
    ];

    for (const [descripcion, preparar] of casos) {
      preparar();

      const resultado = await getCiudades();

      expect(resultado, `resultado cuando ${descripcion}`).toEqual({
        ok: false,
      });
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("getCiudades corta la espera del backend a los 5 s", async () => {
    // Sin criterio (D9): las funciones de lib/ cortan a los 5 s, no solo getEvento.
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = getCiudades();

    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toEqual({ ok: false });
  });
});
