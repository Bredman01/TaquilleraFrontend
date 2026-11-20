import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import CompraFuncion from "@/components/CompraFuncion";
import { API_URL } from "@/lib/api";
import type { PaginaCompra } from "@/lib/compras";
import type { FuncionConEvento } from "@/lib/funciones";

// Spec 005, T8: la página de compra (D11), con sus cuatro estados. El día y la
// hora se escriben en Colombia sin importar la zona de quien ejecuta (D20): estas
// pruebas corren con la zona del proceso en Tokio (14 h por delante), para que un
// error de hora local no pase en una máquina que está en Colombia.
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

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

// Funciones 1 y 10 de los datos de ejemplo, tal como las responde
// GET /funciones/:id (contrato del plan). La 1 es de la tarde y de cinco cifras
// de precio; la 10 es de la mañana, con un precio de cuatro cifras.
const funcion1: FuncionConEvento = {
  id: 1,
  eventoId: 1,
  titulo: "El Último Faro",
  ciudad: "Neiva",
  lugar: "Cine Club La Gaitana",
  inicio: "2026-11-21T18:00:00-05:00",
  precio: 15000,
};
const funcion10: FuncionConEvento = {
  id: 10,
  eventoId: 8,
  titulo: "Del Grano a la Taza",
  ciudad: "Neiva",
  lugar: "Biblioteca Departamental",
  inicio: "2026-11-22T10:30:00-05:00",
  precio: 8000,
};

// La función 1, con asientos A1 y A2: $ 15.000 × 2.
const lista1: PaginaCompra = {
  estado: "lista",
  funcion: funcion1,
  asientos: ["A1", "A2"],
  total: 30000,
};
// La función 10, con tres asientos: $ 8.000 × 3.
const lista10: PaginaCompra = {
  estado: "lista",
  funcion: funcion10,
  asientos: ["B3", "B4", "B5"],
  total: 24000,
};

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` (vitest.config.ts)
  // deshace el doble al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

/** Los pares término → valor del resumen (`<dl>`), en el orden en que se ven. */
function paresDelResumen(): Array<[string | null, string | null]> {
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
function expectAntes(primero: Element | undefined, segundo: Element) {
  expect(primero).toBeDefined();
  expect(
    (primero?.compareDocumentPosition(segundo) ?? 0) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

/** Ni los campos, ni el botón de pago ni el encabezado del formulario. */
function expectSinFormulario() {
  expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(
    screen.queryByRole("heading", { name: "Tus datos" }),
  ).not.toBeInTheDocument();
}

/** Ni el resumen ni sus datos. */
function expectSinResumen() {
  expect(
    screen.queryByRole("heading", { name: "Resumen" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("term")).not.toBeInTheDocument();
}

function expectEnlaceDeArriba() {
  expect(
    screen.getByRole("link", { name: "Volver a la cartelera" }),
  ).toHaveAttribute("href", "/");
}

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 21 en Colombia y las 12:30 del 22 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-22T03:30:00Z").getHours()).toBe(12);
  });
});

describe("CompraFuncion con la compra lista", () => {
  it("muestra el resumen: evento, día, hora, lugar, asientos y total en pesos", () => {
    const { unmount } = render(<CompraFuncion resultado={lista1} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Tu compra" }),
    ).toBeInTheDocument();
    const resumen = screen.getByRole("heading", { level: 2, name: "Resumen" });

    // Los seis pares del <dl>, en orden. El día y la hora son los de Colombia
    // aunque el proceso corra en Tokio: ahí ya sería el domingo 22 a las 8:00 a. m.
    expect(paresDelResumen()).toEqual([
      ["Evento", "El Último Faro"],
      ["Día", "sábado, 21 de noviembre"],
      ["Hora", "6:00 p. m."],
      ["Lugar", "Cine Club La Gaitana"],
      ["Asientos", "A1, A2"],
      ["Total", "$ 30.000"],
    ]);
    // El resumen es lo primero que se ve: su encabezado va antes de los datos.
    expectAntes(resumen, screen.getAllByRole("term")[0]);

    // Debajo del resumen está el formulario, con sus campos y el botón de pago.
    expect(
      screen
        .getAllByRole("heading")
        .map((encabezado) => `${encabezado.tagName}: ${encabezado.textContent}`),
    ).toEqual(["H1: Tu compra", "H2: Resumen", "H2: Tus datos"]);
    expectAntes(
      screen.getAllByRole("definition").at(-1),
      screen.getByRole("heading", { level: 2, name: "Tus datos" }),
    );
    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pagar $ 30.000" }),
    ).toBeEnabled();
    // Una compra lista no es un fallo ni un «no encontrado».
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    unmount();

    // La de la mañana: «a. m.», otro día, tres asientos y un precio de cuatro cifras.
    render(<CompraFuncion resultado={lista10} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Tu compra" }),
    ).toBeInTheDocument();
    expect(paresDelResumen()).toEqual([
      ["Evento", "Del Grano a la Taza"],
      ["Día", "domingo, 22 de noviembre"],
      ["Hora", "10:30 a. m."],
      ["Lugar", "Biblioteca Departamental"],
      ["Asientos", "B3, B4, B5"],
      ["Total", "$ 24.000"],
    ]);
    // El total del botón es el de la compra.
    expect(
      screen.getByRole("button", { name: "Pagar $ 24.000" }),
    ).toBeEnabled();
  });

  it("tiene arriba el enlace «Volver a la cartelera» que lleva a la portada, antes del título", () => {
    render(<CompraFuncion resultado={lista1} />);

    const enlace = screen.getByRole("link", { name: "Volver a la cartelera" });
    expect(enlace).toHaveAttribute("href", "/");
    expectAntes(
      enlace,
      screen.getByRole("heading", { level: 1, name: "Tu compra" }),
    );
    // Hay un solo h1.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("escribe el día y la hora de Colombia cuando el inicio viene en UTC", () => {
    // En UTC ya es el domingo 22 a las 4:30 a. m., y en Tokio, las 13:30: en
    // Colombia sigue siendo el sábado 21 a las 11:30 p. m.
    render(
      <CompraFuncion
        resultado={{
          ...lista1,
          funcion: { ...funcion1, inicio: "2026-11-22T04:30:00Z" },
        }}
      />,
    );

    const pares = paresDelResumen();
    expect(pares).toContainEqual(["Día", "sábado, 21 de noviembre"]);
    expect(pares).toContainEqual(["Hora", "11:30 p. m."]);
  });

  it("entrega al formulario la función y los asientos de la compra: el pago va a esa función con esos asientos", () => {
    // La compra nunca termina: la prueba solo mira a dónde y con qué sale.
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    render(<CompraFuncion resultado={lista10} />);

    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Ana Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "ana@correo.co" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pagar $ 24.000" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const llamada = fetchMock.mock.calls[0];
    expect(llamada?.[0]).toBe(`${API_URL}/funciones/10/compras`);
    expect(llamada?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(llamada?.[1]?.body))).toEqual({
      asientos: ["B3", "B4", "B5"],
      nombre: "Ana Pérez",
      correo: "ana@correo.co",
    });
  });
});

describe("CompraFuncion sin asientos válidos", () => {
  it("sin asientos válidos muestra «Elige tus asientos primero» y el enlace «Ir al mapa de asientos» a /funciones/1", () => {
    const { rerender } = render(
      <CompraFuncion resultado={{ estado: "sin-asientos", funcionId: 1 }} />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Elige tus asientos primero",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir al mapa de asientos" }),
    ).toHaveAttribute("href", "/funciones/1");
    // El enlace de arriba sigue ahí, y el h1 es el único encabezado.
    expectEnlaceDeArriba();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    // Sin asientos no hay nada que pagar: ni resumen ni formulario ni alerta.
    expectSinResumen();
    expectSinFormulario();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // El enlace lleva al mapa de la función de la dirección, no a una fija.
    rerender(
      <CompraFuncion resultado={{ estado: "sin-asientos", funcionId: 7 }} />,
    );

    expect(
      screen.getByRole("link", { name: "Ir al mapa de asientos" }),
    ).toHaveAttribute("href", "/funciones/7");
  });
});

describe("CompraFuncion cuando la función no existe o no cargó", () => {
  it('muestra «No encontramos esa función» y, si no cargó, «No pudimos cargar la compra» con role="alert"', () => {
    const { rerender } = render(
      <CompraFuncion resultado={{ estado: "no-encontrada" }} />,
    );

    // La función no existe: ni es un fallo del backend (sin alerta) ni muestra
    // resumen o formulario.
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esa función",
      }),
    ).toBeInTheDocument();
    expectEnlaceDeArriba();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expectSinResumen();
    expectSinFormulario();

    rerender(<CompraFuncion resultado={{ estado: "error" }} />);

    // El nombre del h1 es un prefijo del texto del aviso, así que se busca por
    // rol y con el nombre exacto: `name` con una cadena exige coincidencia
    // completa.
    const encabezado = screen.getByRole("heading", {
      level: 1,
      name: "No pudimos cargar la compra",
    });
    const aviso = screen.getByRole("alert");

    // El aviso conserva el texto completo y exacto.
    expect(aviso).toHaveTextContent(
      /^No pudimos cargar la compra\. Intenta de nuevo en unos minutos\.$/,
    );
    // El aviso y el encabezado son dos elementos distintos, y el aviso queda
    // debajo del encabezado.
    expect(aviso).not.toBe(encabezado);
    expect(encabezado).not.toContainElement(aviso);
    expect(aviso).not.toContainElement(encabezado);
    expectAntes(encabezado, aviso);
    // Un solo h1 y el enlace de arriba, sin confundirse con «no existe».
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectEnlaceDeArriba();
    expect(
      screen.queryByRole("heading", { name: "No encontramos esa función" }),
    ).not.toBeInTheDocument();
    expectSinResumen();
    expectSinFormulario();
  });
});
