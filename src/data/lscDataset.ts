export type TipoDatoLSC =
  | "video"
  | "landmarks"
  | "movimiento"
  | "imagen"
  | "texto";

export type EstadoDatoLSC =
  | "pendiente"
  | "validado"
  | "aprobado-entrenamiento"
  | "rechazado";

export type MuestraLSC = {
  id: string;

  senaId: string;

  concepto: string;

  fuenteId: string;

  tipoDato: TipoDatoLSC;

  archivo: string | null;

  duracionSegundos: number | null;

  fps: number | null;

  numeroManos: number | null;

  region: string | null;

  contexto: string | null;

  estado: EstadoDatoLSC;

  validacionLingüistica: boolean;

  permisoUso: boolean;

  permisoEntrenamientoIA: boolean;

  observaciones: string;
};

/*
 * Aquí registraremos posteriormente los vídeos y
 * demás muestras que realmente puedan utilizarse
 * para desarrollar el reconocimiento automático.
 *
 * No se agregan vídeos todavía.
 * Primero construiremos el sistema y verificaremos
 * permisos y validación.
 */


export const muestrasLSC: MuestraLSC[] = [
  {
    id: "lsc50-muestra-pendiente-001",
    senaId: "pendiente-asociacion",
    concepto: "Etiqueta LSC50 pendiente de identificar",
    fuenteId: "lsc50",
    tipoDato: "video",
    archivo: null,
    duracionSegundos: null,
    fps: null,
    numeroManos: null,
    region: "Colombia",
    contexto: null,
    estado: "pendiente",
    validacionLingüistica: false,
    permisoUso: false,
    permisoEntrenamientoIA: false,
    observaciones:
      "Registro preparatorio. Falta identificar la clase y el archivo original, comprobar sus condiciones de uso y asociarlo con una seña del catálogo. No utilizar para entrenamiento.",
  },
];

/**
 * Busca las muestras asociadas a una seña.
 */
export function obtenerMuestrasPorSena(
  senaId: string
): MuestraLSC[] {
  return muestrasLSC.filter(
    (muestra) =>
      muestra.senaId === senaId
  );
}

/**
 * Devuelve únicamente muestras que cumplen
 * los requisitos básicos para entrenamiento.
 */
export function obtenerMuestrasParaEntrenamiento(): MuestraLSC[] {
  return muestrasLSC.filter(
    (muestra) =>
      muestra.estado ===
        "aprobado-entrenamiento" &&
      muestra.validacionLingüistica &&
      muestra.permisoUso &&
      muestra.permisoEntrenamientoIA
  );
}