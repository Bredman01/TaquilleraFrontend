import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import VistaBoleta from "@/components/VistaBoleta";
import { API_URL } from "@/lib/api";
import type { Boleta, ResultadoBoleta } from "@/lib/boletas";
import { matrizQr, trazoQr } from "@/lib/qr";

// Spec 006, T8: la página de la boleta (D12), con sus tres estados: la boleta, «no
// encontrada» y «error». Es un componente de servidor y síncrono: recibe el
// resultado de `getBoleta` y el origen de la petición, y no lee nada por su cuenta.
// Monta el `IngresoBoleta` y el `CodigoQr` de verdad; `fetch` se simula, aunque
// solo la prueba que pulsa «Validar ingreso» lo usa.
//
// El día y la hora se escriben en Colombia sin importar la zona de quien ejecuta
// (D19): estas pruebas corren con la zona del proceso en Tokio (14 h por delante),
// para que un error de hora local no pase en una máquina que está en Colombia.
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

/** La boleta del contrato del plan: A nombre de Ana Pérez, función del domingo 22 a las 3:00 p. m. */
const DATOS = {
  codigo: "K7Q2M9XA",
  titulo: "El Último Faro",
  inicio: "2026-11-22T15:00:00-05:00",
  lugar: "Cine Club La Gaitana",
  ciudad: "Neiva",
  asientos: ["D1", "D2"],
  nombre: "Ana Pérez",
};
type Datos = typeof DATOS;

const CODIGO = DATOS.codigo;
const CORREO = "ana@correo.co";
const ORIGEN = "http://localhost:3000";

/** Lo que ve quien abre la boleta K7Q2M9XA: los ocho datos de la lista y el estado. */
const PARES_DE_LA_BOLETA = [
  ["Evento", "El Último Faro"],
  ["Día", "domingo, 22 de noviembre"],
  ["Hora", "3:00 p. m."],
  ["Lugar", "Cine Club La Gaitana"],
  ["Ciudad", "Neiva"],
  ["Asientos", "D1, D2"],
  ["A nombre de", "Ana Pérez"],
  ["Código", "K7Q2M9XA"],
];
const ESTADO_VALIDA = ["Estado", "Válida"];

/**
 * Cerca de la medianoche en UTC: ya es el lunes 23 a las 3:30 a. m. en UTC y a las
 * 12:30 p. m. en Tokio, pero en Colombia sigue siendo el domingo 22 a las 10:30 p. m.
 */
const USO_CERCA_DE_LA_MEDIANOCHE = "2026-11-23T03:30:00Z";

/** Una boleta válida de la función de la tarde, salvo lo que cambie la prueba. */
function valida(cambios: Partial<Datos> = {}): Boleta {
  return { ...DATOS, ...cambios, estado: "valida", fechaUso: null };
}

/** La misma boleta, ya usada en `fechaUso`. */
function usada(fechaUso: string, cambios: Partial<Datos> = {}): Boleta {
  return { ...DATOS, ...cambios, estado: "usada", fechaUso };
}

function conBoleta(boleta: Boleta): ResultadoBoleta {
  return { ok: true, boleta };
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` (vitest.config.ts)
  // deshace el doble al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
});

// ---------------------------------------------------------------------------
// Ayudas de la pantalla
// ---------------------------------------------------------------------------

/**
 * Los pares término → valor de todas las listas de datos (`<dl>`) de la página,
 * en el orden en que se ven: la de la boleta y, después, la del estado.
 */
function paresDeLaPagina(): Array<[string | null, string | null]> {
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

function elQr(codigo = CODIGO) {
  return screen.getByRole("img", { name: `Código QR de la boleta ${codigo}` });
}

function expectEnlaceDeArriba() {
  const enlace = screen.getByRole("link", { name: "Volver a la cartelera" });
  expect(enlace).toHaveAttribute("href", "/");
  return enlace;
}

/** Ni la lista de datos, ni el título de ingreso, ni el QR, ni el botón de validar. */
function expectSinBoleta() {
  expect(screen.queryByRole("term")).not.toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Tu boleta" }),
  ).not.toBeInTheDocument();
  // El título de la sección de ingreso (B4): sin boleta no hay ninguno.
  expect(
    screen.queryByRole("heading", { name: "Ingreso" }),
  ).not.toBeInTheDocument();
}

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 22 en Colombia y las 12:30 del 23 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-23T03:30:00Z").getHours()).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// CA-6: lo que se ve
// ---------------------------------------------------------------------------

describe("VistaBoleta con la boleta", () => {
  it("muestra el evento, el día, la hora, el lugar, la ciudad, los asientos, el nombre y el código", () => {
    // La boleta lleva un campo de más, el correo: aunque llegara, no se pinta.
    const conCorreo = Object.assign({}, valida(), { correo: CORREO });
    const { unmount } = render(
      <VistaBoleta resultado={conBoleta(conCorreo)} origen={ORIGEN} />,
    );

    // El único h1 es «Tu boleta».
    expect(
      screen.getByRole("heading", { level: 1, name: "Tu boleta" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // Los ocho datos, en orden, y después el estado de la boleta. El día y la hora
    // son los de Colombia aunque el proceso corra en Tokio: ahí ya sería el
    // lunes 23 a las 5:00 a. m.
    expect(paresDeLaPagina()).toEqual([...PARES_DE_LA_BOLETA, ESTADO_VALIDA]);
    // Sin el correo: ni como dato ni como texto suelto, ni ningún texto con «@».
    expect(screen.queryByText(CORREO)).not.toBeInTheDocument();
    expect(screen.queryByText("Correo")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("@");
    // Una boleta válida no es un fallo ni un «no encontrada», y no pide nada a la API.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();

    // Otra boleta: lo que se muestra es lo que dice la boleta, y los asientos van en
    // el orden de la compra, no ordenados.
    render(
      <VistaBoleta
        resultado={conBoleta(
          valida({
            codigo: "ZX81QW5T",
            titulo: "Del Grano a la Taza",
            inicio: "2026-11-22T10:30:00-05:00",
            lugar: "Biblioteca Departamental",
            ciudad: "Pitalito",
            asientos: ["B5", "B3", "B4"],
            nombre: "Luis Gómez",
          }),
        )}
        origen={ORIGEN}
      />,
    );

    expect(paresDeLaPagina()).toEqual([
      ["Evento", "Del Grano a la Taza"],
      ["Día", "domingo, 22 de noviembre"],
      ["Hora", "10:30 a. m."],
      ["Lugar", "Biblioteca Departamental"],
      ["Ciudad", "Pitalito"],
      ["Asientos", "B5, B3, B4"],
      ["A nombre de", "Luis Gómez"],
      ["Código", "ZX81QW5T"],
      ESTADO_VALIDA,
    ]);
  });

  it("escribe el día y la hora de Colombia cuando el inicio viene en UTC", () => {
    // En UTC es el domingo 22 a las 8:00 p. m. y en Tokio, el lunes 23 a las 5:00
    // a. m.: en Colombia son las 3:00 p. m. del domingo 22.
    const { unmount } = render(
      <VistaBoleta
        resultado={conBoleta(valida({ inicio: "2026-11-22T20:00:00Z" }))}
        origen={ORIGEN}
      />,
    );

    let pares = paresDeLaPagina();
    expect(pares).toContainEqual(["Día", "domingo, 22 de noviembre"]);
    expect(pares).toContainEqual(["Hora", "3:00 p. m."]);
    unmount();

    // En UTC ya es el domingo 22 a las 4:30 a. m., y en Tokio, las 13:30: en
    // Colombia sigue siendo el sábado 21 a las 11:30 p. m.
    render(
      <VistaBoleta
        resultado={conBoleta(valida({ inicio: "2026-11-22T04:30:00Z" }))}
        origen={ORIGEN}
      />,
    );

    pares = paresDeLaPagina();
    expect(pares).toContainEqual(["Día", "sábado, 21 de noviembre"]);
    expect(pares).toContainEqual(["Hora", "11:30 p. m."]);
  });

  // -------------------------------------------------------------------------
  // CA-7: el código QR
  // -------------------------------------------------------------------------

  it("el QR lleva la dirección de la página con el origen de la petición: con «http://localhost:3000» mide 37 de lado y con «http://192.168.10.100:3000», 41", () => {
    // La dirección de la boleta K7Q2M9XA mide 38 bytes desde localhost (QR de
    // 29 × 29, svg de 37) y 43 desde la red local (33 × 33, svg de 41). Si solo
    // llevara la ruta `/boletas/K7Q2M9XA` (17 bytes), el svg mediría 33 en los dos.
    const casos = [
      { origen: "http://localhost:3000", lado: 37 },
      { origen: "http://192.168.10.100:3000", lado: 41 },
    ];

    for (const { origen, lado } of casos) {
      const { unmount } = render(
        <VistaBoleta resultado={conBoleta(valida())} origen={origen} />,
      );

      // La imagen lleva el código de la boleta en su nombre y es la única.
      const qr = elQr();
      expect(screen.getAllByRole("img")).toHaveLength(1);
      expect(qr.getAttribute("viewBox"), `viewBox con ${origen}`).toBe(
        `0 0 ${lado} ${lado}`,
      );
      // Y su trazo es el de esa dirección exacta: el origen, `/boletas/` y el código.
      expect(qr.querySelector("path")?.getAttribute("d")).toBe(
        trazoQr(matrizQr(`${origen}/boletas/${CODIGO}`)),
      );
      unmount();
    }
  });

  it("sin origen no dibuja el QR y muestra lo demás", () => {
    const { container } = render(
      <VistaBoleta resultado={conBoleta(valida())} origen={null} />,
    );

    // Ni el QR ni nada que lo remplace.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    // Lo demás sigue ahí: el título, los datos, el estado y el botón para validar.
    expect(
      screen.getByRole("heading", { level: 1, name: "Tu boleta" }),
    ).toBeInTheDocument();
    expect(paresDeLaPagina()).toEqual([...PARES_DE_LA_BOLETA, ESTADO_VALIDA]);
    expect(
      screen.getByRole("button", { name: "Validar ingreso" }),
    ).toBeEnabled();
    expectEnlaceDeArriba();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tiene arriba «Volver a la cartelera», antes del título", () => {
    render(<VistaBoleta resultado={conBoleta(valida())} origen={ORIGEN} />);

    const enlace = expectEnlaceDeArriba();
    expectAntes(
      enlace,
      screen.getByRole("heading", { level: 1, name: "Tu boleta" }),
    );
    // Y antes de los datos, del QR y del botón.
    expectAntes(enlace, screen.getAllByRole("term")[0] as HTMLElement);
    expectAntes(enlace, elQr());
    expectAntes(enlace, screen.getByRole("button", { name: "Validar ingreso" }));
  });

  // -------------------------------------------------------------------------
  // CA-6 y CA-9: el estado, que pinta IngresoBoleta
  // -------------------------------------------------------------------------

  it("pasa el código, el estado y la fecha de uso a IngresoBoleta", () => {
    // Una boleta usada: «Usada» con el día y la hora de Colombia, y sin el botón.
    const { unmount } = render(
      <VistaBoleta
        resultado={conBoleta(usada(USO_CERCA_DE_LA_MEDIANOCHE))}
        origen={ORIGEN}
      />,
    );

    // El título de la sección es «Ingreso» (B4); «Estado» es solo el término de la
    // lista, que no es un encabezado.
    expect(
      screen.getByRole("heading", { level: 2, name: "Ingreso" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Estado" }),
    ).not.toBeInTheDocument();
    expect(paresDeLaPagina().slice(-3)).toEqual([
      ["Estado", "Usada"],
      ["Día de uso", "domingo, 22 de noviembre"],
      ["Hora de uso", "10:30 p. m."],
    ]);
    expect(
      screen.queryByRole("button", { name: "Validar ingreso" }),
    ).not.toBeInTheDocument();
    unmount();

    // Una válida: «Válida», sin día ni hora de uso, y el botón. Al pulsarlo, valida
    // la boleta de esta página (la petición nunca termina: solo importa adónde sale).
    fetchMock.mockReturnValue(new Promise<Response>(() => {}));
    render(
      <VistaBoleta
        resultado={conBoleta(valida({ codigo: "ZX81QW5T" }))}
        origen={ORIGEN}
      />,
    );

    // También con una boleta válida: el título es «Ingreso», no «Estado».
    expect(
      screen.getByRole("heading", { level: 2, name: "Ingreso" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Estado" }),
    ).not.toBeInTheDocument();
    expect(paresDeLaPagina().slice(-1)).toEqual([ESTADO_VALIDA]);
    expect(screen.queryByText("Día de uso")).not.toBeInTheDocument();
    expect(screen.queryByText("Hora de uso")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Validar ingreso" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const llamada = fetchMock.mock.calls[0];
    expect(llamada?.[0]).toBe(`${API_URL}/boletas/ZX81QW5T/ingreso`);
    expect(llamada?.[1]?.method).toBe("POST");
  });
});

// ---------------------------------------------------------------------------
// CA-8: la boleta no existe
// ---------------------------------------------------------------------------

describe("VistaBoleta cuando la boleta no existe", () => {
  it("si la boleta no existe muestra «No encontramos una boleta con ese código» como único h1 y el enlace «Volver a la cartelera»", () => {
    render(
      <VistaBoleta
        resultado={{ ok: false, motivo: "no-encontrada" }}
        origen={ORIGEN}
      />,
    );

    const titulo = screen.getByRole("heading", {
      level: 1,
      name: "No encontramos una boleta con ese código",
    });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // El enlace de arriba lleva a la portada y va antes del título.
    expectAntes(expectEnlaceDeArriba(), titulo);
    // Que la boleta no exista no es un fallo: sin alerta, y sin nada de una boleta.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expectSinBoleta();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sin criterio: la boleta no cargó (D12)
// ---------------------------------------------------------------------------

describe("VistaBoleta cuando la boleta no cargó", () => {
  it('si no cargó muestra «No pudimos cargar la boleta» con role="alert"', () => {
    render(
      <VistaBoleta resultado={{ ok: false, motivo: "error" }} origen={ORIGEN} />,
    );

    // El nombre del h1 es un prefijo del texto del aviso, así que se busca por rol
    // y con el nombre exacto: `name` con una cadena exige coincidencia completa.
    const titulo = screen.getByRole("heading", {
      level: 1,
      name: "No pudimos cargar la boleta",
    });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    // El aviso conserva el texto completo y exacto, y es otro elemento que el título.
    const avisos = screen.getAllByRole("alert");
    expect(avisos).toHaveLength(1);
    const aviso = avisos[0] as HTMLElement;
    expect(aviso.textContent).toBe(
      "No pudimos cargar la boleta. Intenta de nuevo en unos minutos.",
    );
    expect(aviso).not.toBe(titulo);
    expectAntes(expectEnlaceDeArriba(), titulo);
    expectSinBoleta();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
