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
    expect(consulta).toBe("categoria=teatro&ciudad=Neiva");
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
