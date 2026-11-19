import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DetalleEvento from "@/components/DetalleEvento";
import type { Evento, ResultadoEvento } from "@/lib/eventos";

// Los valores salen del ejemplo de la sección «Contrato» del plan: 90 min se
// muestra como «1 h 30 min». La ciudad y el lugar comparten palabras («Neiva»,
// «Teatro»), así que cada valor se comprueba junto a su etiqueta.
const cartasAMedianoche: Evento = {
  id: 4,
  titulo: "Cartas a Medianoche",
  descripcion:
    "Una actriz retirada recibe cada noche una carta sin remitente.",
  categoria: "teatro",
  ciudad: "Neiva",
  lugar: "Teatro Municipal de Neiva",
  duracionMinutos: 90,
  clasificacion: "+13",
  imagenUrl: "https://placehold.co/400x600/png?text=Cartas+a+Medianoche",
};

const conEvento: ResultadoEvento = { ok: true, evento: cartasAMedianoche };
const noEncontrado: ResultadoEvento = { ok: false, motivo: "no-encontrado" };
const conError: ResultadoEvento = { ok: false, motivo: "error" };

/** Los pares etiqueta → valor de la lista de datos de la ficha (`<dl>`). */
function paresDeLaFicha(): Record<string, string | null> {
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

describe("DetalleEvento", () => {
  it("muestra el título como encabezado principal, el afiche, la descripción, la categoría, la ciudad, el lugar, la clasificación y la duración", () => {
    render(<DetalleEvento resultado={conEvento} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Cartas a Medianoche" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Afiche de Cartas a Medianoche" }),
    ).toBeInTheDocument();
    expect(screen.getByText(cartasAMedianoche.descripcion)).toBeInTheDocument();

    // Los cinco pares del <dl>, cada etiqueta con su valor. La categoría se
    // muestra con el mismo nombre que en el filtro («Teatro», no «teatro»).
    expect(paresDeLaFicha()).toEqual({
      Categoría: "Teatro",
      Ciudad: "Neiva",
      Lugar: "Teatro Municipal de Neiva",
      Clasificación: "+13",
      Duración: "1 h 30 min",
    });
  });

  it("tiene el enlace «Volver a la cartelera» que lleva a la portada", () => {
    render(<DetalleEvento resultado={conEvento} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
  });

  it("si el evento no existe muestra «No encontramos ese evento» y el enlace para volver", () => {
    render(<DetalleEvento resultado={noEncontrado} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos ese evento",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
    // No es un fallo del backend: no debe mostrarse como alerta.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('si no se pudo cargar muestra el aviso con role="alert" y no la ficha', () => {
    render(<DetalleEvento resultado={conError} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /^No pudimos cargar el evento\. Intenta de nuevo en unos minutos\.$/,
    );
    // No se confunde con «no existe» ni pinta una ficha.
    expect(
      screen.queryByText("No encontramos ese evento"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
  });

  it("si no se pudo cargar también ofrece el enlace «Volver a la cartelera»", () => {
    // El enlace de volver aparece en los tres estados, también en el error.
    render(<DetalleEvento resultado={conError} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
  });
});
