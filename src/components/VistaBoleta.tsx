import Link from "next/link";
import CodigoQr from "@/components/CodigoQr";
import IngresoBoleta from "@/components/IngresoBoleta";
import type { Boleta, ResultadoBoleta } from "@/lib/boletas";
import { formatDia, formatHora } from "@/lib/formato";
import { rutaDeBoleta } from "@/lib/ingreso";

interface VistaBoletaProps {
  resultado: ResultadoBoleta;
  /** El origen de la petición («http://localhost:3000»); `null` si no hay uno válido. */
  origen: string | null;
}

const TITULO_PAGINA =
  "text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";

/**
 * Página de una boleta. Pinta los tres estados de `getBoleta` (la boleta, «no
 * encontrada» y «error») y, arriba, el enlace para volver a la cartelera, que es
 * el mismo en los tres. Cada estado tiene su propio `h1` (un solo `h1` por
 * página).
 *
 * Con la boleta, el código QR lleva la dirección de esta misma página, armada
 * con el origen de la petición; sin origen no se dibuja. El estado y el botón de
 * validar son de `IngresoBoleta`, el único componente de cliente. Nunca se
 * pinta el correo, y el día y la hora salen de `lib/formato.ts`.
 */
export default function VistaBoleta({ resultado, origen }: VistaBoletaProps) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-start gap-8">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-zinc-700 underline underline-offset-4 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:text-zinc-50 dark:focus-visible:outline-blue-400"
      >
        Volver a la cartelera
      </Link>

      {resultado.ok ? (
        <div className="flex w-full flex-col gap-6">
          <h1 className={TITULO_PAGINA}>Tu boleta</h1>
          <Datos boleta={resultado.boleta} origen={origen} />
        </div>
      ) : resultado.motivo === "no-encontrada" ? (
        <h1 className={TITULO_PAGINA}>No encontramos una boleta con ese código</h1>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <h1 className={TITULO_PAGINA}>No pudimos cargar la boleta</h1>
          <p
            role="alert"
            className="w-full rounded-xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            No pudimos cargar la boleta. Intenta de nuevo en unos minutos.
          </p>
        </div>
      )}
    </div>
  );
}

function Datos({ boleta, origen }: { boleta: Boleta; origen: string | null }) {
  return (
    <div className="flex w-full flex-col gap-6 rounded-xl border border-black/[.08] bg-white p-6 shadow-sm dark:border-white/[.145] dark:bg-zinc-900">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <Dato termino="Evento" valor={boleta.titulo} />
        <Dato termino="Día" valor={formatDia(boleta.inicio)} />
        <Dato termino="Hora" valor={formatHora(boleta.inicio)} />
        <Dato termino="Lugar" valor={boleta.lugar} />
        <Dato termino="Ciudad" valor={boleta.ciudad} />
        <Dato termino="Asientos" valor={boleta.asientos.join(", ")} />
        <Dato termino="A nombre de" valor={boleta.nombre} />
        <Dato termino="Código" valor={boleta.codigo} />
      </dl>
      {origen === null ? null : (
        <CodigoQr
          direccion={`${origen}${rutaDeBoleta(boleta.codigo)}`}
          codigo={boleta.codigo}
        />
      )}
      <IngresoBoleta
        codigo={boleta.codigo}
        estado={boleta.estado}
        fechaUso={boleta.fechaUso}
      />
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
