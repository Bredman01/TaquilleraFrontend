"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type HTMLInputAutoCompleteAttribute,
  type HTMLInputTypeAttribute,
  type Ref,
} from "react";
import {
  comprar,
  validarComprador,
  type CompraCreada,
  type ErroresComprador,
} from "@/lib/compras";
import { formatPrecio } from "@/lib/formato";

interface FormularioCompraProps {
  funcionId: number;
  /** Los ids de los asientos de la compra, en el orden del mapa. */
  asientos: string[];
  /** Pesos colombianos: precio por la cantidad de asientos. */
  total: number;
}

/**
 * En qué va el formulario. `aprobada` y `no-disponibles` reemplazan los campos;
 * `error` los deja con lo escrito y suma el aviso de fallo encima del botón.
 */
type Estado =
  | { tipo: "editando" }
  | { tipo: "procesando" }
  | { tipo: "aprobada"; compra: CompraCreada }
  | { tipo: "no-disponibles"; asientos: string[] }
  | { tipo: "error" };

// Las clases salen de las piezas de la guía visual. En una fila de formulario
// todo mide lo mismo: `h-12` (48 px) ocupa el lugar de `min-h-11` en el campo y
// de `py-3` en el botón, porque la altura fija ya la da `h-12`.
const ETIQUETA = "text-sm font-semibold text-zinc-950 dark:text-zinc-50";
const CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-blue-400";
const ERROR_DE_CAMPO = "text-sm text-red-700 dark:text-red-300";
const MENSAJE_DE_ERROR =
  "rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200";
const MENSAJE_DE_EXITO =
  "rounded-xl border border-green-200 bg-green-50 p-6 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200";
const TITULO_DE_SECCION =
  "text-xl font-semibold text-zinc-950 dark:text-zinc-50";
const FOCO_DE_TECLADO =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400";

// «Botón principal» con «Botón o control deshabilitado».
const BOTON_PAGAR =
  "h-12 w-full rounded-lg bg-zinc-950 px-5 text-base font-semibold text-white enabled:hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:enabled:hover:bg-zinc-200 dark:focus-visible:outline-blue-400 sm:w-auto";

// «Botón principal» en un enlace: lleva `hover:` y no `enabled:hover:`.
const ENLACE_COMO_BOTON =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-950 px-5 py-3 text-base font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:outline-blue-400";

/**
 * Ref estable que da el foco al elemento cuando aparece. Al estar definida fuera
 * de los componentes, React la llama solo al montar y no en cada render.
 */
function enfocarAlAparecer(elemento: HTMLElement | null) {
  elemento?.focus();
}

/**
 * Formulario de pago de la compra: pide el nombre y el correo, valida con
 * `validarComprador`, paga con `comprar` y pinta lo que pasó. Es el único
 * componente de cliente de la página de compra: las reglas y el envío viven en
 * `lib/compras.ts`; aquí solo se pinta y se avisa.
 *
 * El foco:
 * - con errores de campo, pasa al primer campo con error (el nombre va antes);
 * - con la compra aprobada, al `h2` «¡Compra aprobada!»;
 * - con asientos no disponibles, al enlace «Elegir otros asientos»;
 * - tras un fallo del pago, vuelve al botón de pago: un botón que se deshabilita
 *   mientras tiene el foco lo pierde, y quien usa el teclado empezaría de nuevo.
 */
export default function FormularioCompra({
  funcionId,
  asientos,
  total,
}: FormularioCompraProps) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [errores, setErrores] = useState<ErroresComprador>({});
  const [estado, setEstado] = useState<Estado>({ tipo: "editando" });
  const nombreRef = useRef<HTMLInputElement>(null);
  const correoRef = useRef<HTMLInputElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const fallo = estado.tipo === "error";
  useEffect(() => {
    if (fallo) botonRef.current?.focus();
  }, [fallo]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    // Un segundo envío mientras se paga (Enter dentro de un campo, otro clic) no
    // vuelve a llamar a la API.
    if (estado.tipo === "procesando") return;

    const nuevos = validarComprador({ nombre, correo });
    setErrores(nuevos);
    if (nuevos.nombre !== undefined) {
      nombreRef.current?.focus();
      return;
    }
    if (nuevos.correo !== undefined) {
      correoRef.current?.focus();
      return;
    }

    setEstado({ tipo: "procesando" });
    const resultado = await comprar(funcionId, { asientos, nombre, correo });
    if (resultado.ok) {
      setEstado({ tipo: "aprobada", compra: resultado.compra });
    } else if (resultado.motivo === "no-disponibles") {
      setEstado({ tipo: "no-disponibles", asientos: resultado.asientos });
    } else {
      setEstado({ tipo: "error" });
    }
  }

  if (estado.tipo === "aprobada") {
    const { compra } = estado;
    return (
      <div className={`flex w-full flex-col gap-4 ${MENSAJE_DE_EXITO}`}>
        <h2
          ref={enfocarAlAparecer}
          tabIndex={-1}
          className={`${TITULO_DE_SECCION} ${FOCO_DE_TECLADO}`}
        >
          ¡Compra aprobada!
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <Dato termino="Código de la compra" valor={compra.codigo} />
          <Dato termino="Asientos" valor={compra.asientos.join(", ")} />
          <Dato termino="Total" valor={formatPrecio(compra.total)} />
        </dl>
      </div>
    );
  }

  if (estado.tipo === "no-disponibles") {
    return (
      <div
        role="alert"
        className={`flex w-full flex-col items-start gap-4 ${MENSAJE_DE_ERROR}`}
      >
        <p>{`Estos asientos ya no están disponibles: ${estado.asientos.join(", ")}`}</p>
        <Link
          ref={enfocarAlAparecer}
          href={`/funciones/${funcionId}`}
          className={ENLACE_COMO_BOTON}
        >
          Elegir otros asientos
        </Link>
      </div>
    );
  }

  const procesando = estado.tipo === "procesando";
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="flex w-full flex-col gap-4"
    >
      <h2 id={`${id}-titulo`} className={TITULO_DE_SECCION}>
        Tus datos
      </h2>
      <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
        <CampoDeTexto
          ref={nombreRef}
          id={`${id}-nombre`}
          nombre="nombre"
          etiqueta="Nombre completo"
          tipo="text"
          autoComplete="name"
          valor={nombre}
          alCambiar={setNombre}
          error={errores.nombre}
        />
        <CampoDeTexto
          ref={correoRef}
          id={`${id}-correo`}
          nombre="correo"
          etiqueta="Correo electrónico"
          tipo="email"
          autoComplete="email"
          valor={correo}
          alCambiar={setCorreo}
          error={errores.correo}
        />
        {fallo ? (
          <p role="alert" className={MENSAJE_DE_ERROR}>
            No pudimos procesar el pago. Revisa tu conexión e inténtalo de
            nuevo.
          </p>
        ) : null}
        <button
          ref={botonRef}
          type="submit"
          disabled={procesando}
          className={BOTON_PAGAR}
        >
          {procesando ? "Procesando pago…" : `Pagar ${formatPrecio(total)}`}
        </button>
      </form>
    </section>
  );
}

interface CampoDeTextoProps {
  ref: Ref<HTMLInputElement>;
  id: string;
  nombre: string;
  etiqueta: string;
  tipo: HTMLInputTypeAttribute;
  autoComplete: HTMLInputAutoCompleteAttribute;
  valor: string;
  alCambiar: (valor: string) => void;
  /** El mensaje del campo; sin error, `undefined`. */
  error: string | undefined;
}

/**
 * Un campo con su etiqueta visible encima y, si falla, su error debajo, unido
 * con `aria-describedby`. La descripción del campo es exactamente el mensaje.
 */
function CampoDeTexto({
  ref,
  id,
  nombre,
  etiqueta,
  tipo,
  autoComplete,
  valor,
  alCambiar,
  error,
}: CampoDeTextoProps) {
  const idError = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={ETIQUETA}>
        {etiqueta}
      </label>
      <input
        ref={ref}
        id={id}
        name={nombre}
        type={tipo}
        autoComplete={autoComplete}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : idError}
        className={CAMPO}
      />
      {error === undefined ? null : (
        <p id={idError} className={ERROR_DE_CAMPO}>
          {error}
        </p>
      )}
    </div>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <>
      <dt className="font-semibold text-zinc-950 dark:text-zinc-50">
        {termino}
      </dt>
      <dd className="text-zinc-600 dark:text-zinc-400">{valor}</dd>
    </>
  );
}
