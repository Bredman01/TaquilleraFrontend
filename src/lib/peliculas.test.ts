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
  getPelicula,
  getPeliculas,
  type Pelicula,
  type ResultadoPelicula,
} from "@/lib/peliculas";

// Película 3 de los datos de ejemplo del backend (contrato del plan).
const risasEnFamilia: Pelicula = {
  id: 3,
  titulo: "Risas en Familia",
  sinopsis:
    "Tres generaciones comparten una casa durante las vacaciones y nada sale como lo planearon.",
  duracionMinutos: 95,
  clasificacion: "TP",
  genero: "Comedia",
  imagenUrl: "https://placehold.co/400x600/png?text=Risas+en+Familia",
};

const elUltimoFaro: Pelicula = {
  id: 1,
  titulo: "El Último Faro",
  sinopsis:
    "Un farero solitario descubre un mensaje que cambia la historia de su pueblo.",
  duracionMinutos: 118,
  clasificacion: "+13",
  genero: "Drama",
  imagenUrl: "https://placehold.co/400x600/png?text=El+Ultimo+Faro",
};

const noEncontrada: ResultadoPelicula = { ok: false, motivo: "no-encontrada" };
const conError: ResultadoPelicula = { ok: false, motivo: "error" };

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
  // El espía se guarda para poder comprobar cuándo NO se registra nada (D15).
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getPelicula", () => {
  it("getPelicula pide la película al backend y la devuelve cuando responde 200", async () => {
    fetchMock.mockResolvedValueOnce(responder(risasEnFamilia));

    const resultado = await getPelicula("3");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/peliculas/3`);
    expect(resultado).toEqual({ ok: true, pelicula: risasEnFamilia });
  });

  it("getPelicula devuelve no encontrada cuando el backend responde 404", async () => {
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 404,
          message: "La película 9999 no existe",
          error: "Not Found",
        },
        404,
      ),
    );

    const resultado = await getPelicula("9999");

    // Con un id válido sí se pregunta al backend: la respuesta decide.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual(noEncontrada);
  });

  it("getPelicula trata como no encontrada un id que no es entero positivo, sin llamar al backend", async () => {
    for (const id of ["abc", "1.5", "0", "-1"]) {
      const resultado = await getPelicula(id);

      expect(resultado, `resultado para el id «${id}»`).toEqual(noEncontrada);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getPelicula trata una respuesta 400 del backend como película no encontrada", async () => {
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

    const resultado = await getPelicula("5");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual(noEncontrada);
  });

  it("getPelicula devuelve error sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getPelicula("1")).resolves.toEqual(conError);
  });

  it("getPelicula corta la espera del backend a los 5 s", async () => {
    // D4 / CA-6: un backend colgado no puede dejar la página cargando para
    // siempre. La prueba no espera 5 s: sustituye AbortSignal.timeout por una
    // señal que ella controla y comprueba qué se le pidió y qué recibió `fetch`.
    const corte = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(corte.signal);
    // Backend colgado: la promesa de `fetch` no se resuelve nunca y solo se
    // rechaza cuando se aborta la señal que recibió, como hace el `fetch` real.
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolver, rechazar) => {
          const senal = init?.signal;
          if (senal) {
            senal.addEventListener("abort", () => rechazar(senal.reason));
          }
        }),
    );

    const espera = getPelicula("1");

    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(corte.signal);

    // Vencen los 5 s: la señal se aborta con un TimeoutError, como la real.
    corte.abort(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await expect(espera).resolves.toEqual(conError);
  });

  it("getPelicula devuelve error cuando el backend responde 500", async () => {
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 500,
          message: "Internal server error",
        },
        500,
      ),
    );

    await expect(getPelicula("2")).resolves.toEqual(conError);
  });

  it("getPelicula devuelve error cuando la respuesta no es una película", async () => {
    // Un 200 con null y otro con un arreglo (la cartelera en lugar de una película).
    fetchMock.mockResolvedValueOnce(responder(null));
    fetchMock.mockResolvedValueOnce(responder([risasEnFamilia]));

    await expect(getPelicula("4")).resolves.toEqual(conError);
    await expect(getPelicula("6")).resolves.toEqual(conError);
  });

  it("getPelicula devuelve error cuando la respuesta es un valor que no es objeto", async () => {
    // Contrato, «200 con un cuerpo que no es objeto → error»: JSON válido, pero
    // un texto, un número o un booleano en lugar de una película.
    for (const cuerpo of ["texto", 42, true]) {
      fetchMock.mockResolvedValueOnce(responder(cuerpo));

      const resultado = await getPelicula("4");

      expect(
        resultado,
        `resultado para un 200 con el cuerpo ${JSON.stringify(cuerpo)}`,
      ).toEqual(conError);
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("getPelicula no registra console.error cuando la película no existe", async () => {
    // D15: una película inexistente no es un fallo. El verificador-ui bloquea
    // cualquier línea de registro del frontend que contenga «error».
    fetchMock.mockResolvedValueOnce(
      responder(
        {
          statusCode: 404,
          message: "La película 9999 no existe",
          error: "Not Found",
        },
        404,
      ),
    );

    // Un 404 del backend: la petición sí se hace y el resultado es «no encontrada».
    await expect(getPelicula("9999")).resolves.toEqual(noEncontrada);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Un id inválido: ni siquiera se llama al backend.
    await expect(getPelicula("abc")).resolves.toEqual(noEncontrada);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// Caracterización: getPeliculas ya existe. Estas pruebas pasan desde el
// principio y defienden «cada función de lib/ que puede fallar tiene un caso de error».
describe("getPeliculas", () => {
  it("getPeliculas devuelve la cartelera cuando el backend responde 200", async () => {
    fetchMock.mockResolvedValueOnce(responder([elUltimoFaro, risasEnFamilia]));

    const resultado = await getPeliculas();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_URL}/peliculas`);
    expect(resultado).toEqual({
      ok: true,
      peliculas: [elUltimoFaro, risasEnFamilia],
    });
  });

  it("getPeliculas devuelve ok false cuando el backend responde con error", async () => {
    fetchMock.mockResolvedValueOnce(
      responder({ statusCode: 500, message: "Internal server error" }, 500),
    );

    await expect(getPeliculas()).resolves.toEqual({ ok: false });
  });

  it("getPeliculas devuelve ok false sin lanzar cuando el backend no responde", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getPeliculas()).resolves.toEqual({ ok: false });
  });

  it("getPeliculas devuelve ok false cuando la respuesta no es un arreglo", async () => {
    // Un 200 con una sola película (lo que responde /peliculas/:id), no un arreglo.
    fetchMock.mockResolvedValueOnce(responder(risasEnFamilia));

    await expect(getPeliculas()).resolves.toEqual({ ok: false });
  });
});
