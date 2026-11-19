import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EventoCard from "@/components/EventoCard";
import type { Evento } from "@/lib/eventos";

// Id 4 y no 1: así un href escrito a mano no hace pasar la prueba. Es el evento
// 4 de los datos de ejemplo del backend: 90 min se muestran como «1 h 30 min».
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

describe("EventoCard", () => {
  it("la tarjeta entera es un enlace a /eventos/{id} con el afiche, el título, la categoría, la ciudad, la duración y la insignia de clasificación", () => {
    render(<EventoCard evento={cartasAMedianoche} />);

    // Un solo enlace en toda la tarjeta: no hay un enlace para la imagen y otro
    // para el título.
    const enlace = screen.getByRole("link");

    expect(enlace).toHaveAttribute("href", "/eventos/4");
    expect(enlace).toHaveAccessibleName(/Cartas a Medianoche/);

    // D14 / B4 de 001: no basta con enlazar el título; todo lo que se ve de la
    // tarjeta va dentro del mismo enlace, también la insignia de clasificación.
    expect(
      within(enlace).getByRole("img", { name: "Afiche de Cartas a Medianoche" }),
    ).toBeInTheDocument();
    expect(
      within(enlace).getByRole("heading", {
        level: 3,
        name: "Cartas a Medianoche",
      }),
    ).toBeInTheDocument();
    // La categoría se muestra con el mismo nombre que en el filtro, no «teatro».
    expect(within(enlace).getByText(/Teatro/)).toBeInTheDocument();
    expect(within(enlace).getByText(/Neiva/)).toBeInTheDocument();
    expect(within(enlace).getByText(/1 h 30 min/)).toBeInTheDocument();

    const insignia = within(enlace).getByLabelText("Clasificación +13");
    expect(insignia).toHaveTextContent("+13");
  });
});
