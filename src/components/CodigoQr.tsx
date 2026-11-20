import { matrizQr, trazoQr, ZONA_DE_SILENCIO } from "@/lib/qr";

interface CodigoQrProps {
  /** Lo que lleva el código: la dirección completa de la página de la boleta. */
  direccion: string;
  /** El código de la boleta, para el texto alternativo. */
  codigo: string;
}

/**
 * El código QR de la boleta, dibujado como un svg propio: un fondo blanco que lo
 * cubre todo y un solo trazo con un cuadrado de 1 × 1 por módulo oscuro. Es la
 * pieza «Código QR» de la guía visual.
 *
 * Va oscuro sobre blanco en los dos temas (sin variantes para el tema oscuro):
 * no todas las cámaras leen un QR claro sobre fondo oscuro. El lado del svg es el tamaño del
 * QR más la zona de silencio a cada lado, que el trazo ya trae corrida.
 *
 * Es de servidor y es el único componente que usa `lib/qr.ts`.
 */
export default function CodigoQr({ direccion, codigo }: CodigoQrProps) {
  const matriz = matrizQr(direccion);
  const lado = matriz.length + 2 * ZONA_DE_SILENCIO;

  return (
    <svg
      role="img"
      aria-label={`Código QR de la boleta ${codigo}`}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      className="size-56"
    >
      <rect width={lado} height={lado} className="fill-white" />
      <path d={trazoQr(matriz)} className="fill-zinc-950" />
    </svg>
  );
}
