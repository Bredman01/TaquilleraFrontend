import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  diaEnColombia,
  formatDia,
  formatDuracion,
  formatHora,
  formatPrecio,
} from "@/lib/formato";

// D5: las horas se formatean en Colombia sin importar la zona de quien ejecuta.
// Para que un error de zona no pase en una máquina que está en Colombia, estas
// pruebas corren con la zona del proceso en Tokio (14 h por delante).
const zonaOriginal = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Asia/Tokyo";
});

afterAll(() => {
  if (zonaOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = zonaOriginal;
});

/**
 * D10: lo que escribe `formato.ts` lleva espacios normales (U+0020). ICU escribe
 * U+00A0 dentro de «p. m.» y después de «$»; un U+00A0 se ve igual que un
 * espacio, así que se comprueba aparte para que el fallo diga qué pasó.
 */
function expectEspaciosNormales(texto: string) {
  expect(
    texto,
    `«${texto}» no debe llevar U+00A0 ni U+202F: D10 manda espacios normales`,
  ).not.toMatch(/[  ]/);
}

describe("la zona de las pruebas", () => {
  it("las pruebas corren en Asia/Tokyo, fuera de la zona de Colombia", () => {
    // 03:30 UTC son las 22:30 del día 21 en Colombia y las 12:30 del 22 en Tokio.
    // Si la zona no cambió, esta prueba falla en lugar de dar un verde falso.
    expect(new Date("2026-11-22T03:30:00Z").getHours()).toBe(12);
  });
});

describe("formatDuracion", () => {
  it("formatea la duración igual que la cartelera", () => {
    expect(formatDuracion(118)).toBe("1 h 58 min");
    expect(formatDuracion(120)).toBe("2 h");
    expect(formatDuracion(45)).toBe("45 min");
  });
});

describe("formatDia", () => {
  it("formatDia escribe el día de Colombia con el día de la semana, el número y el mes", () => {
    const casos: Array<[string, string, string]> = [
      [
        "2026-11-21T16:00:00-05:00",
        "sábado, 21 de noviembre",
        "una hora con el desfase de Colombia",
      ],
      [
        // Las 23:30 del sábado en Colombia ya son el domingo 22 en UTC.
        "2026-11-22T04:30:00Z",
        "sábado, 21 de noviembre",
        "una hora con Z que en UTC ya es el día siguiente",
      ],
      [
        // Las 23:30 del lunes 30 en Colombia: en UTC ya es diciembre.
        "2026-12-01T04:30:00Z",
        "lunes, 30 de noviembre",
        "una hora con Z que en UTC ya es otro mes",
      ],
      [
        // En Tokio ya sería el lunes 23.
        "2026-11-22T10:30:00-05:00",
        "domingo, 22 de noviembre",
        "una hora de la mañana, que en Tokio cae otro día",
      ],
    ];

    for (const [inicio, esperado, descripcion] of casos) {
      const dia = formatDia(inicio);

      expect(dia, `día de ${inicio} (${descripcion})`).toBe(esperado);
      expectEspaciosNormales(dia);
    }
  });
});

describe("diaEnColombia", () => {
  it("diaEnColombia da la fecha AAAA-MM-DD del día en Colombia", () => {
    const casos: Array<[string, string, string]> = [
      ["2026-11-21T18:00:00-05:00", "2026-11-21", "con el desfase de Colombia"],
      [
        // En UTC ya es el día 22.
        "2026-11-21T23:30:00-05:00",
        "2026-11-21",
        "las 23:30, que en UTC ya es el día siguiente",
      ],
      [
        "2026-11-22T10:30:00-05:00",
        "2026-11-22",
        "las 10:30, que en Tokio ya es el día siguiente",
      ],
      ["2026-11-22T04:30:00Z", "2026-11-21", "una hora con Z"],
      [
        "2026-11-22T04:59:59Z",
        "2026-11-21",
        "el último segundo del día en Colombia",
      ],
      [
        "2026-11-22T05:00:00Z",
        "2026-11-22",
        "la medianoche de Colombia, que es el primer segundo del día",
      ],
      [
        "2026-11-22T00:30:00+09:00",
        "2026-11-21",
        "una hora con otro desfase (las 10:30 del sábado en Colombia)",
      ],
      ["2026-12-01T04:30:00Z", "2026-11-30", "un cambio de mes"],
      ["2026-01-01T04:59:59Z", "2025-12-31", "un cambio de año"],
    ];

    for (const [inicio, esperado, descripcion] of casos) {
      expect(diaEnColombia(inicio), `día de ${inicio} (${descripcion})`).toBe(
        esperado,
      );
    }
  });
});

describe("formatHora", () => {
  it("formatHora escribe la hora de Colombia en 12 horas con «a. m.» o «p. m.»", () => {
    const casos: Array<[string, string, string]> = [
      [
        "2026-11-21T16:00:00-05:00",
        "4:00 p. m.",
        "la tarde, sin cero a la izquierda",
      ],
      ["2026-11-22T19:30:00-05:00", "7:30 p. m.", "la noche"],
      [
        // Las 23:30 en Colombia; en UTC son las 04:30 del día siguiente.
        "2026-11-22T04:30:00Z",
        "11:30 p. m.",
        "una hora con Z",
      ],
      ["2026-11-22T10:30:00-05:00", "10:30 a. m.", "la mañana"],
      ["2026-11-22T00:15:00-05:00", "12:15 a. m.", "después de la medianoche"],
      ["2026-11-22T12:00:00-05:00", "12:00 p. m.", "el mediodía"],
    ];

    for (const [inicio, esperado, descripcion] of casos) {
      const hora = formatHora(inicio);

      expectEspaciosNormales(hora);
      expect(hora, `hora de ${inicio} (${descripcion})`).toBe(esperado);
    }
  });
});

describe("formatPrecio", () => {
  it("formatPrecio escribe los pesos sin decimales y con punto de miles", () => {
    const casos: Array<[number, string, string]> = [
      [15000, "$ 15.000", "cinco cifras"],
      [8000, "$ 8.000", "cuatro cifras: también lleva punto de miles"],
      [1500000, "$ 1.500.000", "dos puntos de miles"],
    ];

    for (const [pesos, esperado, descripcion] of casos) {
      const precio = formatPrecio(pesos);

      expectEspaciosNormales(precio);
      expect(precio, `precio de ${pesos} (${descripcion})`).toBe(esperado);
    }
  });
});
