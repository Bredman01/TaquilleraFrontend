import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsultarBoleta from "@/components/ConsultarBoleta";

// Spec 006, T10: el formulario «Consultar boleta» del encabezado (D14). Usa el
// `rutaDeConsulta` real de `@/lib/ingreso`: aquí solo se sustituye el router de
// Next, para ver a dónde navega. La interacción es solo con `fireEvent`.
//
// El módulo sustituido solo trae `useRouter`. Si el componente usara
// `useSearchParams` o `usePathname` (D14 dice que no), Vitest lanzaría al
// importarlos y la prueba fallaría.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  // `restoreMocks` (vitest.config.ts) no borra las llamadas de un `vi.fn()`.
  push.mockClear();
});

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

const NOMBRE_DE_LA_BUSQUEDA = "Consultar boleta";
const ETIQUETA = "Código de la boleta";
const BOTON = "Consultar";
const ERROR = "Escribe el código de la boleta";

// ---------------------------------------------------------------------------
// Ayudas de la pantalla
// ---------------------------------------------------------------------------

function busqueda(): HTMLElement {
  return screen.getByRole("search", { name: NOMBRE_DE_LA_BUSQUEDA });
}

function campo(): HTMLInputElement {
  return within(busqueda()).getByRole<HTMLInputElement>("textbox", {
    name: ETIQUETA,
  });
}

function boton(): HTMLButtonElement {
  return within(busqueda()).getByRole<HTMLButtonElement>("button", {
    name: BOTON,
  });
}

function escribir(texto: string) {
  fireEvent.change(campo(), { target: { value: texto } });
}

/**
 * Quien pulsa «Consultar» tiene el foco en el botón, no en el campo: así, si
 * después el campo tiene el foco, es porque el componente se lo dio.
 */
function pulsarConsultar() {
  boton().focus();
  fireEvent.click(boton());
}

/** Enter dentro del campo: el navegador envía el formulario. */
function enviarConEnter() {
  campo().focus();
  fireEvent.submit(busqueda());
}

/** `primero` queda antes que `segundo` en el documento. */
function expectAntes(primero: Element, segundo: Element) {
  expect(
    primero.compareDocumentPosition(segundo) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

/**
 * El error se ve debajo de la fila del campo y el botón («Formulario del
 * encabezado», guía visual) y unido al campo: es su descripción accesible. Y el
 * campo tiene el foco.
 */
function expectErrorEnElCampo() {
  expect(campo()).toHaveAttribute("aria-invalid", "true");
  expect(campo()).toHaveAccessibleDescription(ERROR);

  const error = screen.getByText(ERROR);
  expect(busqueda()).toContainElement(error);
  expectAntes(campo(), error);
  expectAntes(boton(), error);

  expect(campo()).toHaveFocus();
}

function expectSinError() {
  expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
  expect(campo()).not.toHaveAttribute("aria-invalid", "true");
  expect(campo()).not.toHaveAccessibleDescription();
}

// ---------------------------------------------------------------------------
// CA-11: el formulario
// ---------------------------------------------------------------------------

describe("ConsultarBoleta: el formulario", () => {
  it("es una búsqueda «Consultar boleta» con el campo «Código de la boleta», de etiqueta visible, y el botón «Consultar»", () => {
    render(<ConsultarBoleta />);

    // Una búsqueda con nombre, y es un <form>: así Enter la envía.
    const formulario = screen.getByRole("search", {
      name: NOMBRE_DE_LA_BUSQUEDA,
    });
    expect(formulario).toBeInstanceOf(HTMLFormElement);

    // El campo está dentro, es de texto y viaja con el nombre «codigo».
    const codigo = within(formulario).getByRole<HTMLInputElement>("textbox", {
      name: ETIQUETA,
    });
    expect(codigo.type).toBe("text");
    expect(codigo).toHaveAttribute("name", "codigo");
    expect(codigo.form).toBe(formulario);

    // La etiqueta es un texto que se ve, dentro de un <label> unido al campo: no
    // basta un `aria-label` ni un `placeholder`.
    const etiqueta = within(formulario).getByText(ETIQUETA);
    expect(etiqueta).toBeVisible();
    expect(etiqueta.closest("label")?.control).toBe(codigo);

    // El botón envía el mismo formulario.
    const consultar = within(formulario).getByRole<HTMLButtonElement>(
      "button",
      { name: BOTON },
    );
    expect(consultar.type).toBe("submit");
    expect(consultar.form).toBe(formulario);

    // Al cargar, el campo está vacío, sin error, y no se navegó a ninguna parte.
    expect(codigo).toHaveValue("");
    expectSinError();
    expect(push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CA-11: sin código no se navega
// ---------------------------------------------------------------------------

describe("ConsultarBoleta: sin código", () => {
  it("con el campo vacío o solo con espacios no navega, muestra «Escribe el código de la boleta» junto al campo y le deja el foco", () => {
    // Vacío, con un clic en «Consultar».
    const vacio = render(<ConsultarBoleta />);
    pulsarConsultar();

    expectErrorEnElCampo();
    expect(campo()).toHaveValue("");
    expect(push).not.toHaveBeenCalled();

    // Otra vez, con el foco de nuevo en el botón: el foco vuelve al campo y el
    // error sigue siendo uno solo.
    pulsarConsultar();

    expectErrorEnElCampo();
    expect(screen.getAllByText(ERROR)).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
    vacio.unmount();

    // Solo espacios, con Enter dentro del campo: lo escrito se queda.
    render(<ConsultarBoleta />);
    escribir("   ");
    enviarConEnter();

    expectErrorEnElCampo();
    expect(campo()).toHaveValue("   ");
    expect(push).not.toHaveBeenCalled();
  });

  it("el error desaparece al escribir y lo escrito se queda", () => {
    render(<ConsultarBoleta />);
    pulsarConsultar();
    expectErrorEnElCampo();

    escribir("k");

    expectSinError();
    expect(campo()).toHaveValue("k");
    expect(push).not.toHaveBeenCalled();

    // Si se vacía el campo y se envía otra vez, el error vuelve, con el foco.
    escribir("");
    pulsarConsultar();

    expectErrorEnElCampo();
    expect(push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CA-11: con un código se navega a su boleta
// ---------------------------------------------------------------------------

describe("ConsultarBoleta: con un código", () => {
  it("con un código navega a /boletas/{código} recortado y codificado, una sola vez", () => {
    // Con el clic: minúsculas con espacios alrededor. Se recorta y no se pasa a
    // mayúsculas. Lo escrito se queda tal como se escribió.
    const recortado = render(<ConsultarBoleta />);
    escribir("  k7q2m9xa ");
    pulsarConsultar();

    expect(push).toHaveBeenCalledExactlyOnceWith("/boletas/k7q2m9xa");
    expect(campo()).toHaveValue("  k7q2m9xa ");
    expectSinError();
    recortado.unmount();
    push.mockClear();

    // Mayúsculas y minúsculas mezcladas: ni a todas mayúsculas ni a todas
    // minúsculas.
    const mezclado = render(<ConsultarBoleta />);
    escribir("K7q2M9xA");
    pulsarConsultar();

    expect(push).toHaveBeenCalledExactlyOnceWith("/boletas/K7q2M9xA");
    mezclado.unmount();
    push.mockClear();

    // Con Enter, y con un código que lleva un espacio y una barra: se codifica.
    const especial = render(<ConsultarBoleta />);
    escribir("A B/C");
    enviarConEnter();

    expect(push).toHaveBeenCalledExactlyOnceWith("/boletas/A%20B%2FC");
    expect(campo()).toHaveValue("A B/C");
    expectSinError();
    especial.unmount();
    push.mockClear();

    // Un código después de un error: el error se va y se navega.
    render(<ConsultarBoleta />);
    pulsarConsultar();
    expectErrorEnElCampo();
    expect(push).not.toHaveBeenCalled();

    escribir("zx81qw5t");
    pulsarConsultar();

    expect(push).toHaveBeenCalledExactlyOnceWith("/boletas/zx81qw5t");
    expectSinError();
    expect(campo()).toHaveValue("zx81qw5t");
  });
});
