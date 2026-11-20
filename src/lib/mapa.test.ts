import { describe, expect, it } from "vitest";
import type { Asiento } from "@/lib/funciones";
import {
  MAXIMO_POR_COMPRA,
  agruparPorFila,
  alternarAsiento,
  rutaDeCompra,
} from "@/lib/mapa";

const FILAS = ["A", "B", "C", "D", "E"];

// Los ocupados de la función 5 de los datos de ejemplo (D6 del plan).
const OCUPADOS_FUNCION_5 = ["A3", "A4", "C1", "C8", "D5", "E8"];

/** Los 40 asientos de una función, en el orden en que los responde la API: A1…A8, B1…B8, …, E1…E8. */
function asientosDeLaFuncion(
  ocupados: readonly string[] = OCUPADOS_FUNCION_5,
): Asiento[] {
  return FILAS.flatMap((fila) =>
    Array.from({ length: 8 }, (_, indice): Asiento => {
      const numero = indice + 1;
      const id = `${fila}${numero}`;
      return {
        id,
        fila,
        numero,
        estado: ocupados.includes(id) ? "ocupado" : "disponible",
      };
    }),
  );
}

const asientos = asientosDeLaFuncion();

function asiento(id: string): Asiento {
  const encontrado = asientos.find((candidato) => candidato.id === id);
  if (!encontrado) {
    throw new Error(`El asiento ${id} no existe en los datos de la prueba`);
  }
  return encontrado;
}

/** Elige los asientos uno tras otro, como alguien que los pulsa en ese orden. */
function elegir(...ids: string[]): string[] {
  let seleccion: string[] = [];
  for (const id of ids) {
    const cambio = alternarAsiento(asientos, seleccion, asiento(id));
    if (!cambio.ok) {
      throw new Error(`No se pudo elegir ${id}: ${cambio.motivo}`);
    }
    seleccion = cambio.seleccion;
  }
  return seleccion;
}

/** Un asiento de una fila, con el estado que se indique. */
function asientoSuelto(id: string): Asiento {
  return {
    id,
    fila: id.slice(0, 1),
    numero: Number(id.slice(1)),
    estado: "disponible",
  };
}

describe("agruparPorFila", () => {
  it("agrupa los asientos por fila, de la A a la E, y por número en orden numérico", () => {
    // Desordenada a propósito: la fila E llega primero, la A trae el 10 antes
    // que el 2 y el 1, y la C trae el 8 antes que el 7. Ordenar los números como
    // texto daría A1, A10, A2.
    const entrada = [
      "E3",
      "A10",
      "C8",
      "A2",
      "D5",
      "B2",
      "A1",
      "E1",
      "C7",
      "D1",
    ].map(asientoSuelto);

    const filas = agruparPorFila(entrada);

    expect(filas.map(({ fila }) => fila)).toEqual(["A", "B", "C", "D", "E"]);
    expect(filas.map(({ asientos: deLaFila }) => deLaFila.map(({ id }) => id))).toEqual(
      [["A1", "A2", "A10"], ["B2"], ["C7", "C8"], ["D1", "D5"], ["E1", "E3"]],
    );
    // El orden es el del número, no el del texto del identificador.
    expect(filas[0].asientos.map(({ numero }) => numero)).toEqual([1, 2, 10]);
    // Cada asiento conserva sus datos.
    expect(filas[0].asientos[2]).toEqual({
      id: "A10",
      fila: "A",
      numero: 10,
      estado: "disponible",
    });

    // Los 40 asientos de una función que llegan al revés: cinco filas de ocho.
    const delFinalAlPrincipio = agruparPorFila(
      [...asientosDeLaFuncion()].reverse(),
    );

    expect(delFinalAlPrincipio.map(({ fila }) => fila)).toEqual(FILAS);
    for (const { fila, asientos: deLaFila } of delFinalAlPrincipio) {
      expect(deLaFila.map(({ id }) => id)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((numero) => `${fila}${numero}`),
      );
    }
  });

  it("agruparPorFila no modifica la lista que recibe", () => {
    const entrada = [...asientosDeLaFuncion()].reverse();
    // Congelada: ordenarla en su sitio o cambiar uno de sus asientos lanza un error.
    entrada.forEach((elemento) => Object.freeze(elemento));
    Object.freeze(entrada);
    const idsAntes = entrada.map(({ id }) => id);

    const filas = agruparPorFila(entrada);

    expect(entrada.map(({ id }) => id)).toEqual(idsAntes);
    // Lo que devuelve no es la misma lista ni la lista de ninguna de las filas.
    expect(filas.flatMap(({ asientos: deLaFila }) => deLaFila)).toHaveLength(40);
    for (const { asientos: deLaFila } of filas) {
      expect(deLaFila).not.toBe(entrada);
    }
  });
});

describe("alternarAsiento", () => {
  it("alternarAsiento no deja seleccionar un asiento ocupado", () => {
    // Con la selección vacía.
    expect(alternarAsiento(asientos, [], asiento("A3"))).toEqual({
      ok: false,
      motivo: "ocupado",
    });

    // Con otros asientos elegidos: la selección que se tenía no cambia.
    const seleccion = ["A1", "A2"];
    expect(alternarAsiento(asientos, seleccion, asiento("E8"))).toEqual({
      ok: false,
      motivo: "ocupado",
    });
    expect(seleccion).toEqual(["A1", "A2"]);

    // Un ocupado es un ocupado también cuando ya hay seis elegidos: no es «máximo».
    expect(
      alternarAsiento(
        asientos,
        ["A1", "A2", "A5", "A6", "A7", "A8"],
        asiento("C1"),
      ),
    ).toEqual({ ok: false, motivo: "ocupado" });

    // Los seis ocupados de la función 5.
    for (const id of OCUPADOS_FUNCION_5) {
      expect(alternarAsiento(asientos, [], asiento(id))).toEqual({
        ok: false,
        motivo: "ocupado",
      });
    }
  });

  it("alternarAsiento selecciona un asiento disponible y lo deselecciona al repetir", () => {
    expect(alternarAsiento(asientos, [], asiento("A1"))).toEqual({
      ok: true,
      seleccion: ["A1"],
    });
    expect(alternarAsiento(asientos, ["A1"], asiento("A1"))).toEqual({
      ok: true,
      seleccion: [],
    });

    // Con otros elegidos, solo cambia ese asiento.
    expect(alternarAsiento(asientos, ["A1", "A2"], asiento("A1"))).toEqual({
      ok: true,
      seleccion: ["A2"],
    });
    expect(alternarAsiento(asientos, ["A1"], asiento("B4"))).toEqual({
      ok: true,
      seleccion: ["A1", "B4"],
    });
  });

  it("alternarAsiento deja la selección en el orden del mapa, no en el orden en que se eligen", () => {
    // C2, A5 y A1, en ese orden: el mapa va por fila y por número.
    expect(elegir("C2", "A5", "A1")).toEqual(["A1", "A5", "C2"]);
    // Otro orden de clics, la misma selección.
    expect(elegir("A1", "C2", "A5")).toEqual(["A1", "A5", "C2"]);
    expect(elegir("D1", "B3", "A8", "B1")).toEqual(["A8", "B1", "B3", "D1"]);

    // Quitar uno no desordena los demás.
    expect(
      alternarAsiento(asientos, ["A1", "A5", "C2"], asiento("A5")),
    ).toEqual({ ok: true, seleccion: ["A1", "C2"] });
  });

  it("alternarAsiento no deja pasar de 6 asientos y no cambia la selección", () => {
    const seis = ["A1", "A2", "A5", "A6", "A7", "A8"];

    // El séptimo.
    expect(alternarAsiento(asientos, seis, asiento("B1"))).toEqual({
      ok: false,
      motivo: "maximo",
    });
    expect(seis).toEqual(["A1", "A2", "A5", "A6", "A7", "A8"]);

    // Hasta el sexto sí se puede: el tope son seis, no cinco.
    expect(alternarAsiento(asientos, seis.slice(0, 5), asiento("A8"))).toEqual({
      ok: true,
      seleccion: seis,
    });

    // Con seis elegidos, quitar uno funciona, y después se puede elegir otro.
    const sinA5 = alternarAsiento(asientos, seis, asiento("A5"));
    expect(sinA5).toEqual({
      ok: true,
      seleccion: ["A1", "A2", "A6", "A7", "A8"],
    });
    expect(alternarAsiento(asientos, seis.filter((id) => id !== "A5"), asiento("B1"))).toEqual({
      ok: true,
      seleccion: ["A1", "A2", "A6", "A7", "A8", "B1"],
    });

    expect(MAXIMO_POR_COMPRA).toBe(6);
  });

  it("alternarAsiento no modifica la selección que recibe", () => {
    // Congelada: agregarle o quitarle un elemento en su sitio lanza un error.
    const dos: readonly string[] = Object.freeze(["A1", "A2"]);
    const seis: readonly string[] = Object.freeze([
      "A1",
      "A2",
      "A5",
      "A6",
      "A7",
      "A8",
    ]);

    const agregado = alternarAsiento(asientos, dos, asiento("C2"));
    const quitado = alternarAsiento(asientos, dos, asiento("A1"));
    const ocupado = alternarAsiento(asientos, dos, asiento("A3"));
    const pasadoDelMaximo = alternarAsiento(asientos, seis, asiento("B1"));

    expect(agregado).toEqual({ ok: true, seleccion: ["A1", "A2", "C2"] });
    expect(quitado).toEqual({ ok: true, seleccion: ["A2"] });
    expect(ocupado.ok).toBe(false);
    expect(pasadoDelMaximo.ok).toBe(false);
    // Las listas de entrada siguen como estaban, y el resultado es otra lista.
    expect(dos).toEqual(["A1", "A2"]);
    expect(seis).toEqual(["A1", "A2", "A5", "A6", "A7", "A8"]);
    if (agregado.ok) expect(agregado.seleccion).not.toBe(dos);
    if (quitado.ok) expect(quitado.seleccion).not.toBe(dos);
  });
});

describe("rutaDeCompra", () => {
  it("rutaDeCompra arma /funciones/{id}/compra?asientos= con los identificadores separados por comas", () => {
    expect(rutaDeCompra(5, ["A1", "A2"])).toBe(
      "/funciones/5/compra?asientos=A1,A2",
    );
    expect(rutaDeCompra(10, ["E8"])).toBe("/funciones/10/compra?asientos=E8");
    expect(rutaDeCompra(5, ["A1", "A2", "A5", "A6", "A7", "A8"])).toBe(
      "/funciones/5/compra?asientos=A1,A2,A5,A6,A7,A8",
    );

    // Un id con `&` o `#` rompería la consulta si se escribiera tal cual: sale
    // codificado, y la coma que separa los ids, no.
    const ruta = rutaDeCompra(5, ["A&1", "B#2"]);

    expect(ruta).toBe("/funciones/5/compra?asientos=A%261,B%232");
    // La coma es la de la dirección que pide la spec: no sale como %2C.
    expect(ruta).not.toContain("%2C");
    expect(ruta).toContain(",");
  });
});
