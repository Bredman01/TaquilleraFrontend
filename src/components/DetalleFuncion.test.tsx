import { render, screen, within } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";
import DetalleFuncion from "@/components/DetalleFuncion";
import type { FuncionConEvento, ResultadoFuncion } from "@/lib/funciones";

// D8: la cabecera escribe el día y la hora en Colombia sin importar la zona de
// quien ejecuta. Estas pruebas corren con la zona del proceso en Tokio (14 h por
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

// Las funciones 5 y 10 de los datos de ejemplo, tal como las responde
// GET /funciones/:id (contrato del plan, D3). La 5 es de la tarde y de cinco
// cifras de precio; la 10 es de la mañana, con un precio de cuatro cifras.
const funcion5: FuncionConEvento = {
  id: 5,
  eventoId: 4,
  titulo: "Cartas a Medianoche",
  ciudad: "Neiva",
  lugar: "Teatro Municipal de Neiva",
  inicio: "2026-11-21T16:00:00-05:00",
  precio: 25000,
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
// Las 11:30 p. m. del sábado en Colombia, escritas en UTC: ya es domingo 22.
const funcionConInicioEnUtc: FuncionConEvento = {
  ...funcion5,
  inicio: "2026-11-22T04:30:00Z",
};

const con5: ResultadoFuncion = { ok: true, funcion: funcion5 };
const con10: ResultadoFuncion = { ok: true, funcion: funcion10 };
const conInicioEnUtc: ResultadoFuncion = {
  ok: true,
  funcion: funcionConInicioEnUtc,
};
const noEncontrada: ResultadoFuncion = { ok: false, motivo: "no-encontrado" };
const conError: ResultadoFuncion = { ok: false, motivo: "error" };

/** Los pares etiqueta → valor de la lista de datos de la cabecera (`<dl>`). */
function paresDeLaCabecera(): Record<string, string | null> {
  const etiquetas = screen.getAllByRole("term");
  const valores = screen.getAllByRole("definition");

  // Cada etiqueta tiene su valor: ni sobra uno ni falta otro.
  expect(valores).toHaveLength(etiquetas.length);
  return Object.fromEntries(
    etiquetas.map((etiqueta, indice) => [
      etiqueta.textContent,
      valores[indice]?.textContent ?? null,
    ]),
  );
}

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 21 en Colombia y las 12:30 del 22 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-22T03:30:00Z").getHours()).toBe(12);
  });
});

describe("DetalleFuncion", () => {
  it("muestra el título, el día, la hora, el lugar, la ciudad y el precio por boleta", () => {
    const { unmount } = render(<DetalleFuncion resultado={con5} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Cartas a Medianoche" }),
    ).toBeInTheDocument();
    // Los cinco pares del <dl>, cada etiqueta con su valor. El día y la hora son
    // los de Colombia aunque el proceso corra en Tokio.
    expect(paresDeLaCabecera()).toEqual({
      Día: "sábado, 21 de noviembre",
      Hora: "4:00 p. m.",
      Lugar: "Teatro Municipal de Neiva",
      Ciudad: "Neiva",
      "Precio por boleta": "$ 25.000",
    });
    // Una función que carga no es un fallo ni un «no encontrado».
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No encontramos esa función"),
    ).not.toBeInTheDocument();
    unmount();

    // La de la mañana: «a. m.», otro día y un precio de cuatro cifras con punto.
    const segunda = render(<DetalleFuncion resultado={con10} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Del Grano a la Taza" }),
    ).toBeInTheDocument();
    expect(paresDeLaCabecera()).toEqual({
      Día: "domingo, 22 de noviembre",
      Hora: "10:30 a. m.",
      Lugar: "Biblioteca Departamental",
      Ciudad: "Neiva",
      "Precio por boleta": "$ 8.000",
    });
    segunda.unmount();

    // En UTC ya es el domingo 22 a las 4:30 a. m., y en Tokio, las 13:30: en
    // Colombia sigue siendo el sábado 21 a las 11:30 p. m.
    render(<DetalleFuncion resultado={conInicioEnUtc} />);

    const pares = paresDeLaCabecera();
    expect(pares["Día"]).toBe("sábado, 21 de noviembre");
    expect(pares["Hora"]).toBe("11:30 p. m.");
  });

  it("tiene el enlace «Volver a la cartelera» que lleva a la portada", () => {
    // D13: el enlace de arriba es el mismo en los tres estados.
    const { rerender } = render(<DetalleFuncion resultado={con5} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");

    rerender(<DetalleFuncion resultado={noEncontrada} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");

    rerender(<DetalleFuncion resultado={conError} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
  });

  it("si la función no existe muestra «No encontramos esa función» y el enlace a la cartelera", () => {
    render(<DetalleFuncion resultado={noEncontrada} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esa función",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
    // No es un fallo del backend: no debe mostrarse como alerta, ni con la
    // sección de asientos ni con datos de la función.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Elige tus asientos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    // El h1 es el único encabezado.
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it('si no se pudo cargar muestra el encabezado «No pudimos cargar la función» y el aviso con role="alert"', () => {
    render(<DetalleFuncion resultado={conError} />);

    // El nombre del h1 es un prefijo del texto del aviso, así que se busca por
    // rol y con el nombre exacto: `name` con una cadena exige coincidencia
    // completa.
    const encabezado = screen.getByRole("heading", {
      level: 1,
      name: "No pudimos cargar la función",
    });
    const aviso = screen.getByRole("alert");

    // El aviso conserva el texto completo y exacto.
    expect(aviso).toHaveTextContent(
      /^No pudimos cargar la función\. Intenta de nuevo en unos minutos\.$/,
    );
    // El aviso y el encabezado son dos elementos distintos: el aviso no es el
    // h1 ni está dentro de él, ni el h1 dentro del aviso.
    expect(aviso).not.toBe(encabezado);
    expect(encabezado).not.toContainElement(aviso);
    expect(aviso).not.toContainElement(encabezado);
    // El encabezado va primero y el aviso queda debajo.
    expect(
      encabezado.compareDocumentPosition(aviso) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // No se confunde con «no existe» ni pinta la cabecera de una función.
    expect(
      screen.queryByText("No encontramos esa función"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Elige tus asientos" }),
    ).not.toBeInTheDocument();
  });

  it("en los tres estados hay un solo h1", () => {
    // Regla de la guía visual: un solo h1 por página, también en el error y
    // en «no encontrado».
    const { unmount } = render(<DetalleFuncion resultado={con5} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    unmount();

    const segundo = render(<DetalleFuncion resultado={noEncontrada} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    segundo.unmount();

    render(<DetalleFuncion resultado={conError} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("DetalleFuncion con el mapa de asientos", () => {
  // Contenido que las pruebas pasan como `mapa`: solo importa dónde queda.
  const contenido = <p>Contenido de prueba</p>;

  /** Ni la sección «Elige tus asientos» ni su encabezado ni lo que se le pasó. */
  function expectSinSeccionDeAsientos() {
    expect(
      screen.queryByRole("region", { name: "Elige tus asientos" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Elige tus asientos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Contenido de prueba")).not.toBeInTheDocument();
  }

  it("tiene la sección «Elige tus asientos» con su encabezado y lo que recibe", () => {
    render(<DetalleFuncion resultado={con5} mapa={contenido} />);

    const seccion = screen.getByRole("region", { name: "Elige tus asientos" });
    expect(
      within(seccion).getByRole("heading", {
        level: 2,
        name: "Elige tus asientos",
      }),
    ).toBeInTheDocument();
    expect(within(seccion).getByText("Contenido de prueba")).toBeInTheDocument();

    // Los encabezados van en orden: el título de la función y después la sección.
    expect(
      screen
        .getAllByRole("heading")
        .map((encabezado) => `${encabezado.tagName}: ${encabezado.textContent}`),
    ).toEqual(["H1: Cartas a Medianoche", "H2: Elige tus asientos"]);

    // La sección queda debajo de la cabecera: después del último dato del <dl>.
    const ultimoDato = screen.getAllByRole("definition").at(-1);
    expect(ultimoDato).toHaveTextContent("$ 25.000");
    expect(
      (ultimoDato?.compareDocumentPosition(seccion) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("si la función no existe o no se pudo cargar no muestra la sección «Elige tus asientos»", () => {
    // D10 y D13: la sección solo se pinta con función, aunque se pase `mapa`.
    // Se parte de una función que sí la muestra, para que «no aparece» no sea
    // una comprobación vacía.
    const { rerender } = render(
      <DetalleFuncion resultado={con5} mapa={contenido} />,
    );
    expect(
      screen.getByRole("region", { name: "Elige tus asientos" }),
    ).toBeInTheDocument();

    rerender(<DetalleFuncion resultado={noEncontrada} mapa={contenido} />);

    expectSinSeccionDeAsientos();

    rerender(<DetalleFuncion resultado={conError} mapa={contenido} />);

    expectSinSeccionDeAsientos();
    // El único aviso es el de la función, no el de unos asientos.
    expect(screen.getByRole("alert")).toHaveTextContent(
      /^No pudimos cargar la función\. Intenta de nuevo en unos minutos\.$/,
    );
  });
});
