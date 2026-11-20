import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapaAsientos from "@/components/MapaAsientos";
import type { Asiento } from "@/lib/funciones";

const FILAS = ["A", "B", "C", "D", "E"];

// Los ocupados de la función 5 de los datos de ejemplo (D6 del plan): la fila A
// mezclada, los dos extremos de la C y el último asiento del lugar.
const OCUPADOS_FUNCION_5 = ["A3", "A4", "C1", "C8", "D5", "E8"];

/** Los 40 asientos de la función 5, en el orden en que los responde la API: A1…A8, B1…B8, …, E1…E8. */
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

/** «A1» → «Fila A, asiento 1, disponible»; «A3» → «Fila A, asiento 3, ocupado». */
function nombreDe(id: string): string {
  const estado = OCUPADOS_FUNCION_5.includes(id) ? "ocupado" : "disponible";
  return `Fila ${id.slice(0, 1)}, asiento ${id.slice(1)}, ${estado}`;
}

/** Monta el mapa de la función 5 (precio de 25.000) salvo que se indique otra cosa. */
function montar(opciones: { funcionId?: number; precio?: number } = {}) {
  const { funcionId = 5, precio = 25000 } = opciones;
  return render(
    <MapaAsientos
      funcionId={funcionId}
      precio={precio}
      asientos={asientosDeLaFuncion5()}
    />,
  );
}

/** El asiento por su nombre accesible; con `pressed`, solo si está en ese estado. */
function boton(id: string, pressed?: boolean): HTMLElement {
  return screen.getByRole(
    "button",
    pressed === undefined
      ? { name: nombreDe(id) }
      : { name: nombreDe(id), pressed },
  );
}

/** Pulsa los asientos uno tras otro, en ese orden. */
function pulsar(...ids: string[]) {
  for (const id of ids) fireEvent.click(boton(id));
}

/** Los identificadores de la lista de asientos elegidos, en el orden en que se ven. */
function idsElegidos(): (string | null)[] {
  return screen.queryAllByRole("listitem").map((item) => item.textContent);
}

/** Los asientos que se ven pulsados (`aria-pressed="true"`). */
function pulsados(): HTMLElement[] {
  return screen.queryAllByRole("button", { pressed: true });
}

const AVISO_DEL_MAXIMO = /^Puedes comprar máximo 6 boletas por compra$/;

describe("MapaAsientos: el mapa", () => {
  it("muestra el escenario o la pantalla antes de las filas", () => {
    montar();

    const escenario = screen.getByText("Escenario o pantalla");
    const filaA = screen.getByRole("group", { name: "Fila A" });

    // Va antes de la fila A y, con ella, antes de todas las demás y de todos los asientos.
    expect(
      escenario.compareDocumentPosition(filaA) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const grupo of screen.getAllByRole("group")) {
      expect(
        escenario.compareDocumentPosition(grupo) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // No es una fila ni está dentro de una.
      expect(grupo).not.toContainElement(escenario);
    }
    expect(
      escenario.compareDocumentPosition(boton("A1")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("organiza los asientos en cinco filas de ocho, de la A a la E", () => {
    montar();

    // Cinco grupos, uno por fila, en orden. Si hubiera otro `group` en la pantalla,
    // la lista de todos no coincidiría con la de las cinco filas.
    const filas = FILAS.map((fila) =>
      screen.getByRole("group", { name: `Fila ${fila}` }),
    );
    const grupos = screen.getAllByRole("group");
    expect(grupos).toHaveLength(5);
    grupos.forEach((grupo, indice) => expect(grupo).toBe(filas[indice]));

    // Cada fila tiene ocho botones, del 1 al 8: el texto visible es solo el número.
    FILAS.forEach((fila, indice) => {
      const botones = within(filas[indice]).getAllByRole("button");
      expect(botones).toHaveLength(8);
      expect(botones.map((asiento) => asiento.textContent)).toEqual([
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
      ]);
      expect(botones[0]).toHaveAccessibleName(nombreDe(`${fila}1`));
      expect(botones[7]).toHaveAccessibleName(nombreDe(`${fila}8`));
    });
  });

  it("cada asiento es un botón cuyo nombre accesible dice la fila, el número y el estado", () => {
    montar();

    // Los nombres exactos de tres asientos: libre al inicio de la fila A, ocupado
    // en medio de ella y ocupado al final del lugar.
    expect(
      screen.getByRole("button", { name: "Fila A, asiento 1, disponible" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fila A, asiento 3, ocupado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fila E, asiento 8, ocupado" }),
    ).toBeInTheDocument();

    // Hay 40 asientos, cada uno con un nombre de esa forma: 34 libres y 6 ocupados.
    const asientos = screen.getAllByRole("button", {
      name: /^Fila [A-E], asiento [1-8], (disponible|ocupado)$/,
    });
    expect(asientos).toHaveLength(40);
    expect(screen.getAllByRole("button", { name: /, disponible$/ })).toHaveLength(34);
    const ocupados = screen.getAllByRole("button", { name: /, ocupado$/ });
    expect(ocupados).toHaveLength(6);
    for (const id of OCUPADOS_FUNCION_5) {
      expect(ocupados).toContain(boton(id));
    }
  });
});

describe("MapaAsientos: seleccionar", () => {
  it("al cargar no hay ningún asiento seleccionado ni aviso", () => {
    montar();

    // Ninguno está pulsado: los 40 llevan aria-pressed="false", también los ocupados.
    expect(pulsados()).toHaveLength(0);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(40);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(AVISO_DEL_MAXIMO)).not.toBeInTheDocument();
    // El resumen está vacío.
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    const estado = screen.getByRole("status");
    expect(within(estado).getByText("Aún no has elegido asientos")).toBeInTheDocument();
    expect(within(estado).getByText("Total: $ 0")).toBeInTheDocument();
  });

  it("un asiento ocupado está deshabilitado y al pulsarlo no se selecciona", () => {
    montar();
    const ocupado = screen.getByRole("button", {
      name: "Fila A, asiento 3, ocupado",
    });

    // No es solo el nombre: el control no se puede usar y no está pulsado.
    expect(ocupado).toBeDisabled();
    expect(ocupado).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(ocupado);

    // Sigue sin elegirse: no hay lista, el total es cero y no hay a dónde continuar.
    expect(ocupado).toHaveAttribute("aria-pressed", "false");
    expect(pulsados()).toHaveLength(0);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    const estado = screen.getByRole("status");
    expect(within(estado).getByText("Aún no has elegido asientos")).toBeInTheDocument();
    expect(within(estado).getByText("Total: $ 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Continuar" })).not.toBeInTheDocument();

    // Los seis ocupados de la función 5 son así; los otros 34 se pueden usar.
    for (const id of OCUPADOS_FUNCION_5) {
      expect(boton(id)).toBeDisabled();
      expect(boton(id)).toHaveAttribute("aria-pressed", "false");
    }
    const libres = screen.getAllByRole("button", { name: /, disponible$/ });
    expect(libres).toHaveLength(34);
    for (const libre of libres) expect(libre).toBeEnabled();
  });

  it("al pulsar un asiento disponible queda seleccionado y al pulsarlo otra vez se deselecciona, sin cambiar su nombre", () => {
    montar();
    const nombre = "Fila A, asiento 1, disponible";

    expect(
      screen.getByRole("button", { name: nombre, pressed: false }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: nombre }));

    // Seleccionado: el estado se expone con aria-pressed y el nombre es el mismo.
    const seleccionado = screen.getByRole("button", { name: nombre, pressed: true });
    expect(seleccionado).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: nombre, pressed: false }),
    ).not.toBeInTheDocument();
    // Solo ese asiento cambió.
    expect(pulsados()).toHaveLength(1);
    expect(pulsados()[0]).toBe(seleccionado);
    expect(
      screen.getByRole("button", { name: "Fila A, asiento 2, disponible", pressed: false }),
    ).toBeInTheDocument();

    fireEvent.click(seleccionado);

    // Otro clic lo deselecciona, con el mismo nombre de siempre.
    expect(
      screen.getByRole("button", { name: nombre, pressed: false }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: nombre, pressed: true }),
    ).not.toBeInTheDocument();
    expect(pulsados()).toHaveLength(0);
  });
});

describe("MapaAsientos: la lista y el total", () => {
  it("la lista de asientos elegidos y el total se actualizan con cada cambio", () => {
    const { unmount } = montar();
    const estado = screen.getByRole("status");

    // Elegir A2 y después A1: la lista va en el orden del mapa, no en el de los clics.
    pulsar("A2");
    expect(idsElegidos()).toEqual(["A2"]);
    expect(within(estado).getByText("Total: $ 25.000")).toBeInTheDocument();

    pulsar("A1");
    expect(idsElegidos()).toEqual(["A1", "A2"]);
    expect(within(estado).getByText("Total: $ 50.000")).toBeInTheDocument();
    expect(
      within(estado).queryByText("Aún no has elegido asientos"),
    ).not.toBeInTheDocument();

    // Quitar A2 deja A1.
    pulsar("A2");
    expect(idsElegidos()).toEqual(["A1"]);
    expect(within(estado).getByText("Total: $ 25.000")).toBeInTheDocument();

    // Quitar A1 deja el resumen vacío.
    pulsar("A1");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(within(estado).getByText("Aún no has elegido asientos")).toBeInTheDocument();
    expect(within(estado).getByText("Total: $ 0")).toBeInTheDocument();
    unmount();

    // Con otro precio y tres asientos: el total es el precio de la función por la
    // cantidad, no una cifra fija.
    montar({ precio: 8000 });
    pulsar("A1", "A2", "A5");

    expect(idsElegidos()).toEqual(["A1", "A2", "A5"]);
    expect(
      within(screen.getByRole("status")).getByText("Total: $ 24.000"),
    ).toBeInTheDocument();
  });

  it("la lista y el total están en una región que anuncia los cambios", () => {
    montar();
    pulsar("A1", "A2");

    // Una sola región `status`: getByRole falla si hay más de una.
    const estado = screen.getByRole("status");
    const lista = within(estado).getByRole("list", { name: "Asientos elegidos" });
    expect(
      within(lista).getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["A1", "A2"]);
    expect(within(estado).getByText("Total: $ 50.000")).toBeInTheDocument();
    // El resumen tiene su encabezado.
    expect(
      screen.getByRole("heading", { level: 3, name: "Tu selección" }),
    ).toBeInTheDocument();

    // Vacía, la región sigue ahí con el mensaje y el total en cero: la persona
    // oye también cuando se queda sin asientos.
    pulsar("A1", "A2");
    expect(screen.getByRole("status")).toBe(estado);
    expect(within(estado).getByText("Aún no has elegido asientos")).toBeInTheDocument();
    expect(within(estado).getByText("Total: $ 0")).toBeInTheDocument();
  });
});

describe("MapaAsientos: el máximo de seis asientos", () => {
  // Seis asientos de la función 5: toda la fila A menos los ocupados A3 y A4. El
  // séptimo es B1, de una fila libre.
  const SEIS = ["A1", "A2", "A5", "A6", "A7", "A8"];

  it("al intentar el séptimo asiento aparece «Puedes comprar máximo 6 boletas por compra» y la selección no cambia", () => {
    montar();
    pulsar(...SEIS);

    // Con seis elegidos todavía no hay aviso: el tope es seis, no cinco.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(pulsados()).toHaveLength(6);
    expect(idsElegidos()).toEqual(SEIS);
    const hrefAntes = screen
      .getByRole("link", { name: "Continuar" })
      .getAttribute("href");
    expect(hrefAntes).toBe("/funciones/5/compra?asientos=A1,A2,A5,A6,A7,A8");
    const estado = screen.getByRole("status");
    expect(within(estado).getByText("Total: $ 150.000")).toBeInTheDocument();

    fireEvent.click(boton("B1"));

    // El aviso, con el texto exacto y como alerta.
    expect(screen.getByRole("alert")).toHaveTextContent(AVISO_DEL_MAXIMO);
    // La selección no cambia: B1 sigue sin pulsar, la lista y el total son los mismos.
    expect(boton("B1", false)).toBeInTheDocument();
    expect(pulsados()).toHaveLength(6);
    expect(idsElegidos()).toEqual(SEIS);
    expect(within(estado).getByText("Total: $ 150.000")).toBeInTheDocument();
    // «Continuar» sigue llevando a los mismos seis.
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      hrefAntes,
    );
  });

  it("el aviso del máximo desaparece cuando la selección cambia", () => {
    montar();
    pulsar(...SEIS);
    fireEvent.click(boton("B1"));
    expect(screen.getByRole("alert")).toHaveTextContent(AVISO_DEL_MAXIMO);

    // Otro intento fallido no es un cambio de la selección: el aviso sigue.
    fireEvent.click(boton("B2"));
    expect(screen.getByRole("alert")).toHaveTextContent(AVISO_DEL_MAXIMO);

    // Quitar un asiento sí lo es: el aviso se va y quedan cinco.
    fireEvent.click(boton("A8"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(AVISO_DEL_MAXIMO)).not.toBeInTheDocument();
    expect(idsElegidos()).toEqual(["A1", "A2", "A5", "A6", "A7"]);
    expect(
      within(screen.getByRole("status")).getByText("Total: $ 125.000"),
    ).toBeInTheDocument();

    // Con un lugar libre, B1 ya se puede elegir y no hay aviso. Con seis otra
    // vez, un nuevo intento vuelve a avisar.
    fireEvent.click(boton("B1"));
    expect(boton("B1", true)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(boton("B2"));
    expect(screen.getByRole("alert")).toHaveTextContent(AVISO_DEL_MAXIMO);
  });
});

describe("MapaAsientos: Continuar", () => {
  it("«Continuar» está deshabilitado mientras no hay asientos elegidos", () => {
    montar();

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    // No hay a dónde ir: ningún enlace «Continuar».
    expect(screen.queryByRole("link", { name: "Continuar" })).not.toBeInTheDocument();
  });

  it("con asientos «Continuar» lleva a /funciones/{id}/compra con los asientos elegidos en el orden del mapa", () => {
    const { unmount } = montar();

    // A2 primero y A1 después: la dirección va en el orden del mapa.
    pulsar("A2", "A1");

    const continuar = screen.getByRole("link", { name: "Continuar" });
    expect(continuar).toHaveAttribute("href", "/funciones/5/compra?asientos=A1,A2");
    // El botón deshabilitado ya no está: el enlace lo reemplaza.
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();

    // Cambia con la selección.
    pulsar("B4");
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/funciones/5/compra?asientos=A1,A2,B4",
    );

    // Al quitarlos todos, vuelve el botón deshabilitado y desaparece el enlace.
    pulsar("A1", "A2", "B4");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Continuar" })).not.toBeInTheDocument();
    unmount();

    // La dirección usa la función que recibe, no una fija.
    montar({ funcionId: 10, precio: 8000 });
    pulsar("E1");
    expect(screen.getByRole("link", { name: "Continuar" })).toHaveAttribute(
      "href",
      "/funciones/10/compra?asientos=E1",
    );
  });
});
