import Form from "next/form";
import { CATEGORIAS, NOMBRE_CATEGORIA, type Filtros } from "@/lib/eventos";

interface FiltrosCarteleraProps {
  ciudades: string[];
  filtros: Filtros;
}

const ETIQUETA = "text-sm font-semibold text-zinc-950 dark:text-zinc-50";

// «Campo de texto» de la guía visual. En una fila de formulario todo mide lo
// mismo: `h-12` (48 px) ocupa el lugar de `min-h-11`, que con esa altura nunca
// se aplicaría. La «Lista desplegable» usa las mismas clases.
const DESPLEGABLE =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:focus-visible:outline-blue-400";

// «Campo de fecha» de la guía: las del campo de texto y `dark:scheme-dark`, para
// que el icono del calendario se vea en tema oscuro.
const CAMPO_FECHA = `${DESPLEGABLE} dark:scheme-dark`;

// «Botón secundario» de la guía, con la misma altura (`h-12`) que los campos de
// su fila. Sin `py-3`: la altura fija ya la da `h-12` y el botón centra el
// texto en vertical; con `py-3` el texto se saldría 2 px de su caja.
const BOTON_SECUNDARIO =
  "h-12 w-full rounded-lg border border-zinc-300 px-5 text-base font-semibold text-zinc-950 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:border-zinc-600 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:focus-visible:outline-blue-400 sm:w-auto";

/**
 * Filtros de la cartelera: dos desplegables nativos, un campo de fecha nativo y
 * un botón «Filtrar». Al enviarse, `Form` navega a
 * `/?categoria=…&ciudad=…&fecha=…`; un valor vacío es «Todas». Quien lo use debe
 * darle una `key` armada con los filtros, porque React no aplica un
 * `defaultValue` nuevo a un campo ya montado.
 */
export default function FiltrosCartelera({
  ciudades,
  filtros,
}: FiltrosCarteleraProps) {
  return (
    <Form
      action="/"
      className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex flex-col gap-1.5 sm:w-56">
        <label htmlFor="filtro-categoria" className={ETIQUETA}>
          Categoría
        </label>
        <select
          id="filtro-categoria"
          name="categoria"
          defaultValue={filtros.categoria ?? ""}
          className={DESPLEGABLE}
        >
          <option value="">Todas</option>
          {CATEGORIAS.map((categoria) => (
            <option key={categoria} value={categoria}>
              {NOMBRE_CATEGORIA[categoria]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5 sm:w-56">
        <label htmlFor="filtro-ciudad" className={ETIQUETA}>
          Ciudad
        </label>
        <select
          id="filtro-ciudad"
          name="ciudad"
          defaultValue={filtros.ciudad ?? ""}
          className={DESPLEGABLE}
        >
          <option value="">Todas</option>
          {ciudades.map((ciudad) => (
            <option key={ciudad} value={ciudad}>
              {ciudad}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5 sm:w-56">
        <label htmlFor="filtro-fecha" className={ETIQUETA}>
          Fecha
        </label>
        <input
          type="date"
          id="filtro-fecha"
          name="fecha"
          defaultValue={filtros.fecha ?? ""}
          className={CAMPO_FECHA}
        />
      </div>
      <button type="submit" className={BOTON_SECUNDARIO}>
        Filtrar
      </button>
    </Form>
  );
}
