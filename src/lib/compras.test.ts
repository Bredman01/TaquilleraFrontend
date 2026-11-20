import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { API_URL, ESPERA_MAXIMA_MS } from "@/lib/api";
import {
  comprar,
  prepararCompra,
  validarComprador,
  type CompraCreada,
  type PaginaCompra,
  type ResultadoCompra,
} from "@/lib/compras";
import type {
  Asiento,
  FuncionConEvento,
  ResultadoAsientos,
  ResultadoFuncion,
} from "@/lib/funciones";

// Spec 005, T6: la preparación de la página de compra (D12), la validación del
// comprador (D4) y el envío de la compra (D14). Aquí no se formatea ninguna
// fecha ni hora, así que no se fuerza la zona del proceso.

// ---------------------------------------------------------------------------
// Datos de las pruebas
// ---------------------------------------------------------------------------

// Funciones 1, 5 y 10 de los datos de ejemplo del backend, tal como las
// responde GET /funciones/:id (siete campos).
const funcion1: FuncionConEvento = {
  id: 1,
  eventoId: 1,
  titulo: "El Último Faro",
  ciudad: "Neiva",
  lugar: "Cine Club La Gaitana",
  inicio: "2026-11-21T18:00:00-05:00",
  precio: 15000,
};
const funcion5: FuncionConEvento = {
  id: 5,
  eventoId: 4,
  titulo: "Cartas a Medianoche",
  ciudad: "Neiva",
  lugar: "Teatro Municipal de Neiva",
  inicio: "2026-11-21T16:00:00-05:00",
  precio: 25000,
};
const funcion10: FuncionConEvento = {
  id: 10,
  eventoId: 8,
  titulo: "Del Grano a la Taza",
  ciudad: "Neiva",
  lugar: "Biblioteca Departamental",
  inicio: "2026-11-22T10:30:00-05:00",
  precio: 8000,
};

// Los 40 ids del plano, escritos a mano: cinco filas, de la A a la E, con ocho
// asientos. La API los responde ordenados por fila y por número.
const IDS_DEL_PLANO = [
  "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8",
  "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8",
  "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
  "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8",
  "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8",
];

/** Los 40 asientos del plano; los ids que se pasen salen como ocupados. */
function asientosDelPlano(ocupados: readonly string[] = []): Asiento[] {
  return IDS_DEL_PLANO.map(
    (id): Asiento => ({
      id,
      fila: id.slice(0, 1),
      numero: Number(id.slice(1)),
      estado: ocupados.includes(id) ? "ocupado" : "disponible",
    }),
  );
}

function asiento(id: string, estado: Asiento["estado"] = "disponible"): Asiento {
  return { id, fila: id.slice(0, 1), numero: Number(id.slice(1)), estado };
}

function funcionOk(funcion: FuncionConEvento): ResultadoFuncion {
  return { ok: true, funcion };
}

function asientosOk(asientos: Asiento[]): ResultadoAsientos {
  return { ok: true, asientos };
}

const funcionNoEncontrada: ResultadoFuncion = {
  ok: false,
  motivo: "no-encontrado",
};
const funcionConError: ResultadoFuncion = { ok: false, motivo: "error" };

/** La página lista; si no lo está, la prueba falla con el estado que llegó. */
function comoLista(pagina: PaginaCompra) {
  if (pagina.estado !== "lista") {
    throw new Error(`se esperaba «lista» y llegó «${pagina.estado}»`);
  }
  return pagina;
}

/** Los asientos de un resultado «no-disponibles»; si no lo es, la prueba falla. */
function asientosNoDisponibles(resultado: ResultadoCompra): string[] {
  if (resultado.ok || resultado.motivo !== "no-disponibles") {
    throw new Error("se esperaba un resultado «no-disponibles»");
  }
  return resultado.asientos;
}

// ---------------------------------------------------------------------------
// Datos del envío
// ---------------------------------------------------------------------------

/** La compra que responde el backend con 201 (contrato del plan: cinco campos). */
const COMPRA: CompraCreada = {
  codigo: "K7Q2M9XA",
  funcionId: 1,
  asientos: ["A1", "A2"],
  total: 30000,
  fecha: "2026-11-19T15:04:05-05:00",
};

/** Lo que se envía: siempre un objeto nuevo, para que ninguna prueba dependa de otra. */
function pedido() {
  return {
    asientos: ["A1", "A2"],
    nombre: "Ana Pérez",
    correo: "ana@correo.co",
  };
}

/** Lo que recibe el backend: el nombre y el correo, recortados. */
const CUERPO_ESPERADO = {
  asientos: ["A1", "A2"],
  nombre: "Ana Pérez",
  correo: "ana@correo.co",
};

const ERROR: ResultadoCompra = { ok: false, motivo: "error" };

/** El cuerpo con que el backend responde 409 (contrato del plan, D5). */
function cuerpo409(asientos?: unknown) {
  const lista = Array.isArray(asientos) ? asientos.join(", ") : "A2";
  return {
    statusCode: 409,
    message: `Estos asientos ya no están disponibles: ${lista}`,
    error: "Conflict",
    ...(asientos === undefined ? {} : { asientos }),
  };
}

/** Respuesta HTTP real de `fetch` con el cuerpo en JSON. */
function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** El mismo objeto sin uno de sus campos: para probar que ninguno es opcional. */
function sinCampo(objeto: object, campo: string): unknown {
  return Object.fromEntries(
    Object.entries(objeto).filter(([clave]) => clave !== campo),
  );
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let errorSpy: MockInstance<typeof console.error>;

beforeEach(() => {
  // Ninguna prueba llama al backend real. `unstubGlobals` y `restoreMocks`
  // (vitest.config.ts) deshacen estos dobles al terminar cada prueba.
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  // D14: `comprar` registra cada fallo con console.error. Se silencia el ruido y
  // el espía se guarda para comprobar cuándo sí se registra y cuándo no.
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

/** La dirección y las opciones con que se llamó a `fetch` (la llamada `indice`). */
function peticion(indice = 0) {
  const llamada = fetchMock.mock.calls[indice];
  return { url: llamada?.[0], init: llamada?.[1] };
}

/** El cuerpo JSON de la petición, ya leído. */
function cuerpoEnviado(indice = 0): unknown {
  const cuerpo = peticion(indice).init?.body;
  expect(typeof cuerpo, "el cuerpo de la petición es un texto JSON").toBe(
    "string",
  );
  return JSON.parse(String(cuerpo));
}

/**
 * Backend colgado: la promesa de `fetch` no se resuelve nunca y solo se rechaza
 * cuando se aborta la señal que recibió, como hace el `fetch` real. La prueba no
 * espera 5 s: sustituye `AbortSignal.timeout` por una señal que ella controla.
 */
function simularBackendColgado() {
  const corte = new AbortController();
  const timeoutSpy = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(corte.signal);
  fetchMock.mockImplementation(
    (_url, init) =>
      new Promise<Response>((_resolver, rechazar) => {
        const senal = init?.signal;
        if (senal) {
          senal.addEventListener("abort", () => rechazar(senal.reason));
        }
      }),
  );
  return { corte, timeoutSpy };
}

/** Vencen los 5 s: la señal se aborta con un TimeoutError, como la real. */
function vencenLosCincoSegundos(corte: AbortController) {
  corte.abort(new DOMException("The operation timed out.", "TimeoutError"));
}

// ---------------------------------------------------------------------------
// prepararCompra (D12): CA-6 y CA-11
// ---------------------------------------------------------------------------

describe("prepararCompra", () => {
  it("prepararCompra con la función y asientos del plano devuelve la compra lista, en el orden del mapa y con el total", () => {
    const pagina = prepararCompra(
      funcionOk(funcion1),
      asientosOk(asientosDelPlano()),
      "A2,A1",
    );

    // La fila del plan: la dirección dice A2,A1 y el mapa los pone A1, A2.
    expect(pagina).toStrictEqual({
      estado: "lista",
      funcion: funcion1,
      asientos: ["A1", "A2"],
      total: 30000,
    });
    // La función es la misma que entró: no se copia ni se reconstruye.
    expect(comoLista(pagina).funcion).toBe(funcion1);

    // Total = precio × cantidad, con otros precios y otras cantidades. Con seis
    // asientos todavía se acepta (el tope es `MAXIMO_POR_COMPRA`).
    const casos: Array<[string, FuncionConEvento, string, string[], number]> = [
      ["$ 25.000 × 1", funcion5, "C4", ["C4"], 25000],
      ["$ 25.000 × 2", funcion5, "E8,A1", ["A1", "E8"], 50000],
      [
        "$ 25.000 × 5",
        funcion5,
        "D2,B7,A1,E3,C5",
        ["A1", "B7", "C5", "D2", "E3"],
        125000,
      ],
      [
        "$ 25.000 × 6",
        funcion5,
        "A1,A2,A3,A4,A5,A6",
        ["A1", "A2", "A3", "A4", "A5", "A6"],
        150000,
      ],
      ["$ 8.000 × 3", funcion10, "B3,B1,B2", ["B1", "B2", "B3"], 24000],
      [
        "$ 8.000 × 6",
        funcion10,
        "E1,D1,C1,B1,A1,A2",
        ["A1", "A2", "B1", "C1", "D1", "E1"],
        48000,
      ],
      // El orden es el del mapa (fila y número), no el de la dirección.
      [
        "ids de filas distintas, desordenados",
        funcion1,
        "B1,A8,E1",
        ["A8", "B1", "E1"],
        45000,
      ],
      [
        "ids de una misma fila, desordenados",
        funcion1,
        "A8,A2,A5",
        ["A2", "A5", "A8"],
        45000,
      ],
      [
        "ids en el orden inverso del mapa",
        funcion1,
        "E1,D1,C1,B1,A1",
        ["A1", "B1", "C1", "D1", "E1"],
        75000,
      ],
    ];

    for (const [descripcion, funcion, parametro, esperados, total] of casos) {
      expect(
        prepararCompra(
          funcionOk(funcion),
          asientosOk(asientosDelPlano()),
          parametro,
        ),
        `compra lista con ${descripcion}`,
      ).toStrictEqual({ estado: "lista", funcion, asientos: esperados, total });
    }
  });

  it("prepararCompra usa la lista de asientos de la API tal como llegó, aunque no tenga 40", () => {
    // D4 y D12: el plano no se copia en el frontend; vale lo que responde la API.
    const parcial = asientosOk([
      asiento("A1"),
      asiento("A2"),
      asiento("A3", "ocupado"),
    ]);

    expect(prepararCompra(funcionOk(funcion1), parcial, "A2,A1")).toStrictEqual(
      { estado: "lista", funcion: funcion1, asientos: ["A1", "A2"], total: 30000 },
    );

    // A4 existe en el plano de siempre, pero no en la lista que respondió la API.
    for (const parametro of ["A4", "A1,A4"]) {
      expect(
        prepararCompra(funcionOk(funcion1), parcial, parametro),
        `dirección ${parametro}`,
      ).toStrictEqual({ estado: "sin-asientos", funcionId: 1 });
    }

    // Sin ningún asiento en la respuesta, ninguna dirección se sostiene.
    expect(
      prepararCompra(funcionOk(funcion1), asientosOk([]), "A1"),
    ).toStrictEqual({ estado: "sin-asientos", funcionId: 1 });
  });

  it("prepararCompra no modifica la función, los asientos ni el parámetro que recibe", () => {
    const funcion = funcionOk(structuredClone(funcion1));
    // La lista de la API llega al revés, para que un orden en el mismo arreglo
    // (`sort`, `reverse`) se note.
    const asientos = asientosOk(asientosDelPlano(["A3"]).reverse());
    const parametro = ["A2", "A1"];
    const antes = structuredClone({ funcion, asientos, parametro });

    prepararCompra(funcion, asientos, "B1,A8,A2");
    prepararCompra(funcion, asientos, parametro);

    expect({ funcion, asientos, parametro }).toStrictEqual(antes);
  });

  it("prepararCompra sin asientos, con uno que no existe, repetidos o más de 6 devuelve sin-asientos", () => {
    const casos: Array<[string, string | string[] | undefined]> = [
      // Falta en la dirección, o viene repetido (`?asientos=A1&asientos=A2`).
      ["sin el parámetro", undefined],
      ["un arreglo, porque el parámetro viene repetido", ["A1", "A2"]],
      ["un arreglo vacío", []],
      // Elementos vacíos, tras separar por coma.
      ["un texto vacío", ""],
      ["una coma al final", "A1,"],
      ["una coma al principio", ",A1"],
      ["dos comas seguidas", "A1,,A2"],
      ["solo una coma", ","],
      // Ids que no están en la lista de asientos de la API.
      ["un asiento que no existe", "Z9"],
      ["un asiento que no existe junto a uno válido", "A1,Z9"],
      ["un id en minúscula", "a1"],
      ["una columna que no existe", "A10"],
      ["una columna cero", "A0"],
      ["una fila que no existe", "F1"],
      ["un espacio antes del id", " A1"],
      ["un espacio después del id", "A1 "],
      ["un espacio después de la coma", "A1, A2"],
      ["una coma escrita como %2C", "A1%2CA2"],
      // Repetidos.
      ["el mismo asiento dos veces", "A1,A1"],
      ["un repetido que no es contiguo", "A1,A2,A1"],
      // Más de MAXIMO_POR_COMPRA (6).
      ["siete asientos válidos", "A1,A2,A3,A4,A5,A6,A7"],
      ["ocho asientos válidos", "A1,A2,A3,A4,A5,A6,A7,A8"],
    ];

    for (const [descripcion, parametro] of casos) {
      expect(
        prepararCompra(
          funcionOk(funcion5),
          asientosOk(asientosDelPlano()),
          parametro,
        ),
        `resultado con ${descripcion}`,
      ).toStrictEqual({ estado: "sin-asientos", funcionId: 5 });
    }

    // El id que devuelve es el de la función, no uno fijo.
    expect(
      prepararCompra(
        funcionOk(funcion10),
        asientosOk(asientosDelPlano()),
        undefined,
      ),
    ).toStrictEqual({ estado: "sin-asientos", funcionId: 10 });
    expect(
      prepararCompra(funcionOk(funcion1), asientosOk(asientosDelPlano()), "Z9"),
    ).toStrictEqual({ estado: "sin-asientos", funcionId: 1 });
  });

  it("prepararCompra no rechaza un asiento que ya está ocupado", () => {
    // D12: la ocupación puede cambiar entre la carga y el pago. La página muestra
    // el formulario y, si el asiento ya no está libre, el 409 del pago lo dice.
    const ocupados = ["A3", "A4", "C1", "C8", "D5", "E8"];
    const plano = asientosOk(asientosDelPlano(ocupados));

    expect(prepararCompra(funcionOk(funcion5), plano, "A3")).toStrictEqual({
      estado: "lista",
      funcion: funcion5,
      asientos: ["A3"],
      total: 25000,
    });
    expect(
      prepararCompra(funcionOk(funcion5), plano, "C1,A3,A1"),
    ).toStrictEqual({
      estado: "lista",
      funcion: funcion5,
      asientos: ["A1", "A3", "C1"],
      total: 75000,
    });
  });

  it("prepararCompra devuelve no-encontrada o error según la función y los asientos", () => {
    const plano = asientosOk(asientosDelPlano());
    const casos: Array<
      [
        string,
        ResultadoFuncion,
        ResultadoAsientos | null,
        string | string[] | undefined,
        PaginaCompra,
      ]
    > = [
      // La función no existe: el resultado no depende de los asientos ni de la
      // dirección. Sin función no hay un id al que llevar al mapa.
      [
        "la función no existe y los asientos son null",
        funcionNoEncontrada,
        null,
        "A1,A2",
        { estado: "no-encontrada" },
      ],
      [
        "la función no existe aunque los asientos cargaron",
        funcionNoEncontrada,
        plano,
        "A1,A2",
        { estado: "no-encontrada" },
      ],
      [
        "la función no existe y los asientos fallaron",
        funcionNoEncontrada,
        { ok: false },
        "A1,A2",
        { estado: "no-encontrada" },
      ],
      [
        "la función no existe y la dirección no trae asientos",
        funcionNoEncontrada,
        null,
        undefined,
        { estado: "no-encontrada" },
      ],
      [
        "la función no existe y la dirección trae un asiento inexistente",
        funcionNoEncontrada,
        plano,
        "Z9",
        { estado: "no-encontrada" },
      ],
      // La función no cargó.
      [
        "la función no cargó y los asientos son null",
        funcionConError,
        null,
        "A1,A2",
        { estado: "error" },
      ],
      [
        "la función no cargó aunque los asientos cargaron",
        funcionConError,
        plano,
        "A1,A2",
        { estado: "error" },
      ],
      [
        "la función no cargó y los asientos fallaron",
        funcionConError,
        { ok: false },
        "A1,A2",
        { estado: "error" },
      ],
      // La función cargó y los asientos no.
      [
        "la función cargó y los asientos fallaron",
        funcionOk(funcion1),
        { ok: false },
        "A1,A2",
        { estado: "error" },
      ],
      [
        "la función cargó y los asientos son null",
        funcionOk(funcion1),
        null,
        "A1,A2",
        { estado: "error" },
      ],
    ];

    for (const [descripcion, funcion, asientos, parametro, esperado] of casos) {
      expect(
        prepararCompra(funcion, asientos, parametro),
        `resultado cuando ${descripcion}`,
      ).toStrictEqual(esperado);
    }
  });
});

// ---------------------------------------------------------------------------
// validarComprador (D4): CA-7
// ---------------------------------------------------------------------------

const NOMBRE_VACIO = "Escribe tu nombre completo";
const NOMBRE_LARGO = "El nombre admite máximo 100 caracteres";
const CORREO_VACIO = "Escribe tu correo electrónico";
const CORREO_INVALIDO = "Escribe un correo electrónico válido";

/** Un correo con formato válido que mide exactamente `largo` caracteres. */
function correoDe(largo: number): string {
  const dominio = "@correo.co";
  return `${"a".repeat(largo - dominio.length)}${dominio}`;
}

describe("validarComprador", () => {
  it("validarComprador da el error de cada campo con las mismas reglas que la API", () => {
    // Sin errores: un objeto vacío, no uno con claves indefinidas.
    expect(
      validarComprador({ nombre: "Ana Pérez", correo: "ana@correo.co" }),
    ).toStrictEqual({});

    // El nombre: texto de 1 a 100 caracteres, ya recortado.
    const nombres: Array<[string, string, string | undefined]> = [
      ["vacío", "", NOMBRE_VACIO],
      ["solo espacios", "   ", NOMBRE_VACIO],
      ["solo tabulaciones y saltos de línea", "\t\n \r\n", NOMBRE_VACIO],
      // Vacío una vez recortado: manda el «vacío», no el «demasiado largo».
      ["150 espacios", " ".repeat(150), NOMBRE_VACIO],
      ["de 1 carácter", "A", undefined],
      ["de 100 caracteres", "N".repeat(100), undefined],
      ["de 101 caracteres", "N".repeat(101), NOMBRE_LARGO],
      ["de 300 caracteres", "N".repeat(300), NOMBRE_LARGO],
      // El recorte va antes de contar.
      [
        "de 100 caracteres con espacios alrededor",
        `   ${"N".repeat(100)}  `,
        undefined,
      ],
      [
        "de 100 caracteres con tabulaciones alrededor",
        `\t${"N".repeat(100)}\n`,
        undefined,
      ],
      [
        "de 101 caracteres con espacios alrededor",
        ` ${"N".repeat(101)} `,
        NOMBRE_LARGO,
      ],
      ["con tilde y eñe", "Ñandú Gómez", undefined],
    ];

    for (const [descripcion, nombre, mensaje] of nombres) {
      expect(
        validarComprador({ nombre, correo: "ana@correo.co" }),
        `nombre ${descripcion}`,
      ).toStrictEqual(mensaje === undefined ? {} : { nombre: mensaje });
    }

    // El correo: con formato `algo@algo.algo`, de máximo 254 caracteres.
    const correos: Array<[string, string, string | undefined]> = [
      ["vacío", "", CORREO_VACIO],
      ["solo espacios", "   ", CORREO_VACIO],
      ["solo tabulaciones y saltos de línea", "\t\n", CORREO_VACIO],
      ["sin arroba ni dominio", "ana", CORREO_INVALIDO],
      ["sin punto en el dominio", "ana@correo", CORREO_INVALIDO],
      ["con un espacio en la parte local", "ana correo@x.co", CORREO_INVALIDO],
      ["con un espacio en el dominio", "ana@correo .co", CORREO_INVALIDO],
      ["con un espacio entre dos palabras", "ana@correo.co otro", CORREO_INVALIDO],
      ["sin parte local", "@x.co", CORREO_INVALIDO],
      ["con dos arrobas seguidas", "ana@@correo.co", CORREO_INVALIDO],
      [
        "con dos correos",
        "ana@correo.co,otra@correo.co",
        CORREO_INVALIDO,
      ],
      ["con el punto al final", "ana@correo.", CORREO_INVALIDO],
      ["con el punto al principio del dominio", "ana@.co", CORREO_INVALIDO],
      ["de 254 caracteres", correoDe(254), undefined],
      ["de 255 caracteres", correoDe(255), CORREO_INVALIDO],
      // El recorte va antes de contar.
      ["de 254 caracteres con espacios alrededor", ` ${correoDe(254)} `, undefined],
      [
        "de 255 caracteres con espacios alrededor",
        ` ${correoDe(255)} `,
        CORREO_INVALIDO,
      ],
      ["con espacios y una tabulación alrededor", "  ana@correo.co\t", undefined],
      ["mínimo, de un carácter por parte", "a@b.c", undefined],
      ["con letras mayúsculas", "ANA@CORREO.CO", undefined],
      ["con un punto y un signo más", "ana.perez+boletas@mail.correo.co", undefined],
      ["con tilde y eñe en la parte local", "ñandú@correo.co", undefined],
    ];

    for (const [descripcion, correo, mensaje] of correos) {
      expect(
        validarComprador({ nombre: "Ana Pérez", correo }),
        `correo ${descripcion}`,
      ).toStrictEqual(mensaje === undefined ? {} : { correo: mensaje });
    }

    // Los dos campos pueden fallar a la vez.
    expect(validarComprador({ nombre: "", correo: "" })).toStrictEqual({
      nombre: NOMBRE_VACIO,
      correo: CORREO_VACIO,
    });
    expect(
      validarComprador({ nombre: "N".repeat(101), correo: "ana@correo" }),
    ).toStrictEqual({ nombre: NOMBRE_LARGO, correo: CORREO_INVALIDO });

    // La respuesta trae solo las claves que fallan.
    expect(
      Object.keys(validarComprador({ nombre: "", correo: "ana@correo.co" })),
    ).toStrictEqual(["nombre"]);
    expect(
      Object.keys(validarComprador({ nombre: "Ana", correo: "ana@correo" })),
    ).toStrictEqual(["correo"]);
  });
});

// ---------------------------------------------------------------------------
// comprar (D14): CA-1, CA-9, CA-10 y CA-12
// ---------------------------------------------------------------------------

describe("comprar", () => {
  it("comprar envía por POST los asientos, el nombre y el correo recortados y devuelve la compra aprobada", async () => {
    fetchMock.mockResolvedValueOnce(responder(COMPRA, 201));

    const resultado = await comprar(1, {
      asientos: ["A1", "A2"],
      nombre: "  Ana Pérez  ",
      correo: " ana@correo.co ",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = peticion();
    expect(url).toBe(`${API_URL}/funciones/1/compras`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
    // Hay una señal: es la que corta la espera a los 5 s.
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // El cuerpo lleva exactamente los tres campos, con el texto recortado.
    expect(cuerpoEnviado()).toStrictEqual(CUERPO_ESPERADO);
    // La compra aprobada: los cinco campos, ni más ni menos.
    expect(resultado).toStrictEqual({ ok: true, compra: COMPRA });
    expect(errorSpy).not.toHaveBeenCalled();

    // El recorte también quita tabulaciones y saltos de línea.
    fetchMock.mockResolvedValueOnce(responder(COMPRA, 201));

    const conOtrosBlancos = await comprar(1, {
      asientos: ["A1", "A2"],
      nombre: "\t Ana Pérez \n",
      correo: "\n ana@correo.co\t",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cuerpoEnviado(1)).toStrictEqual(CUERPO_ESPERADO);
    expect(conOtrosBlancos).toStrictEqual({ ok: true, compra: COMPRA });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("comprar usa el id de la función que recibe y envía solo asientos, nombre y correo", async () => {
    // El id de la ruta es el de la función que se pide, no uno fijo.
    fetchMock.mockResolvedValueOnce(responder({ ...COMPRA, funcionId: 7 }, 201));
    // El pedido trae campos de más (por ejemplo, de un objeto más grande): no
    // viajan. En particular, un `funcionId` del pedido no gana al de la ruta.
    const pedidoConDeMas = { ...pedido(), funcionId: 99, codigo: "ZZZZZZZZ" };

    const resultado = await comprar(7, pedidoConDeMas);

    expect(peticion().url).toBe(`${API_URL}/funciones/7/compras`);
    expect(cuerpoEnviado()).toStrictEqual(CUERPO_ESPERADO);
    expect(resultado).toStrictEqual({
      ok: true,
      compra: { ...COMPRA, funcionId: 7 },
    });

    fetchMock.mockResolvedValueOnce(
      responder({ ...COMPRA, funcionId: 12 }, 201),
    );

    await comprar(12, pedido());

    expect(peticion(1).url).toBe(`${API_URL}/funciones/12/compras`);
  });

  it("comprar acepta una fecha con cualquier desfase que Date.parse entienda", async () => {
    // Contrato del plan: la API escribe -05:00, pero el frontend acepta cualquier
    // ISO 8601 que `Date.parse` entienda, como hace con el `inicio` de una función.
    for (const fecha of ["2026-11-19T20:04:05Z", "2026-11-20T05:04:05+09:00"]) {
      const compra = { ...COMPRA, fecha };
      fetchMock.mockResolvedValueOnce(responder(compra, 201));

      const resultado = await comprar(1, pedido());

      expect(resultado, `resultado con la fecha ${fecha}`).toStrictEqual({
        ok: true,
        compra,
      });
    }

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("comprar no modifica la lista de asientos que recibe ni la comparte con el resultado", async () => {
    // Un arreglo congelado: cualquier intento de cambiarlo lanza.
    const pedidos = Object.freeze(["C2", "A1"]);

    // Lo que se envía son los asientos tal como se pasaron, sin reordenarlos.
    fetchMock.mockResolvedValueOnce(
      responder({ ...COMPRA, asientos: ["C2", "A1"] }, 201),
    );

    const aprobada = await comprar(1, {
      asientos: pedidos,
      nombre: "Ana Pérez",
      correo: "ana@correo.co",
    });

    expect(cuerpoEnviado()).toStrictEqual({
      asientos: ["C2", "A1"],
      nombre: "Ana Pérez",
      correo: "ana@correo.co",
    });
    expect(aprobada).toStrictEqual({
      ok: true,
      compra: { ...COMPRA, asientos: ["C2", "A1"] },
    });
    expect(pedidos).toStrictEqual(["C2", "A1"]);

    // Con un 409 sin lista, el resultado trae los asientos pedidos: una copia.
    fetchMock.mockResolvedValueOnce(responder(cuerpo409(), 409));

    const rechazada = await comprar(1, {
      asientos: pedidos,
      nombre: "Ana Pérez",
      correo: "ana@correo.co",
    });

    const devueltos = asientosNoDisponibles(rechazada);
    expect(devueltos).toStrictEqual(["C2", "A1"]);
    expect(devueltos).not.toBe(pedidos);
    // Quien reciba el resultado puede cambiarlo sin tocar la lista de origen.
    devueltos.push("Z9");
    expect(pedidos).toStrictEqual(["C2", "A1"]);
  });

  it("comprar devuelve error y lo registra si el 201 no trae una compra válida", async () => {
    const casos: Array<[string, Response]> = [
      // Los cinco campos son obligatorios.
      ["un 201 sin codigo", responder(sinCampo(COMPRA, "codigo"), 201)],
      ["un 201 sin funcionId", responder(sinCampo(COMPRA, "funcionId"), 201)],
      ["un 201 sin asientos", responder(sinCampo(COMPRA, "asientos"), 201)],
      ["un 201 sin total", responder(sinCampo(COMPRA, "total"), 201)],
      ["un 201 sin fecha", responder(sinCampo(COMPRA, "fecha"), 201)],
      // Un tipo equivocado en cada campo.
      ["un codigo que es un número", responder({ ...COMPRA, codigo: 12345678 }, 201)],
      ["un codigo nulo", responder({ ...COMPRA, codigo: null }, 201)],
      ["un funcionId que es texto", responder({ ...COMPRA, funcionId: "1" }, 201)],
      ["un funcionId nulo", responder({ ...COMPRA, funcionId: null }, 201)],
      [
        "unos asientos que son un texto",
        responder({ ...COMPRA, asientos: "A1,A2" }, 201),
      ],
      [
        "unos asientos con números en lugar de textos",
        responder({ ...COMPRA, asientos: [1, 2] }, 201),
      ],
      [
        "unos asientos con un null",
        responder({ ...COMPRA, asientos: ["A1", null] }, 201),
      ],
      ["unos asientos nulos", responder({ ...COMPRA, asientos: null }, 201)],
      ["un total que es texto", responder({ ...COMPRA, total: "30000" }, 201)],
      ["un total nulo", responder({ ...COMPRA, total: null }, 201)],
      ["una fecha que es un número", responder({ ...COMPRA, fecha: 20261119 }, 201)],
      ["una fecha nula", responder({ ...COMPRA, fecha: null }, 201)],
      [
        // `Date.parse` no la entiende.
        "una fecha que no es una fecha",
        responder({ ...COMPRA, fecha: "mañana" }, 201),
      ],
      ["una fecha vacía", responder({ ...COMPRA, fecha: "" }, 201)],
      [
        "una fecha con mes y hora imposibles",
        responder({ ...COMPRA, fecha: "2026-13-45T25:61:61-05:00" }, 201),
      ],
      // Un cuerpo que no es una compra.
      ["un 201 con null", responder(null, 201)],
      ["un 201 con un texto", responder("compra", 201)],
      ["un 201 con un número", responder(5, 201)],
      ["un 201 con true", responder(true, 201)],
      ["un 201 con un arreglo vacío", responder([], 201)],
      ["un 201 con un arreglo que trae una compra", responder([COMPRA], 201)],
      ["un 201 con un objeto vacío", responder({}, 201)],
      [
        "un 201 que no es JSON",
        new Response("<html>Created</html>", { status: 201 }),
      ],
      ["un 201 sin cuerpo", new Response(null, { status: 201 })],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await comprar(1, pedido());

      expect(resultado, `resultado cuando hay ${descripcion}`).toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando hay ${descripcion}`).toHaveBeenCalled();
    }

    // Una sola petición por compra: un 201 inválido no se reintenta.
    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("comprar con 409 devuelve los asientos no disponibles de la respuesta", async () => {
    fetchMock.mockResolvedValueOnce(responder(cuerpo409(["A2"]), 409));

    const resultado = await comprar(1, pedido());

    expect(resultado).toStrictEqual({
      ok: false,
      motivo: "no-disponibles",
      asientos: ["A2"],
    });
    // Un 409 con su lista es lo esperado: no es un fallo y no se registra.
    expect(errorSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // La lista es la de la respuesta (solo los no disponibles, en el orden en
    // que se pidieron), no la de los asientos que se pidieron.
    fetchMock.mockResolvedValueOnce(responder(cuerpo409(["A3", "C1"]), 409));

    const varios = await comprar(5, {
      asientos: ["A1", "A3", "C1"],
      nombre: "Ana Pérez",
      correo: "ana@correo.co",
    });

    expect(varios).toStrictEqual({
      ok: false,
      motivo: "no-disponibles",
      asientos: ["A3", "C1"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("comprar con un 409 sin lista válida devuelve los asientos pedidos y lo registra", async () => {
    const casos: Array<[string, Response]> = [
      ["el campo asientos ausente", responder(cuerpo409(), 409)],
      ["una lista vacía", responder(cuerpo409([]), 409)],
      ["asientos que es un texto", responder(cuerpo409("A2"), 409)],
      ["asientos que es un número", responder(cuerpo409(2), 409)],
      ["asientos nulo", responder(cuerpo409(null), 409)],
      [
        "asientos que es un objeto en lugar de una lista",
        responder(cuerpo409({ 0: "A2" }), 409),
      ],
      ["una lista de números", responder(cuerpo409([1, 2]), 409)],
      ["una lista con un null", responder(cuerpo409(["A2", null]), 409)],
      ["una lista con un número", responder(cuerpo409(["A2", 5]), 409)],
      ["una lista de listas", responder(cuerpo409([["A2"]]), 409)],
      ["un cuerpo nulo", responder(null, 409)],
      ["un cuerpo que es un texto", responder("conflicto", 409)],
      [
        "un cuerpo que no es JSON",
        new Response("<html>Conflict</html>", { status: 409 }),
      ],
      ["un cuerpo vacío", new Response(null, { status: 409 })],
    ];

    for (const [descripcion, respuesta] of casos) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      const resultado = await comprar(1, pedido());

      // El usuario igual debe ver que la compra no salió y poder elegir otros
      // asientos: se le muestran los que pidió.
      expect(resultado, `resultado con ${descripcion}`).toStrictEqual({
        ok: false,
        motivo: "no-disponibles",
        asientos: ["A1", "A2"],
      });
      // Pero la respuesta no era la del contrato: queda en el registro.
      expect(errorSpy, `registro con ${descripcion}`).toHaveBeenCalled();
    }

    expect(fetchMock).toHaveBeenCalledTimes(casos.length);
  });

  it("comprar devuelve error y lo registra si el backend no responde, tarda más de 5 s o responde 400, 404 o 500, y nunca lanza", async () => {
    // 1. El backend no responde: `fetch` rechaza, o lanza, por distintas causas.
    const caidas: Array<[string, () => void]> = [
      [
        "fetch rechaza con un TypeError",
        () => fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")),
      ],
      [
        "fetch rechaza con un AbortError",
        () =>
          fetchMock.mockRejectedValueOnce(
            new DOMException("The operation was aborted.", "AbortError"),
          ),
      ],
      [
        "fetch rechaza con un TimeoutError",
        () =>
          fetchMock.mockRejectedValueOnce(
            new DOMException("The operation timed out.", "TimeoutError"),
          ),
      ],
      [
        "fetch rechaza con un texto",
        () => fetchMock.mockRejectedValueOnce("sin conexión"),
      ],
      [
        "fetch lanza sin devolver una promesa",
        () =>
          fetchMock.mockImplementationOnce(() => {
            throw new TypeError("Failed to parse URL");
          }),
      ],
    ];

    for (const [descripcion, preparar] of caidas) {
      errorSpy.mockClear();
      preparar();

      // `resolves`: la promesa se resuelve. Nunca se rechaza.
      await expect(comprar(1, pedido()), descripcion).resolves.toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }
    expect(fetchMock).toHaveBeenCalledTimes(caidas.length);

    // 2. El backend responde, pero con un código que no es el 201 (ni el 409).
    const respuestas: Array<[string, Response]> = [
      [
        "el backend responde 400",
        responder(
          {
            statusCode: 400,
            message: "El asiento Z9 no existe en el lugar",
            error: "Bad Request",
          },
          400,
        ),
      ],
      [
        "el backend responde 404",
        responder(
          {
            statusCode: 404,
            message: "La función 9999 no existe",
            error: "Not Found",
          },
          404,
        ),
      ],
      [
        "el backend responde 500",
        responder(
          {
            statusCode: 500,
            message: "No se pudo generar un código de compra único",
            error: "Internal Server Error",
          },
          500,
        ),
      ],
      [
        "el backend responde 503",
        responder({ statusCode: 503, message: "Service unavailable" }, 503),
      ],
      [
        "el backend responde 502 con una página HTML",
        new Response("<html>Bad gateway</html>", { status: 502 }),
      ],
      [
        // Fuera de lo previsto: ni 201, ni 409, ni 400, ni 404, ni 5xx.
        "el backend responde 403",
        responder({ statusCode: 403, message: "Forbidden" }, 403),
      ],
      [
        // El código manda: un cuerpo de compra con un 500 no es una compra.
        "el backend responde 500 con el cuerpo de una compra",
        responder(COMPRA, 500),
      ],
    ];

    for (const [descripcion, respuesta] of respuestas) {
      errorSpy.mockClear();
      fetchMock.mockResolvedValueOnce(respuesta);

      await expect(comprar(1, pedido()), descripcion).resolves.toStrictEqual(
        ERROR,
      );
      expect(errorSpy, `registro cuando ${descripcion}`).toHaveBeenCalled();
    }
    // Una petición por compra: un fallo no se reintenta por su cuenta.
    expect(fetchMock).toHaveBeenCalledTimes(caidas.length + respuestas.length);

    // 3. El backend se cuelga: la espera se corta a los 5 s.
    expect(ESPERA_MAXIMA_MS).toBe(5000);
    errorSpy.mockClear();
    const { corte, timeoutSpy } = simularBackendColgado();

    const espera = comprar(1, pedido());

    // Se pidió un corte de 5000 ms y `fetch` recibió exactamente esa señal.
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledTimes(
        caidas.length + respuestas.length + 1,
      ),
    );
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    const ultima = peticion(fetchMock.mock.calls.length - 1);
    expect(ultima.url).toBe(`${API_URL}/funciones/1/compras`);
    expect(ultima.init?.signal).toBe(corte.signal);

    vencenLosCincoSegundos(corte);

    await expect(espera).resolves.toStrictEqual(ERROR);
    expect(errorSpy).toHaveBeenCalled();
  });
});
