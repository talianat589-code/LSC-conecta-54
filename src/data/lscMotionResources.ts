
export type FormatoMovimientoLSC =
| "landmarks-mediapipe"
| "animacion-glb"
| "animacion-gltf"
| "video-referencia"
| "otro";

export type EstadoMovimientoLSC =
| "pendiente"
| "en-revision"
| "apto-para-pruebas"
| "no-apto";

export type PermisoMovimientoLSC =
| "por-verificar"
| "permitido"
| "no-permitido";

import type {
  SecuenciaMovimientoLSC,
} from "./lscMotionPlayer";

export type RegistroMovimientoLSC = {
  id: string;
  senaId: string;

  nombre: string;
  descripcion: string;

  formato: FormatoMovimientoLSC;

  archivoUrl: string | null;

  secuencia: SecuenciaMovimientoLSC | null;

fuente: {
  nombre: string;
  url: string;
  licencia: string;
  permisoUso: PermisoMovimientoLSC;
  evidenciaPermiso: string;
};

captura: {
  dispositivo: string;
  modeloEsqueleto: string;
  cantidadFotogramas: number;
  frecuenciaFps: number;
  incluyeManos: boolean;
  incluyeExpresionFacial: boolean;
};

revision: {
  estado: EstadoMovimientoLSC;
  responsableTecnico: string;
  responsableLingüistico: string;
  fecha: string;
  observaciones: string;
};
};

export const movimientosLSC: RegistroMovimientoLSC[] = [];

export function obtenerMovimientoPorSena(
senaId: string
): RegistroMovimientoLSC[] {
return movimientosLSC.filter(
  (movimiento) => movimiento.senaId === senaId
);
}

export function diagnosticarMovimientoLSC(
movimiento: RegistroMovimientoLSC
): string[] {
const problemas: string[] = [];

if (!movimiento.id.trim()) {
  problemas.push("Falta el identificador del movimiento.");
}

if (!movimiento.senaId.trim()) {
  problemas.push("Falta asociar el movimiento a una seña.");
}

if (!movimiento.nombre.trim()) {
  problemas.push("Falta el nombre del movimiento.");
}

if (!movimiento.fuente.nombre.trim()) {
  problemas.push("Falta identificar la fuente.");
}

if (!movimiento.fuente.licencia.trim()) {
  problemas.push("Falta documentar la licencia.");
}

if (
  movimiento.fuente.permisoUso !== "permitido"
) {
  problemas.push(
    "El permiso de uso no está confirmado."
  );
}

if (!movimiento.fuente.evidenciaPermiso.trim()) {
  problemas.push(
    "Falta la evidencia del permiso de uso."
  );
}

if (
  movimiento.formato !== "video-referencia" &&
  !movimiento.archivoUrl
) {
  problemas.push(
    "Falta la ubicación del archivo de movimiento."
  );
}

if (
  movimiento.captura.cantidadFotogramas <= 0
) {
  problemas.push(
    "La captura no tiene fotogramas registrados."
  );
}

if (movimiento.captura.frecuenciaFps <= 0) {
  problemas.push(
    "La frecuencia de captura no es válida."
  );
}

if (
  !movimiento.revision.responsableTecnico.trim()
) {
  problemas.push(
    "Falta el responsable de revisión técnica."
  );
}

if (
  !movimiento.revision.responsableLingüistico.trim()
) {
  problemas.push(
    "Falta el responsable de revisión lingüística."
  );
}

if (!movimiento.revision.fecha.trim()) {
  problemas.push(
    "Falta la fecha de revisión."
  );
}

if (
  movimiento.revision.estado !== "apto-para-pruebas"
) {
  problemas.push(
    "El movimiento todavía no está autorizado para pruebas."
  );
}

return problemas;
}

export function movimientoAptoParaPruebas(
movimiento: RegistroMovimientoLSC
): boolean {
return diagnosticarMovimientoLSC(movimiento).length === 0;
}
