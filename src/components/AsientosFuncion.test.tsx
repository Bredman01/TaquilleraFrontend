import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, describe, expect, it, vi } from "vitest";
import AsientosFuncion from "@/components/AsientosFuncion";
import DetalleFuncion from "@/components/DetalleFuncion";
import type {
  Asiento,
  FuncionConEvento,
  ResultadoAsientos,
} from "@/lib/funciones";

// D8: la composición con `DetalleFuncion` escribe el día y la hora en Colombia
// sin importar la zona de quien ejecuta. Estas pruebas corren con la zona del
// proceso en Tokio (14 h por delante), para que un error de hora local no pase
// en una máquina que está en Colombia.
//
// La zona se asigna con `vi.hoisted`, que Vitest ejecuta antes de evaluar los
// `import`. No puede ir en `beforeAll`: `DetalleFuncion` importa `formato.ts`,
// que crea sus formateadores al cargarse, y uno sin `timeZone` toma entonces la
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

const FILAS = ["A", "B", "C", "D", "E"];

// Los ocupados de la función 5 de los datos de ejemplo (D6 del plan).
const OCUPADOS_FUNCION_5 = ["A3", "A4", "C1", "C8", "D5", "E8"];

/** Los 40 asientos de la función 5, en el orden en que los responde la API. */
function asientosDeLaFuncion5(): Asiento[] {
  return FILAS.flatMap((fila) =>
    Array.from({ length: 8 }, (_, indice): Asiento => {
      const numero = indice + 1;
      const id = `${fila}${numero}`;
      return {
        id,
        fila,
        numero,
        estado: OCUPADOS_FUNCION_5.includes(id) ? "ocupado" : "disponible",
      };
    }),
  );
}

// La función 5 de los datos de ejemplo, tal como la responde GET /funciones/:id.
const funcion5: FuncionConEvento = {
  id: 5,
  eventoId: 4,
  titulo: "Cartas a Medianoche",
  ciudad: "Neiva",
  lugar: "Teatro Municipal de Neiva",
  inicio: "2026-11-21T16:00:00-05:00",
  precio: 25000,
};

const sinAsientos: ResultadoAsientos = { ok: false };
const conAsientos: ResultadoAsientos = {
  ok: true,
  asientos: asientosDeLaFuncion5(),
};

const AVISO_DE_ASIENTOS =
  /^No pudimos cargar los asientos\. Intenta de nuevo en unos minutos\.$/;

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 21 en Colombia y las 12:30 del 22 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-22T03:30:00Z").getHours()).toBe(12);
  });
});

describe("AsientosFuncion", () => {
  it('si los asientos no se pudieron cargar muestra el aviso con role="alert" y ningún asiento', () => {
    render(
      <AsientosFuncion resultado={sinAsientos} funcionId={5} precio={25000} />,
    );

    // El único aviso, con el texto completo y exacto.
    expect(screen.getByRole("alert")).toHaveTextContent(AVISO_DE_ASIENTOS);
    // Ni un asiento ni «Continuar»: ningún botón, ningún enlace, ninguna fila.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("group")).toHaveLength(0);
    expect(screen.queryByText("Escenario o pantalla")).not.toBeInTheDocument();
    // Tampoco un resumen de la selección que no se puede hacer.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument();
  });

  it("con asientos muestra el mapa de la función", () => {
    // Otro número de función y otro precio que los de la función 5: lo que se ve
    // sale de las props, no de valores fijos.
    render(
      <AsientosFuncion resultado={conAsientos} funcionId={7} precio={9000} />,
    );

    // Sin aviso: el mapa cargó.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // El mapa: el escenario, cinco filas y los 40 asientos con su estado.
    expect(screen.getByText("Escenario o pantalla")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(
      screen.getAllByRole("button", {
        name: /^Fila [A-E], asiento [1-8], (disponible|ocupado)$/,
      }),
    ).toHaveLength(40);
    const ocupado = screen.getByRole("button", {
      name: "Fila A, asiento 3, ocupado",
    });
    expect(ocupado).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Fila A, asiento 1, disponible" }),
    ).toBeEnabled();
    // «Continuar» empieza deshabilitado.
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();

    // Y recibe la función y el precio: la dirección y el total salen de ellos.
    fireEvent.click(
      screen.getByRole("button", { name: "Fila B, asiento 2, disponible" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Fila A, asiento 1, disponible" }),
    );
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/funciones/7/compra?asientos=A1,B2",
    );
    expect(
      within(screen.getByRole("status")).getByText("Total: $ 18.000"),
    ).toBeInTheDocument();
  });
});

describe("DetalleFuncion con los asientos que no cargaron", () => {
  it("si los asientos no se pudieron cargar la cabecera se sigue viendo y el aviso queda dentro de la sección «Elige tus asientos»", () => {
    // Así los compone la página: la cabecera con la función y, como `mapa`, los
    // asientos, que fallaron aunque la función sí cargó.
    render(
      <DetalleFuncion
        resultado={{ ok: true, funcion: funcion5 }}
        mapa={
          <AsientosFuncion
            resultado={sinAsientos}
            funcionId={5}
            precio={25000}
          />
        }
      />,
    );

    // La cabecera completa sigue ahí: el h1 y los cinco pares del <dl>.
    const titulo = screen.getByRole("heading", {
      level: 1,
      name: "Cartas a Medianoche",
    });
    const etiquetas = screen.getAllByRole("term");
    const valores = screen.getAllByRole("definition");
    expect(valores).toHaveLength(etiquetas.length);
    expect(
      Object.fromEntries(
        etiquetas.map((etiqueta, indice) => [
          etiqueta.textContent,
          valores[indice]?.textContent ?? null,
        ]),
      ),
    ).toEqual({
      Día: "sábado, 21 de noviembre",
      Hora: "4:00 p. m.",
      Lugar: "Teatro Municipal de Neiva",
      Ciudad: "Neiva",
      "Precio por boleta": "$ 25.000",
    });
    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");

    // El único aviso es el de los asientos, y queda dentro de la sección.
    const aviso = screen.getByRole("alert");
    expect(aviso).toHaveTextContent(AVISO_DE_ASIENTOS);
    const seccion = screen.getByRole("region", { name: "Elige tus asientos" });
    expect(seccion).toContainElement(aviso);
    expect(within(seccion).getByRole("alert")).toBe(aviso);
    // La cabecera queda fuera de la sección: el aviso no la reemplaza.
    expect(seccion).not.toContainElement(titulo);
    // No es el aviso de la función ni un «no encontrada».
    expect(
      screen.queryByText("No pudimos cargar la función"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("No encontramos esa función"),
    ).not.toBeInTheDocument();
    // Sin mapa: ningún asiento y ningún «Continuar».
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
