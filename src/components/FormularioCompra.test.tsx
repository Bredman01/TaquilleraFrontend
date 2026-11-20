import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormularioCompra from "@/components/FormularioCompra";
import { API_URL } from "@/lib/api";
import type { CompraCreada } from "@/lib/compras";

// Spec 005, T8: el formulario de pago (D16). Usa el `comprar` real de
// `@/lib/compras`, que llama a `fetch`: aquí se simula `fetch`, no `comprar`. La
// interacción es solo con `fireEvent`. No se fuerza la zona del proceso: el
// formulario no escribe ninguna fecha ni hora.

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

const BOTON_PAGAR = "Pagar $ 30.000";
const BOTON_PROCESANDO = "Procesando pago…";
const APROBADA = "¡Compra aprobada!";
const FALLO =
  "No pudimos procesar el pago. Revisa tu conexión e inténtalo de nuevo.";

const NOMBRE_VACIO = "Escribe tu nombre completo";
const NOMBRE_LARGO = "El nombre admite máximo 100 caracteres";
const CORREO_VACIO = "Escribe tu correo electrónico";
const CORREO_INVALIDO = "Escribe un correo electrónico válido";
const MENSAJES_DE_CAMPO = [
  NOMBRE_VACIO,
  NOMBRE_LARGO,
  CORREO_VACIO,
  CORREO_INVALIDO,
];

const NOMBRE = "Ana Pérez";
const CORREO = "ana@correo.co";

/** Lo que recibe el backend en las compras de estas pruebas: los dos asientos de la función 1. */
const CUERPO_ESPERADO = {
  asientos: ["A1", "A2"],
  nombre: NOMBRE,
  correo: CORREO,
};

/** Un mismo formulario de la función 1, con A1 y A2 a $ 15.000 cada uno. */
function montar(
  cambios: Partial<{ funcionId: number; asientos: string[]; total: number }> = {},
) {
  const props = {
    funcionId: 1,
    asientos: ["A1", "A2"],
    total: 30000,
    ...cambios,
  };
  return render(<FormularioCompra {...props} />);
}

/** La compra que responde el backend con 201 (contrato del plan: cinco campos). */
function compra(cambios: Partial<CompraCreada> = {}): CompraCreada {
  return {
    codigo: "K7Q2M9XA",
    funcionId: 1,
    asientos: ["A1", "A2"],
    total: 30000,
    fecha: "2026-11-19T15:04:05-05:00",
    ...cambios,
  };
}

/** Respuesta HTTP real de `fetch` con el cuerpo en JSON. */
function responder(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function aprobada(cambios: Partial<CompraCreada> = {}): Response {
  return responder(compra(cambios), 201);
}

/** El 409 del backend (contrato del plan, D5) con los asientos no disponibles. */
function conflicto(asientos: string[]): Response {
  return responder(
    {
      statusCode: 409,
      message: `Estos asientos ya no están disponibles: ${asientos.join(", ")}`,
      error: "Conflict",
      asientos,
    },
    409,
  );
}

/** Una petición que el backend todavía no responde: la prueba la resuelve o la rechaza cuando quiere. */
function respuestaPendiente() {
  let resolver: (respuesta: Response) => void = () => {};
  let rechazar: (motivo: unknown) => void = () => {};
  const promesa = new Promise<Response>((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  return {
    promesa,
    resolver: (respuesta: Response) => resolver(respuesta),
    rechazar: (motivo: unknown) => rechazar(motivo),
  };
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // `comprar` registra cada fallo con console.error (D14): se silencia el ruido.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** El cuerpo JSON de la petición `indice` a `fetch`, ya leído. */
function cuerpoEnviado(indice = 0): unknown {
  const cuerpo = fetchMock.mock.calls[indice]?.[1]?.body;
  expect(typeof cuerpo, "el cuerpo de la petición es un texto JSON").toBe(
    "string",
  );
  return JSON.parse(String(cuerpo));
}

// ---------------------------------------------------------------------------
// Ayudas de la pantalla
// ---------------------------------------------------------------------------

function campoNombre() {
  return screen.getByLabelText<HTMLInputElement>("Nombre completo");
}

function campoCorreo() {
  return screen.getByLabelText<HTMLInputElement>("Correo electrónico");
}

/** El `<form>` que contiene los campos. */
function formulario(): HTMLFormElement {
  const form = campoNombre().form;
  if (form === null) {
    throw new Error("el campo «Nombre completo» no está dentro de un <form>");
  }
  return form;
}

function escribir(nombre: string, correo: string) {
  fireEvent.change(campoNombre(), { target: { value: nombre } });
  fireEvent.change(campoCorreo(), { target: { value: correo } });
}

function pagar() {
  fireEvent.click(screen.getByRole("button", { name: BOTON_PAGAR }));
}

/** Los pares término → valor de la confirmación (`<dl>`), en el orden en que se ven. */
function paresDeLaConfirmacion(): Array<[string | null, string | null]> {
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

/** El mensaje está debajo del campo y unido a él: es su descripción accesible. */
function expectCampoConError(campo: HTMLElement, mensaje: string) {
  expect(campo).toHaveAttribute("aria-invalid", "true");
  expect(campo).toHaveAccessibleDescription(mensaje);
  expectAntes(campo, screen.getByText(mensaje));
}

function expectCampoSinError(campo: HTMLElement) {
  expect(campo).not.toHaveAttribute("aria-invalid", "true");
}

/**
 * Los errores que se ven son exactamente los esperados: cada campo con el suyo
 * (o sin ninguno) y ningún otro mensaje de campo en la pantalla.
 */
function expectErrores(esperados: { nombre?: string; correo?: string }) {
  if (esperados.nombre === undefined) expectCampoSinError(campoNombre());
  else expectCampoConError(campoNombre(), esperados.nombre);
  if (esperados.correo === undefined) expectCampoSinError(campoCorreo());
  else expectCampoConError(campoCorreo(), esperados.correo);

  for (const mensaje of MENSAJES_DE_CAMPO) {
    if (mensaje !== esperados.nombre && mensaje !== esperados.correo) {
      expect(screen.queryByText(mensaje)).not.toBeInTheDocument();
    }
  }
}

/** Ni el formulario, ni su encabezado ni el botón de pago. */
function expectSinFormulario() {
  expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(
    screen.queryByRole("button", { name: /Pagar/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Tus datos" }),
  ).not.toBeInTheDocument();
}

/** El texto del aviso de un 409 con esos asientos; el enlace puede ir dentro del aviso o debajo. */
function avisoDeNoDisponibles(lista: string): RegExp {
  return new RegExp(
    `^Estos asientos ya no están disponibles: ${lista}\\s*(Elegir otros asientos)?$`,
  );
}

/** Con el formulario montado: escribe los datos y paga. */
function pagarConLosDatos() {
  escribir(NOMBRE, CORREO);
  pagar();
}

/** El formulario sigue ahí, con lo escrito y el botón de pago habilitado. */
function expectFormularioConLosDatos() {
  expect(campoNombre()).toHaveValue(NOMBRE);
  expect(campoCorreo()).toHaveValue(CORREO);
  expect(screen.getByRole("button", { name: BOTON_PAGAR })).toBeEnabled();
}

function expectAvisoDeFallo() {
  const avisos = screen.getAllByRole("alert");
  expect(avisos).toHaveLength(1);
  expect(avisos[0]).toHaveTextContent(
    /^No pudimos procesar el pago\. Revisa tu conexión e inténtalo de nuevo\.$/,
  );
  return avisos[0];
}

// ---------------------------------------------------------------------------
// CA-7 y CA-8: los campos y el botón
// ---------------------------------------------------------------------------

describe("FormularioCompra: los campos y el botón", () => {
  it("tiene los campos «Nombre completo» y «Correo electrónico» con su etiqueta visible", () => {
    montar();

    expect(
      screen.getByRole("heading", { level: 2, name: "Tus datos" }),
    ).toBeInTheDocument();

    // Cada campo se encuentra por su etiqueta, y esa etiqueta es un texto que se ve.
    const nombre = campoNombre();
    const correo = campoCorreo();
    expect(screen.getByText("Nombre completo")).toBeVisible();
    expect(screen.getByText("Nombre completo").closest("label")).not.toBeNull();
    expect(screen.getByText("Correo electrónico")).toBeVisible();
    expect(
      screen.getByText("Correo electrónico").closest("label"),
    ).not.toBeNull();

    // El nombre es de texto y el correo es de correo, con sus sugerencias del navegador.
    expect(nombre.type).toBe("text");
    expect(nombre).toHaveAttribute("autocomplete", "name");
    expect(correo.type).toBe("email");
    expect(correo).toHaveAttribute("autocomplete", "email");

    // Los dos campos y el botón de pago son de un mismo formulario.
    const boton = screen.getByRole<HTMLButtonElement>("button", {
      name: BOTON_PAGAR,
    });
    expect(boton.type).toBe("submit");
    expect(nombre.form).toBe(formulario());
    expect(correo.form).toBe(formulario());
    expect(boton.form).toBe(formulario());

    // Al cargar están vacíos y sin errores.
    expect(nombre).toHaveValue("");
    expect(correo).toHaveValue("");
    expectErrores({});
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("el botón de pago dice «Pagar $ 30.000» con dos asientos de $ 15.000", () => {
    const { unmount } = montar();

    expect(
      screen.getByRole("button", { name: "Pagar $ 30.000" }),
    ).toBeEnabled();
    unmount();

    // El total sale de la compra: tres asientos de $ 8.000.
    const segundo = montar({ asientos: ["C1", "C2", "C3"], total: 24000 });

    expect(
      screen.getByRole("button", { name: "Pagar $ 24.000" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Pagar $ 30.000" }),
    ).not.toBeInTheDocument();
    segundo.unmount();

    // Un precio de cuatro cifras también lleva punto de miles.
    montar({ asientos: ["D4"], total: 8000 });

    expect(screen.getByRole("button", { name: "Pagar $ 8.000" })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// CA-7: los errores de campo
// ---------------------------------------------------------------------------

describe("FormularioCompra: los errores de campo", () => {
  it("al pagar con un campo vacío o un correo inválido muestra el error junto al campo, le da el foco y no envía la compra", () => {
    // Los dos vacíos: los dos errores, y el foco en el primero (el nombre).
    const vacios = montar();
    pagar();

    expectErrores({ nombre: NOMBRE_VACIO, correo: CORREO_VACIO });
    expect(campoNombre()).toHaveFocus();
    // El error del nombre está pegado a su campo: va antes del campo del correo.
    expectAntes(screen.getByText(NOMBRE_VACIO), campoCorreo());
    expect(fetchMock).not.toHaveBeenCalled();
    // No se pasó a procesar: el botón sigue siendo el de pago.
    expect(screen.getByRole("button", { name: BOTON_PAGAR })).toBeEnabled();
    vacios.unmount();

    // Solo el correo vacío: el nombre escrito queda sin error y el foco pasa al correo.
    const sinCorreo = montar();
    escribir(NOMBRE, "");
    pagar();

    expectErrores({ correo: CORREO_VACIO });
    expect(campoCorreo()).toHaveFocus();
    expect(campoNombre()).toHaveValue(NOMBRE);
    expect(fetchMock).not.toHaveBeenCalled();
    sinCorreo.unmount();

    // Un correo sin dominio: otro mensaje que el del vacío, y el foco en el correo.
    const invalido = montar();
    escribir(NOMBRE, "ana@correo");
    pagar();

    expectErrores({ correo: CORREO_INVALIDO });
    expect(campoCorreo()).toHaveFocus();
    expect(campoCorreo()).toHaveValue("ana@correo");
    expect(fetchMock).not.toHaveBeenCalled();
    invalido.unmount();

    // Solo el nombre vacío, con un correo válido: el foco pasa al nombre.
    const sinNombre = montar();
    escribir("", CORREO);
    pagar();

    expectErrores({ nombre: NOMBRE_VACIO });
    expect(campoNombre()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
    sinNombre.unmount();

    // Un nombre de 101 caracteres: pasa del máximo.
    montar();
    escribir("a".repeat(101), CORREO);
    pagar();

    expectErrores({ nombre: NOMBRE_LARGO });
    expect(campoNombre()).toHaveFocus();
    expect(campoCorreo()).toHaveValue(CORREO);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("valida con sus propias reglas y no con las del navegador: un correo sin arroba también muestra el error junto al campo", () => {
    // El formulario es `noValidate`. Sin eso, el navegador (y jsdom) bloquearía
    // este envío con su propia burbuja y el error de la guía nunca aparecería.
    montar();
    escribir(NOMBRE, "ana.correo.co");
    pagar();

    expectErrores({ correo: CORREO_INVALIDO });
    expect(campoCorreo()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al corregir los campos y volver a pagar, los errores desaparecen y la compra se envía", () => {
    fetchMock.mockReturnValue(respuestaPendiente().promesa);
    montar();

    // Primero, con los dos campos vacíos.
    pagar();
    expectErrores({ nombre: NOMBRE_VACIO, correo: CORREO_VACIO });
    expect(fetchMock).not.toHaveBeenCalled();

    // Se corrige y se vuelve a pagar: ya no hay errores y sale una sola petición.
    escribir(NOMBRE, CORREO);
    pagar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectErrores({});
    expect(campoNombre()).toHaveValue(NOMBRE);
    expect(campoCorreo()).toHaveValue(CORREO);
  });
});

// ---------------------------------------------------------------------------
// CA-8: el pago en curso
// ---------------------------------------------------------------------------

describe("FormularioCompra: el pago en curso", () => {
  it("mientras procesa, el botón queda deshabilitado con «Procesando pago…» y un segundo envío no vuelve a llamar a la API", async () => {
    const pendiente = respuestaPendiente();
    fetchMock.mockReturnValue(pendiente.promesa);
    montar();
    escribir(NOMBRE, CORREO);
    expect(
      screen.getByRole("button", { name: BOTON_PAGAR }),
    ).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();

    pagar();

    // La petición salió, y el botón cambió de texto y quedó deshabilitado.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const procesando = screen.getByRole("button", { name: BOTON_PROCESANDO });
    expect(procesando).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: BOTON_PAGAR }),
    ).not.toBeInTheDocument();

    // Un clic más y dos envíos del formulario (Enter dentro de un campo) no
    // llaman otra vez a la API: la guarda cubre también el envío que no pasa
    // por el botón.
    fireEvent.click(procesando);
    fireEvent.submit(formulario());
    fireEvent.submit(formulario());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: BOTON_PROCESANDO })).toBeDisabled();

    // Al responder, la compra se aprueba y la API se llamó una sola vez.
    pendiente.resolver(aprobada());

    expect(
      await screen.findByRole("heading", { level: 2, name: APROBADA }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("envía por POST a la función del formulario, con sus asientos y el nombre y el correo recortados", () => {
    fetchMock.mockReturnValue(respuestaPendiente().promesa);
    montar({ funcionId: 7, asientos: ["D1", "D2", "D3"], total: 45000 });

    escribir("  Ana Pérez  ", " ana@correo.co ");
    fireEvent.click(screen.getByRole("button", { name: "Pagar $ 45.000" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const llamada = fetchMock.mock.calls[0];
    expect(llamada?.[0]).toBe(`${API_URL}/funciones/7/compras`);
    expect(llamada?.[1]?.method).toBe("POST");
    expect(cuerpoEnviado()).toEqual({
      asientos: ["D1", "D2", "D3"],
      nombre: NOMBRE,
      correo: CORREO,
    });
  });
});

// ---------------------------------------------------------------------------
// CA-9: la compra aprobada
// ---------------------------------------------------------------------------

describe("FormularioCompra: la compra aprobada", () => {
  it("con 201 muestra «¡Compra aprobada!» con el código, los asientos y el total de la respuesta, y le da el foco", async () => {
    // La respuesta trae otros asientos y otro total que los del formulario
    // (A1, A2 y $ 30.000): lo que se muestra es lo que dice la API.
    fetchMock.mockResolvedValue(
      aprobada({ codigo: "K7Q2M9XA", asientos: ["C4", "C5", "C6"], total: 45000 }),
    );
    montar();

    pagarConLosDatos();

    const encabezado = await screen.findByRole("heading", {
      level: 2,
      name: APROBADA,
    });

    // El encabezado recibe el foco: se puede enfocar por programa, sin entrar en el orden de Tab.
    expect(encabezado).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(encabezado).toHaveFocus());
    // Los datos de la compra, de la respuesta y debajo del encabezado.
    expect(paresDeLaConfirmacion()).toEqual([
      ["Código de la compra", "K7Q2M9XA"],
      ["Asientos", "C4, C5, C6"],
      ["Total", "$ 45.000"],
    ]);
    expectAntes(encabezado, screen.getAllByRole("term")[0]);
    // La compra salió una sola vez.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cuerpoEnviado()).toEqual(CUERPO_ESPERADO);
    // El formulario se cambió por la confirmación, y una compra aprobada no es una alerta.
    expectSinFormulario();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Spec 006, T10 (CA-12, D15): «Ver mi boleta» en la confirmación.
  it("con 201 muestra el enlace «Ver mi boleta» a /boletas/{código de la respuesta}, después de los datos, y el foco sigue en «¡Compra aprobada!»", async () => {
    const verMiBoleta = () =>
      screen.queryByRole("link", { name: "Ver mi boleta" });

    // Con asientos que ya no están disponibles, la pantalla es otra y no hay
    // boleta que ver.
    fetchMock.mockResolvedValueOnce(conflicto(["A2"]));
    const noDisponibles = montar();
    pagarConLosDatos();

    await screen.findByRole("alert");
    expect(
      screen.getByRole("link", { name: "Elegir otros asientos" }),
    ).toBeInTheDocument();
    expect(verMiBoleta()).not.toBeInTheDocument();
    noDisponibles.unmount();

    // La primera vez el pago falla y la segunda se aprueba. El código de la
    // respuesta no es el de las otras pruebas ni el de los asientos: el enlace
    // lleva el que dice la API, no uno fijo.
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(aprobada({ codigo: "ZX81QW5T" }));
    montar();

    // Antes de pagar y con el pago que falla, tampoco hay enlace.
    expect(verMiBoleta()).not.toBeInTheDocument();
    pagarConLosDatos();

    await screen.findByRole("alert");
    expectAvisoDeFallo();
    expect(verMiBoleta()).not.toBeInTheDocument();

    pagar();

    const encabezado = await screen.findByRole("heading", {
      level: 2,
      name: APROBADA,
    });
    const enlace = screen.getByRole("link", { name: "Ver mi boleta" });
    expect(enlace).toHaveAttribute("href", "/boletas/ZX81QW5T");

    // Va después de los datos de la compra, y no dentro de la lista: los
    // términos y las definiciones siguen siendo solo los tres de siempre.
    const datos = screen.getAllByRole("term")[0].closest("dl");
    if (datos === null) {
      throw new Error("los términos de la confirmación no están dentro de un <dl>");
    }
    expect(datos).not.toContainElement(enlace);
    expectAntes(datos, enlace);
    expect(paresDeLaConfirmacion()).toEqual([
      ["Código de la compra", "ZX81QW5T"],
      ["Asientos", "A1, A2"],
      ["Total", "$ 30.000"],
    ]);

    // El foco sigue en el encabezado: el enlace es la siguiente parada del Tab,
    // no el lugar donde cae el foco.
    await waitFor(() => expect(encabezado).toHaveFocus());
    expect(enlace).not.toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// CA-10: los asientos que ya no están disponibles
// ---------------------------------------------------------------------------

describe("FormularioCompra: los asientos que ya no están disponibles", () => {
  it("con 409 muestra «Estos asientos ya no están disponibles: A2» y el enlace «Elegir otros asientos» a /funciones/1, sin el formulario", async () => {
    fetchMock.mockResolvedValue(conflicto(["A2"]));
    montar();

    pagarConLosDatos();

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(avisoDeNoDisponibles("A2"));
    // Solo hay un aviso, y no es el del fallo del pago.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
    // El enlace lleva al mapa de la función, y es lo que recibe el foco.
    const enlace = screen.getByRole("link", { name: "Elegir otros asientos" });
    expect(enlace).toHaveAttribute("href", "/funciones/1");
    await waitFor(() => expect(enlace).toHaveFocus());
    // Ya no se puede volver a pagar estos asientos.
    expectSinFormulario();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("con varios asientos no disponibles los lista, son los de la respuesta y no los pedidos, y el enlace lleva a la función del formulario", async () => {
    // Se pidieron A1, A2 y A3, pero la API dice que solo A2 y A3 ya no están.
    fetchMock.mockResolvedValue(conflicto(["A2", "A3"]));
    montar({ funcionId: 7, asientos: ["A1", "A2", "A3"], total: 45000 });

    escribir(NOMBRE, CORREO);
    fireEvent.click(screen.getByRole("button", { name: "Pagar $ 45.000" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      avisoDeNoDisponibles("A2, A3"),
    );
    const enlace = screen.getByRole("link", { name: "Elegir otros asientos" });
    expect(enlace).toHaveAttribute("href", "/funciones/7");
    await waitFor(() => expect(enlace).toHaveFocus());
    expectSinFormulario();
  });

  it("si el 409 no trae la lista de asientos, muestra los asientos pedidos", async () => {
    fetchMock.mockResolvedValue(
      responder(
        {
          statusCode: 409,
          message: "Estos asientos ya no están disponibles: A2",
          error: "Conflict",
        },
        409,
      ),
    );
    montar({ funcionId: 3, asientos: ["B1", "B2"], total: 30000 });

    pagarConLosDatos();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      avisoDeNoDisponibles("B1, B2"),
    );
    expect(
      screen.getByRole("link", { name: "Elegir otros asientos" }),
    ).toHaveAttribute("href", "/funciones/3");
    expectSinFormulario();
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CA-12: el pago que falla
// ---------------------------------------------------------------------------

describe("FormularioCompra: el pago que falla", () => {
  it('si el backend no responde muestra un aviso con role="alert", conserva los datos y deja pagar de nuevo sin escribirlos', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(aprobada());
    montar();

    pagarConLosDatos();

    // El aviso, con el texto exacto, encima del botón de pago.
    const aviso = await screen.findByRole("alert");
    expect(expectAvisoDeFallo()).toBe(aviso);
    expectAntes(aviso, screen.getByRole("button", { name: BOTON_PAGAR }));
    // El formulario sigue con lo escrito y el botón vuelve a estar habilitado.
    expectFormularioConLosDatos();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("heading", { name: APROBADA }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Elegir otros asientos" }),
    ).not.toBeInTheDocument();

    // Se vuelve a pagar sin escribir nada: sale la misma compra y, ahora, se aprueba.
    pagar();

    expect(
      await screen.findByRole("heading", { level: 2, name: APROBADA }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cuerpoEnviado(0)).toEqual(CUERPO_ESPERADO);
    expect(cuerpoEnviado(1)).toEqual(CUERPO_ESPERADO);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(paresDeLaConfirmacion()).toEqual([
      ["Código de la compra", "K7Q2M9XA"],
      ["Asientos", "A1, A2"],
      ["Total", "$ 30.000"],
    ]);
  });

  it("con un 400 inesperado muestra el aviso de fallo y conserva los datos", async () => {
    fetchMock.mockResolvedValue(
      responder(
        {
          statusCode: 400,
          message: "El asiento Z9 no existe en el lugar",
          error: "Bad Request",
        },
        400,
      ),
    );
    montar();

    pagarConLosDatos();

    await screen.findByRole("alert");
    expectAvisoDeFallo();
    expectFormularioConLosDatos();
    // El mensaje de la API no se muestra: solo el aviso de la guía.
    expect(
      screen.queryByText("El asiento Z9 no existe en el lugar"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: APROBADA }),
    ).not.toBeInTheDocument();
  });

  const otrosFallos: Array<{ status: number; cuerpo: unknown }> = [
    {
      status: 404,
      cuerpo: {
        statusCode: 404,
        message: "La función 1 no existe",
        error: "Not Found",
      },
    },
    {
      status: 500,
      cuerpo: {
        statusCode: 500,
        message: "Internal server error",
        error: "Internal Server Error",
      },
    },
  ];

  it.each(otrosFallos)(
    "con un $status también muestra el aviso de fallo y conserva los datos",
    async ({ status, cuerpo }) => {
      fetchMock.mockResolvedValue(responder(cuerpo, status));
      montar();

      pagarConLosDatos();

      await screen.findByRole("alert");
      expectAvisoDeFallo();
      expectFormularioConLosDatos();
      expect(
        screen.queryByRole("link", { name: "Elegir otros asientos" }),
      ).not.toBeInTheDocument();
    },
  );

  it("el aviso de fallo desaparece al volver a intentar", async () => {
    const segundoIntento = respuestaPendiente();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockReturnValueOnce(segundoIntento.promesa);
    montar();

    pagarConLosDatos();
    await screen.findByRole("alert");
    expectAvisoDeFallo();

    // Mientras el segundo intento no responde, ya no está el aviso del primero.
    pagar();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(FALLO)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: BOTON_PROCESANDO })).toBeDisabled();

    // Si el segundo intento también falla, el aviso vuelve a aparecer.
    segundoIntento.rechazar(new TypeError("Failed to fetch"));

    await screen.findByRole("alert");
    expectAvisoDeFallo();
    expectFormularioConLosDatos();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
