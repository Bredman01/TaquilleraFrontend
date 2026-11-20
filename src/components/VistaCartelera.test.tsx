import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VistaCartelera from "@/components/VistaCartelera";
import type { ResultadoCartelera } from "@/lib/cartelera";
import type { Evento, Filtros } from "@/lib/eventos";

// Ciudades de los datos de ejemplo del backend, como las responde
// GET /eventos/ciudades: sin repetir y en orden alfabético del español.
const CIUDADES = ["Bogotá", "Íquira", "Neiva", "Pitalito"];

// Eventos 1, 4 y 6 de los datos de ejemplo del backend (contrato del plan).
const elUltimoFaro: Evento = {
  id: 1,
  titulo: "El Último Faro",
  descripcion:
    "Un farero solitario descubre un mensaje que cambia la historia de su pueblo.",
  categoria: "cine",
  ciudad: "Neiva",
  lugar: "Cine Club La Gaitana",
  duracionMinutos: 118,
  clasificacion: "+13",
  imagenUrl: "https://placehold.co/400x600/png?text=El+Ultimo+Faro",
};

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

const bambucosAlAtardecer: Evento = {
  id: 6,
  titulo: "Bambucos al Atardecer",
  descripcion: "Un concierto de música andina al aire libre.",
  categoria: "concierto",
  ciudad: "Neiva",
  lugar: "Concha Acústica del Malecón",
  duracionMinutos: 120,
  clasificacion: "TP",
  imagenUrl: "https://placehold.co/400x600/png?text=Bambucos+al+Atardecer",
};

function conEventos(eventos: Evento[], filtros: Filtros): ResultadoCartelera {
  return { ok: true, eventos, ciudades: CIUDADES, filtros };
}

describe("VistaCartelera", () => {
  it("muestra una tarjeta enlazada por cada evento", () => {
    const eventos = [elUltimoFaro, cartasAMedianoche, bambucosAlAtardecer];

    render(<VistaCartelera resultado={conEventos(eventos, {})} />);

    // Un enlace por evento, cada uno a su detalle.
    for (const evento of eventos) {
      expect(
        screen.getByRole("link", { name: new RegExp(evento.titulo) }),
        `enlace del evento «${evento.titulo}»`,
      ).toHaveAttribute("href", `/eventos/${evento.id}`);
    }
    expect(screen.getAllByRole("link")).toHaveLength(eventos.length);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si ningún evento cumple los filtros muestra «No hay eventos con esos filtros» y el enlace «Ver todos los eventos»", () => {
    render(
      <VistaCartelera
        resultado={conEventos([], { categoria: "charla", ciudad: "Pitalito" })}
      />,
    );

    expect(
      screen.getByText("No hay eventos con esos filtros"),
    ).toBeInTheDocument();
    // El enlace quita los filtros: lleva a la portada, sin consulta.
    expect(
      screen.getByRole("link", { name: "Ver todos los eventos" }),
    ).toHaveAttribute("href", "/");
    // No es un fallo del backend y no es una cartelera vacía sin filtros.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay eventos en cartelera."),
    ).not.toBeInTheDocument();
  });

  it("al cambiar los filtros de la dirección los desplegables muestran los nuevos", () => {
    // D13: React no aplica un `defaultValue` nuevo a un <select> ya montado, así
    // que la vista debe reiniciar los filtros cuando cambian. Sin eso, después de
    // «Ver todos los eventos» el desplegable seguiría en «Teatro».
    const categoria = () =>
      screen.getByRole("combobox", { name: "Categoría" });
    const ciudad = () => screen.getByRole("combobox", { name: "Ciudad" });

    const { rerender } = render(
      <VistaCartelera
        resultado={conEventos([cartasAMedianoche], {
          categoria: "teatro",
          ciudad: "Neiva",
        })}
      />,
    );

    expect(categoria()).toHaveValue("teatro");
    expect(ciudad()).toHaveValue("Neiva");

    // Otra dirección: /?categoria=charla&ciudad=Bogotá.
    rerender(
      <VistaCartelera
        resultado={conEventos([cartasAMedianoche], {
          categoria: "charla",
          ciudad: "Bogotá",
        })}
      />,
    );

    expect(categoria()).toHaveValue("charla");
    expect(categoria()).toHaveDisplayValue("Charla");
    expect(ciudad()).toHaveValue("Bogotá");
    expect(ciudad()).toHaveDisplayValue("Bogotá");

    // La portada sin filtros: «Ver todos los eventos».
    rerender(<VistaCartelera resultado={conEventos([cartasAMedianoche], {})} />);

    expect(categoria()).toHaveValue("");
    expect(categoria()).toHaveDisplayValue("Todas");
    expect(ciudad()).toHaveValue("");
    expect(ciudad()).toHaveDisplayValue("Todas");
  });

  it("al cambiar la fecha de la dirección el campo «Fecha» muestra la nueva", () => {
    // D13: igual que los desplegables, el campo debe reiniciarse cuando cambia
    // la fecha de la dirección. Un campo que la persona ya editó no sigue a su
    // `defaultValue`: sin la `key`, después de «Ver todos los eventos» conservaría
    // el día que eligió.
    const fecha = () => screen.getByLabelText("Fecha");

    const { rerender } = render(
      <VistaCartelera
        resultado={conEventos([elUltimoFaro], { fecha: "2026-11-21" })}
      />,
    );

    expect(fecha()).toHaveValue("2026-11-21");

    // Otra dirección: /?fecha=2026-11-22.
    rerender(
      <VistaCartelera
        resultado={conEventos([elUltimoFaro], { fecha: "2026-11-22" })}
      />,
    );

    expect(fecha()).toHaveValue("2026-11-22");

    // La persona elige otro día en el campo, sin enviar el formulario, y
    // después pulsa «Ver todos los eventos»: la portada sin filtros.
    fireEvent.change(fecha(), { target: { value: "2026-12-01" } });
    expect(fecha()).toHaveValue("2026-12-01");

    rerender(<VistaCartelera resultado={conEventos([elUltimoFaro], {})} />);

    expect(fecha()).toHaveValue("");

    // Lo mismo con una fecha nueva en la dirección.
    fireEvent.change(fecha(), { target: { value: "2026-12-01" } });

    rerender(
      <VistaCartelera
        resultado={conEventos([elUltimoFaro], { fecha: "2026-11-23" })}
      />,
    );

    expect(fecha()).toHaveValue("2026-11-23");
  });

  it("con solo la fecha y sin eventos muestra «No hay eventos con esos filtros»", () => {
    // Sin criterio (D13): `hayFiltros` también mira la fecha. /?fecha=2026-11-23
    // es un día sin funciones: hay un filtro puesto y la salida es quitarlo.
    render(
      <VistaCartelera resultado={conEventos([], { fecha: "2026-11-23" })} />,
    );

    expect(
      screen.getByText("No hay eventos con esos filtros"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todos los eventos" }),
    ).toHaveAttribute("href", "/");
    // No es un fallo del backend y no es una cartelera vacía sin filtros.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay eventos en cartelera."),
    ).not.toBeInTheDocument();
  });

  it('si no se pudo cargar muestra el aviso con role="alert" y no los filtros', () => {
    // Sin criterio (D13): el error de la cartelera, sin filtros ni tarjetas.
    render(<VistaCartelera resultado={{ ok: false }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /^No pudimos cargar la cartelera\. Intenta de nuevo en unos minutos\.$/,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Filtrar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sin filtros y sin eventos muestra «No hay eventos en cartelera.» sin enlace", () => {
    // Sin criterio (D13): una cartelera vacía sin filtros no tiene nada que quitar.
    render(<VistaCartelera resultado={conEventos([], {})} />);

    expect(screen.getByText("No hay eventos en cartelera.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No hay eventos con esos filtros"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
