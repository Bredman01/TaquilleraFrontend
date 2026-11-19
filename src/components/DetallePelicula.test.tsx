import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DetallePelicula from "@/components/DetallePelicula";
import type { Pelicula, ResultadoPelicula } from "@/lib/peliculas";

// Los valores salen del ejemplo de la sección «Contrato» del plan: 118 min se
// muestra como «1 h 58 min».
const elUltimoFaro: Pelicula = {
  id: 1,
  titulo: "El Último Faro",
  sinopsis:
    "Un farero solitario descubre un mensaje que cambia la historia de su pueblo.",
  duracionMinutos: 118,
  clasificacion: "+13",
  genero: "Drama",
  imagenUrl: "https://placehold.co/400x600/png?text=El+Ultimo+Faro",
};

const conPelicula: ResultadoPelicula = { ok: true, pelicula: elUltimoFaro };
const noEncontrada: ResultadoPelicula = {
  ok: false,
  motivo: "no-encontrada",
};
const conError: ResultadoPelicula = { ok: false, motivo: "error" };

describe("DetallePelicula", () => {
  it("muestra el título como encabezado principal, el póster, la sinopsis, el género, la clasificación y la duración", () => {
    render(<DetallePelicula resultado={conPelicula} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "El Último Faro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Póster de El Último Faro" }),
    ).toBeInTheDocument();
    expect(screen.getByText(elUltimoFaro.sinopsis)).toBeInTheDocument();
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("+13")).toBeInTheDocument();
    expect(screen.getByText("1 h 58 min")).toBeInTheDocument();
  });

  it("tiene el enlace «Volver a la cartelera» que lleva a la portada", () => {
    render(<DetallePelicula resultado={conPelicula} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
  });

  it("si la película no existe muestra «No encontramos esa película» y el enlace para volver", () => {
    render(<DetallePelicula resultado={noEncontrada} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "No encontramos esa película",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
    // No es un fallo del backend: no debe mostrarse como alerta.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it('si no se pudo cargar muestra el aviso con role="alert" y no la ficha', () => {
    render(<DetallePelicula resultado={conError} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /^No pudimos cargar la película\. Intenta de nuevo en unos minutos\.$/,
    );
    // No se confunde con «no existe» ni pinta una ficha.
    expect(
      screen.queryByText("No encontramos esa película"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("si no se pudo cargar también ofrece el enlace «Volver a la cartelera»", () => {
    // P8 / D7: el enlace de volver aparece en los tres estados, también en el error.
    render(<DetallePelicula resultado={conError} />);

    expect(
      screen.getByRole("link", { name: "Volver a la cartelera" }),
    ).toHaveAttribute("href", "/");
  });
});
