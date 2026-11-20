import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FiltrosCartelera from "@/components/FiltrosCartelera";

// Ciudades de los datos de ejemplo del backend, como las responde
// GET /eventos/ciudades: sin repetir y en orden alfabético del español.
const CIUDADES = ["Bogotá", "Íquira", "Neiva", "Pitalito"];

/** Los filtros son `<select>` nativos, que Testing Library expone como `combobox`. */
function desplegable(nombre: "Categoría" | "Ciudad"): HTMLSelectElement {
  return screen.getByRole("combobox", { name: nombre }) as HTMLSelectElement;
}

function opcionesDe(control: HTMLSelectElement): HTMLOptionElement[] {
  return within(control).getAllByRole("option") as HTMLOptionElement[];
}

function formularioDe(control: HTMLSelectElement): HTMLFormElement {
  const formulario = control.form;
  if (!formulario) {
    throw new Error("El desplegable no está dentro de un formulario");
  }
  return formulario;
}

/**
 * El filtro «Fecha» es un `<input type="date">`, que no tiene un rol ARIA propio
 * en Testing Library: se busca por su etiqueta visible.
 */
function campoFecha(): HTMLInputElement {
  return screen.getByLabelText("Fecha") as HTMLInputElement;
}

/** Los datos del formulario como los enviaría el navegador: la consulta de la dirección. */
function consultaDe(formulario: HTMLFormElement): string {
  return new URLSearchParams(
    Array.from(new FormData(formulario).entries(), ([clave, valor]) => [
      clave,
      String(valor),
    ]),
  ).toString();
}

describe("FiltrosCartelera", () => {
  it("el filtro «Categoría» ofrece Todas, Cine, Teatro, Concierto y Charla", () => {
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    const opciones = opcionesDe(desplegable("Categoría"));

    // CA-8: en ese orden, con el valor que viaja en la dirección.
    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      "Todas",
      "Cine",
      "Teatro",
      "Concierto",
      "Charla",
    ]);
    expect(opciones.map((opcion) => opcion.value)).toEqual([
      "",
      "cine",
      "teatro",
      "concierto",
      "charla",
    ]);
  });

  it("el filtro «Ciudad» ofrece Todas y las ciudades recibidas, en ese orden", () => {
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    const opciones = opcionesDe(desplegable("Ciudad"));

    // «Íquira» queda donde la entrega el backend: el componente no reordena.
    expect(opciones.map((opcion) => opcion.textContent)).toEqual([
      "Todas",
      "Bogotá",
      "Íquira",
      "Neiva",
      "Pitalito",
    ]);
    expect(opciones.map((opcion) => opcion.value)).toEqual([
      "",
      "Bogotá",
      "Íquira",
      "Neiva",
      "Pitalito",
    ]);
  });

  it("sin filtros los dos desplegables marcan «Todas»", () => {
    // Sin criterio propio: es el estado de la portada (`/`) y el de una
    // categoría o ciudad que no existen (CA-11).
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    expect(desplegable("Categoría")).toHaveValue("");
    expect(desplegable("Categoría")).toHaveDisplayValue("Todas");
    expect(desplegable("Ciudad")).toHaveValue("");
    expect(desplegable("Ciudad")).toHaveDisplayValue("Todas");
  });

  it("marca la categoría y la ciudad recibidas", () => {
    const { unmount } = render(
      <FiltrosCartelera
        ciudades={CIUDADES}
        filtros={{ categoria: "teatro", ciudad: "Neiva" }}
      />,
    );

    // CA-9: al abrir /?categoria=teatro&ciudad=Neiva los filtros salen marcados.
    expect(desplegable("Categoría")).toHaveValue("teatro");
    expect(desplegable("Categoría")).toHaveDisplayValue("Teatro");
    expect(desplegable("Ciudad")).toHaveValue("Neiva");
    expect(desplegable("Ciudad")).toHaveDisplayValue("Neiva");

    // Un solo filtro: el otro sigue en «Todas». La ciudad conserva su tilde.
    unmount();
    render(
      <FiltrosCartelera ciudades={CIUDADES} filtros={{ ciudad: "Íquira" }} />,
    );

    expect(desplegable("Categoría")).toHaveValue("");
    expect(desplegable("Ciudad")).toHaveValue("Íquira");
    expect(desplegable("Ciudad")).toHaveDisplayValue("Íquira");
  });

  it("al filtrar lleva a la portada con categoria y ciudad en la dirección", () => {
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    fireEvent.change(desplegable("Categoría"), { target: { value: "teatro" } });
    fireEvent.change(desplegable("Ciudad"), { target: { value: "Neiva" } });

    // `Form` de next/form, sin router (jsdom), hace el envío nativo: un GET a
    // `action` con los campos del formulario como consulta. Aquí se comprueba
    // lo que ese envío usaría: la acción y los datos del formulario.
    const formulario = formularioDe(desplegable("Categoría"));
    expect(formulario).toHaveAttribute("action", "/");
    expect(formulario.method).toBe("get");

    const consulta = new URLSearchParams(
      Array.from(new FormData(formulario).entries(), ([clave, valor]) => [
        clave,
        String(valor),
      ]),
    ).toString();
    // El formulario envía también el campo «Fecha», aunque esté vacío (D8).
    expect(consulta).toBe("categoria=teatro&ciudad=Neiva&fecha=");
  });

  it("el filtro «Fecha» es un campo de fecha nativo con su etiqueta, en el mismo formulario", () => {
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    const fecha = campoFecha();
    const categoria = desplegable("Categoría");
    const ciudad = desplegable("Ciudad");
    const boton = screen.getByRole("button", {
      name: "Filtrar",
    }) as HTMLButtonElement;

    // Nativo: el teclado y el calendario funcionan sin código propio (CA-14 de
    // 002). Viaja en la dirección con el nombre `fecha`.
    expect(fecha.tagName).toBe("INPUT");
    expect(fecha.type).toBe("date");
    expect(fecha).toHaveAttribute("name", "fecha");

    // Con su etiqueta visible, que es la que le da el nombre.
    expect(screen.getByText("Fecha")).toBeVisible();
    expect(screen.getByText("Fecha").tagName).toBe("LABEL");

    // Los dos desplegables, el campo de fecha y el botón son del mismo
    // formulario, y el botón lo envía.
    const formulario = formularioDe(categoria);
    expect(formularioDe(ciudad)).toBe(formulario);
    expect(fecha.form).toBe(formulario);
    expect(boton.form).toBe(formulario);
  });

  it("marca la fecha recibida", () => {
    // Sin fecha el campo está vacío: es la portada y también una fecha que no
    // vale, que la cartelera deja en «Todas».
    const { unmount } = render(
      <FiltrosCartelera ciudades={CIUDADES} filtros={{}} />,
    );

    expect(campoFecha()).toHaveValue("");

    // CA-11: al abrir /?fecha=2026-11-21 el campo sale con ese día. El valor es
    // el AAAA-MM-DD de la dirección, el mismo que usa la API (R4).
    unmount();
    const solaLaFecha = render(
      <FiltrosCartelera ciudades={CIUDADES} filtros={{ fecha: "2026-11-21" }} />,
    );

    expect(campoFecha()).toHaveValue("2026-11-21");
    expect(desplegable("Categoría")).toHaveValue("");
    expect(desplegable("Ciudad")).toHaveValue("");

    // Con los tres filtros, los tres salen marcados.
    solaLaFecha.unmount();
    render(
      <FiltrosCartelera
        ciudades={CIUDADES}
        filtros={{ categoria: "teatro", ciudad: "Neiva", fecha: "2026-11-22" }}
      />,
    );

    expect(desplegable("Categoría")).toHaveValue("teatro");
    expect(desplegable("Ciudad")).toHaveValue("Neiva");
    expect(campoFecha()).toHaveValue("2026-11-22");
  });

  it("al elegir un día lleva a la portada con la fecha en la dirección", () => {
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    // Elegir un día en el campo: el valor queda como AAAA-MM-DD.
    fireEvent.change(campoFecha(), { target: { value: "2026-11-21" } });
    expect(campoFecha()).toHaveValue("2026-11-21");

    // El envío nativo de `Form` (GET a `action`) lleva los campos del
    // formulario como consulta. Los dos desplegables en «Todas» van vacíos y la
    // fecha va al final.
    const formulario = campoFecha().form;
    if (!formulario) throw new Error("El campo no está dentro de un formulario");
    expect(formulario).toHaveAttribute("action", "/");
    expect(formulario.method).toBe("get");
    expect(consultaDe(formulario)).toBe("categoria=&ciudad=&fecha=2026-11-21");

    // Con los tres filtros elegidos.
    fireEvent.change(desplegable("Categoría"), { target: { value: "teatro" } });
    fireEvent.change(desplegable("Ciudad"), { target: { value: "Neiva" } });
    fireEvent.change(campoFecha(), { target: { value: "2026-11-22" } });

    expect(consultaDe(formulario)).toBe(
      "categoria=teatro&ciudad=Neiva&fecha=2026-11-22",
    );
  });

  it("los filtros son desplegables nativos con su etiqueta y un botón «Filtrar» en el mismo formulario", () => {
    render(<FiltrosCartelera ciudades={CIUDADES} filtros={{}} />);

    const categoria = desplegable("Categoría");
    const ciudad = desplegable("Ciudad");
    const boton = screen.getByRole("button", {
      name: "Filtrar",
    }) as HTMLButtonElement;

    // Nativos: el teclado funciona sin código propio (CA-14).
    expect(categoria.tagName).toBe("SELECT");
    expect(ciudad.tagName).toBe("SELECT");

    // Con su etiqueta visible, que es la que les da el nombre.
    expect(screen.getByLabelText("Categoría")).toBe(categoria);
    expect(screen.getByLabelText("Ciudad")).toBe(ciudad);
    expect(screen.getByText("Categoría")).toBeVisible();
    expect(screen.getByText("Ciudad")).toBeVisible();

    // Los dos desplegables y el botón son del mismo formulario, y el botón lo envía.
    const formulario = formularioDe(categoria);
    expect(formularioDe(ciudad)).toBe(formulario);
    expect(boton.form).toBe(formulario);
    expect(boton.type).toBe("submit");
  });
});
