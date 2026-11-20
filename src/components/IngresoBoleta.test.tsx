import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IngresoBoleta from "@/components/IngresoBoleta";
import { API_URL } from "@/lib/api";
import type { EstadoBoleta } from "@/lib/boletas";

// Spec 006, T8: el estado de la boleta y el botón «Validar ingreso» (D13). Usa el
// `validarIngreso` real de `@/lib/ingreso`, que llama a `fetch`: aquí se simula
// `fetch`, no `validarIngreso`. La interacción es solo con `fireEvent`.
//
// El día y la hora de uso se escriben en Colombia sin importar la zona de quien
// ejecuta (D19): estas pruebas corren con la zona del proceso en Tokio (14 h por
// delante), para que un error de hora local no pase en una máquina que está en
// Colombia.
//
// La zona se asigna con `vi.hoisted`, que Vitest ejecuta antes de evaluar los
// `import`. No puede ir en `beforeAll`: el componente importa `formato.ts`, que
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

// «Sin `router.refresh()`» (D13): al validar, la página no se recarga ni se vuelve
// a pedir. El router se sustituye por uno que solo cuenta las llamadas a
// `refresh`; si el componente lo llama, la prueba falla.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

const CODIGO = "K7Q2M9XA";
const URL_DEL_INGRESO = `${API_URL}/boletas/${CODIGO}/ingreso`;

const BOTON_VALIDAR = "Validar ingreso";
const BOTON_VALIDANDO = "Validando ingreso…";
const CONFIRMACION = "Ingreso validado.";
const YA_USADA = "Esta boleta ya fue usada.";
const FALLO =
  "No pudimos validar el ingreso. Revisa tu conexión e inténtalo de nuevo.";

/**
 * El primer uso, tal como lo escribe el backend: 2:45 p. m. del domingo 22 de
 * noviembre en Colombia. En Tokio ya sería el lunes 23 a las 4:45 a. m.
 */
const PRIMER_USO = "2026-11-22T14:45:12-05:00";
const PARES_DEL_PRIMER_USO = [
  ["Estado", "Usada"],
  ["Día de uso", "domingo, 22 de noviembre"],
  ["Hora de uso", "2:45 p. m."],
];

/**
 * Cerca de la medianoche en UTC: ya es el lunes 23 a las 3:30 a. m. en UTC y a las
 * 12:30 p. m. en Tokio, pero en Colombia sigue siendo el domingo 22 a las 10:30 p. m.
 */
const USO_CERCA_DE_LA_MEDIANOCHE = "2026-11-23T03:30:00Z";
const PARES_DEL_USO_CERCA_DE_LA_MEDIANOCHE = [
  ["Estado", "Usada"],
  ["Día de uso", "domingo, 22 de noviembre"],
  ["Hora de uso", "10:30 p. m."],
];

const PARES_DE_UNA_BOLETA_VALIDA = [["Estado", "Válida"]];

type Props = {
  codigo: string;
  estado: EstadoBoleta;
  fechaUso: string | null;
};

/** Una boleta válida, salvo lo que cambie la prueba. */
function montar(cambios: Partial<Props> = {}) {
  const props: Props = {
    codigo: CODIGO,
    estado: "valida",
    fechaUso: null,
    ...cambios,
  };
  return render(<IngresoBoleta {...props} />);
}

/** Respuesta HTTP real de `fetch` con el cuerpo en JSON. */
function responder(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** El 200 del backend (contrato del plan): la boleta, ya usada, con su fecha de uso. */
function boletaUsada(fechaUso: string): Response {
  return responder(
    {
      codigo: CODIGO,
      titulo: "El Último Faro",
      inicio: "2026-11-22T15:00:00-05:00",
      lugar: "Cine Club La Gaitana",
      ciudad: "Neiva",
      asientos: ["D1", "D2"],
      nombre: "Ana Pérez",
      estado: "usada",
      fechaUso,
    },
    200,
  );
}

/** El 409 del backend (contrato del plan): con la fecha del primer uso, o sin ella. */
function yaUsada(fechaUso?: string): Response {
  return responder(
    {
      statusCode: 409,
      message: `La boleta ${CODIGO} ya fue usada`,
      error: "Conflict",
      ...(fechaUso === undefined ? {} : { fechaUso }),
    },
    409,
  );
}

/** Una petición que el backend todavía no responde: la prueba la resuelve cuando quiere. */
function respuestaPendiente() {
  let resolver: (respuesta: Response) => void = () => {};
  const promesa = new Promise<Response>((resolve) => {
    resolver = resolve;
  });
  return {
    promesa,
    resolver: (respuesta: Response) => resolver(respuesta),
  };
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` (vitest.config.ts)
  // deshace el doble al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // `validarIngreso` registra cada fallo con console.error (D13): se silencia el ruido.
  vi.spyOn(console, "error").mockImplementation(() => {});
  refresh.mockClear();
});

afterEach(() => {
  // Devuelve `console.error` a su implementación (`restoreMocks` también lo hace).
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Ayudas de la pantalla
// ---------------------------------------------------------------------------

/** Los pares término → valor de la lista de datos (`<dl>`), en el orden en que se ven. */
function paresDelEstado(): Array<[string | null, string | null]> {
  const terminos = screen.getAllByRole("term");
  const definiciones = screen.getAllByRole("definition");

  // Cada término tiene su valor: ni sobra uno ni falta otro.
  expect(definiciones).toHaveLength(terminos.length);
  return terminos.map((termino, indice) => [
    termino.textContent,
    definiciones[indice]?.textContent ?? null,
  ]);
}

/** `primero` queda antes que `segundo` en el documento. */
function expectAntes(primero: Element, segundo: Element) {
  expect(
    primero.compareDocumentPosition(segundo) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

function validar() {
  fireEvent.click(screen.getByRole("button", { name: BOTON_VALIDAR }));
}

/** La boleta pasó a «Usada»: no queda ningún botón, ni el de validar ni el de «Validando…». */
function expectSinBoton() {
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: BOTON_VALIDAR }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: BOTON_VALIDANDO }),
  ).not.toBeInTheDocument();
}

/** Ningún aviso ni confirmación: la boleta está como llegó. */
function expectSinAvisos() {
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText(CONFIRMACION)).not.toBeInTheDocument();
  expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
}

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 22 en Colombia y las 12:30 del 23 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-23T03:30:00Z").getHours()).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// CA-6: el estado de la boleta
// ---------------------------------------------------------------------------

describe("IngresoBoleta: el estado que dicen las props", () => {
  it("una boleta válida muestra «Válida» y el botón «Validar ingreso»", () => {
    montar();

    expect(
      screen.getByRole("heading", { level: 2, name: "Estado" }),
    ).toBeInTheDocument();
    // Solo el estado: una boleta válida no tiene día ni hora de uso.
    expect(paresDelEstado()).toEqual(PARES_DE_UNA_BOLETA_VALIDA);
    expect(screen.queryByText("Día de uso")).not.toBeInTheDocument();
    expect(screen.queryByText("Hora de uso")).not.toBeInTheDocument();
    expect(screen.queryByText("Usada")).not.toBeInTheDocument();
    // El botón está listo para pulsarse, y nada se ha pedido ni avisado.
    expect(screen.getByRole("button", { name: BOTON_VALIDAR })).toBeEnabled();
    expectSinAvisos();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una boleta usada muestra «Usada», el día y la hora de uso en Colombia, y no tiene el botón", () => {
    montar({ estado: "usada", fechaUso: USO_CERCA_DE_LA_MEDIANOCHE });

    expect(
      screen.getByRole("heading", { level: 2, name: "Estado" }),
    ).toBeInTheDocument();
    // El día y la hora son los de Colombia aunque el proceso corra en Tokio: ahí
    // ya sería el lunes 23 a las 12:30 p. m., y en UTC, el lunes 23 a las 3:30 a. m.
    expect(paresDelEstado()).toEqual(PARES_DEL_USO_CERCA_DE_LA_MEDIANOCHE);
    // Una boleta usada no se puede volver a validar desde aquí.
    expectSinBoton();
    expectSinAvisos();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CA-9: validar el ingreso
// ---------------------------------------------------------------------------

describe("IngresoBoleta: validar el ingreso", () => {
  it("con 200 pasa a «Usada» con el día y la hora de la respuesta, quita el botón y da el foco a «Ingreso validado.»", async () => {
    // La fecha de uso es la de la respuesta (las props no traían ninguna).
    fetchMock.mockResolvedValue(boletaUsada(USO_CERCA_DE_LA_MEDIANOCHE));
    montar();
    expect(paresDelEstado()).toEqual(PARES_DE_UNA_BOLETA_VALIDA);

    validar();

    const confirmacion = await screen.findByText(CONFIRMACION);
    // La confirmación se enfoca por programa, sin entrar en el orden de Tab.
    expect(confirmacion).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(confirmacion).toHaveFocus());

    // «Usada», con el día y la hora de Colombia de la respuesta.
    expect(paresDelEstado()).toEqual(PARES_DEL_USO_CERCA_DE_LA_MEDIANOCHE);
    // El botón desapareció y no queda ningún aviso de fallo ni de boleta ya usada.
    expectSinBoton();
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Esta boleta ya fue usada/)).not.toBeInTheDocument();

    // Un POST a la boleta de las props, y nada más: no se recarga ni se vuelve a pedir.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const llamada = fetchMock.mock.calls[0];
    expect(llamada?.[0]).toBe(URL_DEL_INGRESO);
    expect(llamada?.[1]?.method).toBe("POST");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("mientras valida, el botón queda deshabilitado con «Validando ingreso…» y otro clic no vuelve a llamar a la API", async () => {
    const pendiente = respuestaPendiente();
    fetchMock.mockReturnValue(pendiente.promesa);
    montar();
    expect(fetchMock).not.toHaveBeenCalled();

    validar();

    // La petición salió, y el botón cambió de texto y quedó deshabilitado.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const validando = screen.getByRole("button", { name: BOTON_VALIDANDO });
    expect(validando).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: BOTON_VALIDAR }),
    ).not.toBeInTheDocument();
    // Todavía no hay resultado: sigue «Válida», sin avisos.
    expect(paresDelEstado()).toEqual(PARES_DE_UNA_BOLETA_VALIDA);
    expectSinAvisos();

    // Otros clics no llaman otra vez a la API.
    fireEvent.click(validando);
    fireEvent.click(validando);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: BOTON_VALIDANDO })).toBeDisabled();

    // Al responder, la boleta pasa a «Usada» y la API se llamó una sola vez.
    pendiente.resolver(boletaUsada(PRIMER_USO));

    expect(await screen.findByText(CONFIRMACION)).toBeInTheDocument();
    expect(paresDelEstado()).toEqual(PARES_DEL_PRIMER_USO);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // CA-10: la boleta ya se usó
  // -------------------------------------------------------------------------

  it('con 409 muestra «Esta boleta ya fue usada. Primer uso: domingo, 22 de noviembre, 2:45 p. m.» con role="alert", pasa a «Usada» y quita el botón', async () => {
    fetchMock.mockResolvedValue(yaUsada(PRIMER_USO));
    montar();

    validar();

    const alerta = await screen.findByRole("alert");
    // El texto exacto, con espacios normales (ni U+00A0 ni U+202F en «p. m.»).
    expect(alerta.textContent).toBe(
      "Esta boleta ya fue usada. Primer uso: domingo, 22 de noviembre, 2:45 p. m.",
    );
    // Es el único aviso, y es lo que recibe el foco.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(alerta).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(alerta).toHaveFocus());

    // La boleta pasó a «Usada» con la fecha del primer uso, sin el botón.
    expect(paresDelEstado()).toEqual(PARES_DEL_PRIMER_USO);
    expectSinBoton();
    // Ya estaba usada: no es una validación ni un fallo de conexión.
    expect(screen.queryByText(CONFIRMACION)).not.toBeInTheDocument();
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("con un 409 sin fecha muestra «Esta boleta ya fue usada.» y pasa a «Usada» sin día ni hora", async () => {
    fetchMock.mockResolvedValue(yaUsada());
    montar();

    validar();

    const alerta = await screen.findByRole("alert");
    // Sin fecha no hay «Primer uso: …»: ni una fecha inventada ni «Invalid Date».
    expect(alerta.textContent).toBe(YA_USADA);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(alerta).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(alerta).toHaveFocus());

    // «Usada», pero sin día ni hora de uso: no se sabe cuándo fue.
    expect(paresDelEstado()).toEqual([["Estado", "Usada"]]);
    expect(screen.queryByText("Día de uso")).not.toBeInTheDocument();
    expect(screen.queryByText("Hora de uso")).not.toBeInTheDocument();
    expect(screen.queryByText(/Primer uso/)).not.toBeInTheDocument();
    expectSinBoton();
    expect(screen.queryByText(CONFIRMACION)).not.toBeInTheDocument();
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Sin criterio: el fallo de la conexión (D13)
  // -------------------------------------------------------------------------

  it("si el backend no responde muestra el aviso de fallo, sigue «Válida» y el botón vuelve a estar habilitado con el foco; al reintentar se valida", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(boletaUsada(PRIMER_USO));
    montar();

    validar();

    // El aviso, con el texto exacto, encima del botón.
    const aviso = await screen.findByRole("alert");
    expect(aviso.textContent).toBe(FALLO);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const boton = screen.getByRole("button", { name: BOTON_VALIDAR });
    expectAntes(aviso, boton);
    // Sigue «Válida», y el botón vuelve a estar habilitado y con el foco: un botón
    // que se deshabilita mientras lo tiene pierde el foco.
    expect(boton).toBeEnabled();
    await waitFor(() => expect(boton).toHaveFocus());
    expect(paresDelEstado()).toEqual(PARES_DE_UNA_BOLETA_VALIDA);
    expect(screen.queryByText(CONFIRMACION)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Se vuelve a pulsar: sale otra petición a la misma boleta y, ahora, se valida.
    fireEvent.click(boton);

    expect(await screen.findByText(CONFIRMACION)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(URL_DEL_INGRESO);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    // El aviso de fallo se fue, la boleta está «Usada» y ya no hay botón.
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
    expect(paresDelEstado()).toEqual(PARES_DEL_PRIMER_USO);
    expectSinBoton();
  });
});
