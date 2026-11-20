/**
 * Lo que comparte todo el acceso a la API. Va aparte, sin imports, para que
 * `lib/compras.ts`, que corre en el navegador, no arrastre `lib/eventos.ts`
 * (`next/navigation`, `react` y el acceso a los eventos).
 *
 * `process.env.NEXT_PUBLIC_API_URL` se escribe tal cual: Next lo sustituye por
 * su valor también en el paquete del navegador.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Un backend que no responde en este tiempo se da por caído. */
export const ESPERA_MAXIMA_MS = 5000;
