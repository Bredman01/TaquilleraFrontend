import { render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import FuncionesEvento from "@/components/FuncionesEvento";
import type { Funcion, ResultadoFunciones } from "@/lib/funciones";

// D5: el componente escribe los días y las horas en Colombia sin importar la
// zona de quien ejecuta. Estas pruebas corren con la zona del proceso en Tokio
// (14 h por delante), para que un error de hora local no pase en una máquina
// que está en Colombia.
const zonaOriginal = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Asia/Tokyo";
});

afterAll(() => {
  if (zonaOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = zonaOriginal;
});

// Funciones del evento 4 (Cartas a Medianoche) de los datos de ejemplo del
// backend, en el orden en que las responde la API (contrato del plan). Los ids
// 5, 4 y 3 no coinciden con la posición en la lista ni (salvo la 4) con el
// `eventoId`: un `href` armado con el índice o con el evento no pasa.
const funcionesDelEvento4: Funcion[] = [
  { id: 5, eventoId: 4, inicio: "2026-11-21T16:00:00-05:00", precio: 25000 },
  { id: 4, eventoId: 4, inicio: "2026-11-21T23:30:00-05:00", precio: 25000 },
  { id: 3, eventoId: 4, inicio: "2026-11-22T19:30:00-05:00", precio: 25000 },
];

// Función del evento 8 (Del Grano a la Taza): la única de la mañana y con un
// precio de cuatro cifras.
const funcionesDelEvento8: Funcion[] = [
  { id: 10, eventoId: 8, inicio: "2026-11-22T10:30:00-05:00", precio: 8000 },
];

const conFunciones4: ResultadoFunciones = {
  ok: true,
  funciones: funcionesDelEvento4,
};
const conFunciones8: ResultadoFunciones = {
  ok: true,
  funciones: funcionesDelEvento8,
};
const sinFunciones: ResultadoFunciones = { ok: true, funciones: [] };
const conError: ResultadoFunciones = { ok: false };

/** Una expresión que busca el texto tal cual, sin interpretar sus puntos ni el signo `$`. */
function textoLiteral(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 21 en Colombia y las 12:30 del 22 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-22T03:30:00Z").getHours()).toBe(12);
  });
});

describe("FuncionesEvento", () => {
  it("agrupa las funciones por día, en orden, con el día escrito en español", () => {
    render(<FuncionesEvento resultado={conFunciones4} />);

    // Un h3 por día, en orden. La función de las 11:30 p. m. (en UTC ya es el
    // domingo) queda en el sábado.
    const dias = screen
      .getAllByRole("heading", { level: 3 })
      .map((encabezado) => encabezado.textContent);
    expect(dias).toEqual(["sábado, 21 de noviembre", "domingo, 22 de noviembre"]);

    // Una lista por día, con el nombre del día, y en cada lista sus enlaces.
    expect(screen.getAllByRole("list")).toHaveLength(2);
    const sabado = screen.getByRole("list", { name: "sábado, 21 de noviembre" });
    const domingo = screen.getByRole("list", {
      name: "domingo, 22 de noviembre",
    });

    const enlacesDelSabado = within(sabado).getAllByRole("link");
    expect(enlacesDelSabado).toHaveLength(2);
    expect(enlacesDelSabado[0]).toHaveAccessibleName(
      "sábado, 21 de noviembre, 4:00 p. m., $ 25.000",
    );
    expect(enlacesDelSabado[1]).toHaveAccessibleName(
      "sábado, 21 de noviembre, 11:30 p. m., $ 25.000",
    );

    const enlacesDelDomingo = within(domingo).getAllByRole("link");
    expect(enlacesDelDomingo).toHaveLength(1);
    expect(enlacesDelDomingo[0]).toHaveAccessibleName(
      "domingo, 22 de noviembre, 7:30 p. m., $ 25.000",
    );
  });

  it("cada función muestra la hora en 12 horas y el precio en pesos", () => {
    const { unmount } = render(<FuncionesEvento resultado={conFunciones4} />);

    // Las tres funciones del evento 4, dentro de su propio enlace.
    const esperadas: Array<[string, string, string]> = [
      ["sábado, 21 de noviembre, 4:00 p. m., $ 25.000", "4:00 p. m.", "$ 25.000"],
      [
        "sábado, 21 de noviembre, 11:30 p. m., $ 25.000",
        "11:30 p. m.",
        "$ 25.000",
      ],
      [
        "domingo, 22 de noviembre, 7:30 p. m., $ 25.000",
        "7:30 p. m.",
        "$ 25.000",
      ],
    ];
    for (const [nombre, hora, precio] of esperadas) {
      const enlace = screen.getByRole("link", { name: nombre });

      expect(
        within(enlace).getByText(textoLiteral(hora)),
        `hora visible en «${nombre}»`,
      ).toBeVisible();
      expect(
        within(enlace).getByText(textoLiteral(precio)),
        `precio visible en «${nombre}»`,
      ).toBeVisible();
    }
    unmount();

    // La de la mañana, con «a. m.» y un precio de cuatro cifras con su punto.
    render(<FuncionesEvento resultado={conFunciones8} />);

    const enlace = screen.getByRole("link", {
      name: "domingo, 22 de noviembre, 10:30 a. m., $ 8.000",
    });
    expect(within(enlace).getByText(textoLiteral("10:30 a. m."))).toBeVisible();
    expect(within(enlace).getByText(textoLiteral("$ 8.000"))).toBeVisible();
  });

  it("cada función es un enlace a /funciones/{id} cuyo nombre accesible incluye el día y la hora", () => {
    const { unmount } = render(<FuncionesEvento resultado={conFunciones4} />);

    // Tantos enlaces como funciones, y ninguno más.
    expect(screen.getAllByRole("link")).toHaveLength(funcionesDelEvento4.length);

    expect(
      screen.getByRole("link", {
        name: "sábado, 21 de noviembre, 4:00 p. m., $ 25.000",
      }),
    ).toHaveAttribute("href", "/funciones/5");
    expect(
      screen.getByRole("link", {
        name: "sábado, 21 de noviembre, 11:30 p. m., $ 25.000",
      }),
    ).toHaveAttribute("href", "/funciones/4");
    expect(
      screen.getByRole("link", {
        name: "domingo, 22 de noviembre, 7:30 p. m., $ 25.000",
      }),
    ).toHaveAttribute("href", "/funciones/3");
    unmount();

    // Un evento con una sola función: el id sale de la función, no del evento.
    render(<FuncionesEvento resultado={conFunciones8} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(
      screen.getByRole("link", {
        name: "domingo, 22 de noviembre, 10:30 a. m., $ 8.000",
      }),
    ).toHaveAttribute("href", "/funciones/10");
  });

  it("si el evento no tiene funciones muestra «No hay funciones programadas»", () => {
    render(<FuncionesEvento resultado={sinFunciones} />);

    expect(screen.getByText("No hay funciones programadas")).toBeInTheDocument();
    // Un evento sin funciones no es un fallo: ni enlaces ni alerta. La salida
    // es el enlace «Volver a la cartelera» de la ficha, que está arriba.
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('si las funciones no se pudieron cargar muestra el aviso con role="alert"', () => {
    render(<FuncionesEvento resultado={conError} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /^No pudimos cargar las funciones\. Intenta de nuevo en unos minutos\.$/,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    // No se confunde con un evento sin funciones.
    expect(
      screen.queryByText("No hay funciones programadas"),
    ).not.toBeInTheDocument();
  });
});
