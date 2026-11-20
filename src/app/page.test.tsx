import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

// `Cartelera` es un Server Component asíncrono y Vitest no los monta (la
// conexión con `searchParams` solo se ve en el navegador). Se sustituye por un
// componente que no pinta nada para probar solo lo que la portada pinta ella.
vi.mock("@/components/Cartelera", () => ({ default: () => null }));

// Los mismos argumentos que Next le pasa a la página. Se tipan con la firma real
// de `Home` para que `next build` compile esta prueba sin copiar el tipo.
const props: Parameters<typeof Home>[0] = {
  params: Promise.resolve({}),
  searchParams: Promise.resolve({}),
};

describe("Home", () => {
  it("la portada dice «Elige tu evento y compra tus boletas.»", () => {
    render(<Home {...props} />);

    expect(
      screen.getByText("Elige tu evento y compra tus boletas."),
    ).toBeInTheDocument();
    // CA-13: la interfaz habla de eventos y no de películas.
    expect(screen.queryByText(/película/i)).not.toBeInTheDocument();
  });
});
