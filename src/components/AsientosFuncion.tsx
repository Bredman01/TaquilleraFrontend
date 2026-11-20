import MapaAsientos from "@/components/MapaAsientos";
import type { ResultadoAsientos } from "@/lib/funciones";

interface AsientosFuncionProps {
  resultado: ResultadoAsientos;
  funcionId: number;
  /** Pesos colombianos por boleta. */
  precio: number;
}

/**
 * La sección de asientos de una función. Pinta los dos estados que devuelve
 * `getAsientos`: el aviso, si no se pudieron cargar, o el mapa. El aviso se
 * decide aquí, en el servidor: el mapa (el componente de cliente) solo recibe
 * asientos válidos.
 */
export default function AsientosFuncion({
  resultado,
  funcionId,
  precio,
}: AsientosFuncionProps) {
  if (!resultado.ok) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        No pudimos cargar los asientos. Intenta de nuevo en unos minutos.
      </p>
    );
  }

  return (
    <MapaAsientos
      funcionId={funcionId}
      precio={precio}
      asientos={resultado.asientos}
    />
  );
}
