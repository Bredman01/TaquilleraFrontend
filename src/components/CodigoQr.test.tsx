import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CodigoQr from "@/components/CodigoQr";
import { matrizQr, trazoQr } from "@/lib/qr";

// Spec 006, T8: el código QR de la boleta (D9). Es un svg propio, sin imágenes ni
// HTML incrustado: un `<rect>` blanco que lo cubre todo y un solo `<path>` con un
// cuadrado de 1 × 1 por módulo oscuro. El componente usa `matrizQr` y `trazoQr`
// de verdad (sin simularlos): lo que se comprueba aquí es cómo los arma en el
// svg. Vitest no puede decodificar un QR; que la dirección se lea lo comprueba
// la prueba de recorrido (T13) con `jsqr`.
//
// Los svg no tienen más rol que `img`, así que el `rect` y el `path` se buscan
// por su etiqueta dentro de la imagen que el usuario encuentra por su nombre.

const CODIGO = "K7Q2M9XA";
const NOMBRE_DEL_QR = `Código QR de la boleta ${CODIGO}`;

/** La dirección de la boleta desde el mismo equipo: 38 bytes, QR de 29 × 29 módulos. */
const DIRECCION_DE_38_BYTES = "http://localhost:3000/boletas/K7Q2M9XA";
/** La dirección desde la red local: 43 bytes, QR de 33 × 33 módulos. */
const DIRECCION_DE_43_BYTES = "http://192.168.10.100:3000/boletas/K7Q2M9XA";

describe("CodigoQr", () => {
  it("es una imagen con el nombre «Código QR de la boleta K7Q2M9XA»", () => {
    const { rerender } = render(
      <CodigoQr direccion={DIRECCION_DE_38_BYTES} codigo={CODIGO} />,
    );

    const imagen = screen.getByRole("img", { name: NOMBRE_DEL_QR });
    // La imagen es el propio svg, y es la única de la pantalla.
    expect(imagen.localName).toBe("svg");
    expect(screen.getAllByRole("img")).toHaveLength(1);

    // El nombre sale del código que recibe, no de uno fijo.
    rerender(<CodigoQr direccion={DIRECCION_DE_38_BYTES} codigo="ZX81QW5T" />);

    expect(
      screen.getByRole("img", { name: "Código QR de la boleta ZX81QW5T" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: NOMBRE_DEL_QR }),
    ).not.toBeInTheDocument();
  });

  it("el svg mide el QR más 4 módulos por lado, con un fondo blanco que lo cubre y los módulos en un solo trazo", () => {
    // 38 bytes con el nivel M caben en 29 × 29 módulos: 29 + 2 × 4 = 37. 43 bytes
    // ya no caben en 29 y dan 33 × 33: 33 + 2 × 4 = 41.
    const casos = [
      { direccion: DIRECCION_DE_38_BYTES, modulos: 29, lado: 37 },
      { direccion: DIRECCION_DE_43_BYTES, modulos: 33, lado: 41 },
    ];

    for (const { direccion, modulos, lado } of casos) {
      const { unmount } = render(
        <CodigoQr direccion={direccion} codigo={CODIGO} />,
      );
      const imagen = screen.getByRole("img", { name: NOMBRE_DEL_QR });

      // El svg es cuadrado y deja 4 módulos claros alrededor del QR.
      expect(matrizQr(direccion), `matriz de ${direccion}`).toHaveLength(modulos);
      expect(imagen.getAttribute("viewBox"), `viewBox de ${direccion}`).toBe(
        `0 0 ${lado} ${lado}`,
      );

      // Un fondo que cubre todo el svg, desde la esquina.
      const fondos = imagen.querySelectorAll("rect");
      expect(fondos, `rect de ${direccion}`).toHaveLength(1);
      expect(fondos[0]?.getAttribute("width")).toBe(String(lado));
      expect(fondos[0]?.getAttribute("height")).toBe(String(lado));
      expect(fondos[0]?.getAttribute("x") ?? "0").toBe("0");
      expect(fondos[0]?.getAttribute("y") ?? "0").toBe("0");

      // Los módulos oscuros, en un solo trazo: el de esa dirección y no otro.
      const trazos = imagen.querySelectorAll("path");
      expect(trazos, `path de ${direccion}`).toHaveLength(1);
      const trazo = trazos[0]?.getAttribute("d");
      expect(trazo).toBe(trazoQr(matrizQr(direccion)));
      expect(trazo?.startsWith("M")).toBe(true);

      unmount();
    }
  });

  it("no usa imágenes ni HTML incrustado: solo un rect y un path dentro del svg", () => {
    const { container } = render(
      <CodigoQr direccion={DIRECCION_DE_38_BYTES} codigo={CODIGO} />,
    );
    const imagen = screen.getByRole("img", { name: NOMBRE_DEL_QR });

    // Exactamente dos hijos y en este orden: el fondo primero, para que el trazo
    // se dibuje encima y no debajo de él.
    expect(Array.from(imagen.children).map((hijo) => hijo.localName)).toEqual([
      "rect",
      "path",
    ]);
    expect(imagen.textContent).toBe("");

    // Ni una imagen externa ni un data URL ni HTML dentro del svg.
    expect(
      container.querySelectorAll("img, image, foreignObject, iframe, canvas"),
    ).toHaveLength(0);
  });
});
