/** Idioma de todo lo que se escribe para el público. */
const IDIOMA = "es-CO";

/**
 * Las funciones son «en el lugar del evento»: los días y las horas se escriben
 * siempre en Colombia, sin importar la zona del servidor ni la del navegador.
 */
const ZONA_COLOMBIA = "America/Bogota";

// Los formateadores se crean una sola vez: construir un `Intl` es lo caro.
const formatoDia = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: ZONA_COLOMBIA,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const formatoHora = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: ZONA_COLOMBIA,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const formatoFecha = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: ZONA_COLOMBIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatoPrecio = new Intl.NumberFormat(IDIOMA, {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  // También las cifras de cuatro dígitos llevan punto de miles: «$ 8.000».
  useGrouping: "always",
});

/** ICU separa «$» del número y «p.» de «m.» con U+00A0 o U+202F: se cambian por un espacio normal. */
const ESPACIOS_ESPECIALES = /[\u00A0\u202F]/g;

function conEspaciosNormales(texto: string): string {
  return texto.replace(ESPACIOS_ESPECIALES, " ");
}

/** 118 → "1 h 58 min", 120 → "2 h", 45 → "45 min". */
export function formatDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

/** 15000 → "$ 15.000"; sin decimales. */
export function formatPrecio(pesos: number): string {
  return conEspaciosNormales(formatoPrecio.format(pesos));
}

/** "2026-11-21T16:00:00-05:00" → "sábado, 21 de noviembre" (el día de Colombia). */
export function formatDia(inicio: string): string {
  return conEspaciosNormales(formatoDia.format(new Date(inicio)));
}

/** "2026-11-22T19:30:00-05:00" → "7:30 p. m." (la hora de Colombia, en 12 horas). */
export function formatHora(inicio: string): string {
  return conEspaciosNormales(formatoHora.format(new Date(inicio)));
}

/** "2026-11-22T04:30:00Z" → "2026-11-21": el día `AAAA-MM-DD` en Colombia. */
export function diaEnColombia(inicio: string): string {
  const partes = formatoFecha.formatToParts(new Date(inicio));
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}
