"use client";

import { useRouter } from "next/navigation";
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { rutaDeConsulta } from "@/lib/ingreso";

// Las clases salen de las piezas de la guía visual: «Etiqueta de un campo»,
// «Campo de texto», «Botón secundario» y «Error de un campo», con los ajustes de
// «Formulario del encabezado». `h-12` (48 px) ocupa el lugar de `min-h-11` en el
// campo y de `py-3` en el botón, para que midan lo mismo. El borde del campo es
// `zinc-500` en los dos temas, sin `dark:border-…`.
const ETIQUETA = "text-sm font-semibold text-zinc-950 dark:text-zinc-50";
const CAMPO =
  "h-12 w-full min-w-0 flex-1 rounded-lg border border-zinc-500 bg-white px-3 py-2.5 text-base text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-blue-400 sm:w-56 sm:flex-none";
const BOTON_SECUNDARIO =
  "h-12 shrink-0 rounded-lg border border-zinc-300 px-5 text-base font-semibold text-zinc-950 enabled:hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:border-zinc-600 dark:text-zinc-50 dark:enabled:hover:bg-zinc-800 dark:focus-visible:outline-blue-400";
const ERROR_DE_CAMPO = "text-sm text-red-700 dark:text-red-300";

/**
 * Formulario «Consultar boleta» del encabezado: lleva a la página de una boleta
 * a partir de su código. Es de cliente porque arma una ruta (`rutaDeConsulta`,
 * en `lib/ingreso.ts`) y muestra su error junto al campo; no depende de la
 * dirección de la página, así que el encabezado sigue sin datos de la petición.
 *
 * Con el campo vacío o solo con espacios no navega: muestra el error del campo
 * y le da el foco. El error se va al escribir, y lo escrito no se recorta ni se
 * borra.
 */
export default function ConsultarBoleta() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [sinCodigo, setSinCodigo] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const idCampo = `${id}-codigo`;
  const idError = `${id}-error`;

  function alEscribir(evento: ChangeEvent<HTMLInputElement>) {
    setTexto(evento.target.value);
    setSinCodigo(false);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const ruta = rutaDeConsulta(texto);
    if (ruta === null) {
      setSinCodigo(true);
      campoRef.current?.focus();
      return;
    }

    setSinCodigo(false);
    router.push(ruta);
  }

  return (
    <form
      role="search"
      aria-label="Consultar boleta"
      onSubmit={enviar}
      className="flex w-full flex-col gap-1.5 sm:w-auto"
    >
      <label htmlFor={idCampo} className={ETIQUETA}>
        Código de la boleta
      </label>
      <div className="flex gap-2">
        <input
          ref={campoRef}
          id={idCampo}
          name="codigo"
          type="text"
          value={texto}
          onChange={alEscribir}
          aria-invalid={sinCodigo ? true : undefined}
          aria-describedby={sinCodigo ? idError : undefined}
          className={CAMPO}
        />
        <button type="submit" className={BOTON_SECUNDARIO}>
          Consultar
        </button>
      </div>
      {sinCodigo ? (
        <p id={idError} className={ERROR_DE_CAMPO}>
          Escribe el código de la boleta
        </p>
      ) : null}
    </form>
  );
}
