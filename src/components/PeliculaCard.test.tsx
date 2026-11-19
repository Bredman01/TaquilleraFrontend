import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PeliculaCard from "@/components/PeliculaCard";
import type { Pelicula } from "@/lib/peliculas";

// Id 3 y no 1: así un href escrito a mano no hace pasar la prueba.
const risasEnFamilia: Pelicula = {
  id: 3,
  titulo: "Risas en Familia",
  sinopsis:
    "Tres generaciones comparten una casa durante las vacaciones y nada sale como lo planearon.",
  duracionMinutos: 95,
  clasificacion: "TP",
  genero: "Comedia",
  imagenUrl: "https://placehold.co/400x600/png?text=Risas+en+Familia",
};

describe("PeliculaCard", () => {
  it("la tarjeta es un enlace al detalle cuyo nombre accesible incluye el título", () => {
    render(<PeliculaCard pelicula={risasEnFamilia} />);

    const enlace = screen.getByRole("link", { name: /Risas en Familia/ });

    expect(enlace).toHaveAttribute("href", "/peliculas/3");
  });
});
