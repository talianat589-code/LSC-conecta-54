
export type EstadoRevisionLSC =
| "pendiente"
| "en-revision"
| "validada-por-revisor";

export type RegistroRevisionLSC = {
estado: EstadoRevisionLSC;
responsable: string;
fecha: string;
region: string;
variante: string;
evidencia: string;
observaciones: string;
};

export type RegistrosLSC = Record<string, RegistroRevisionLSC>;

export const CLAVE_ALMACENAMIENTO_LSC =
"lsc-conecta-revisiones-linguisticas-v1";

export function cargarRegistrosLSC(): RegistrosLSC {
try {
  if (typeof localStorage === "undefined") return {};

  const contenido = localStorage.getItem(
    CLAVE_ALMACENAMIENTO_LSC
  );

  if (!contenido) return {};

  const datos: unknown = JSON.parse(contenido);

  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return {};
  }

  return datos as RegistrosLSC;
} catch {
  return {};
}
}

export function guardarRegistrosLSC(
registros: RegistrosLSC
): boolean {
try {
  if (typeof localStorage === "undefined") return false;

  localStorage.setItem(
    CLAVE_ALMACENAMIENTO_LSC,
    JSON.stringify(registros)
  );

  return true;
} catch {
  return false;
}
}

export type ResumenRevisionLSC = {
total: number;
pendientes: number;
enRevision: number;
validadas: number;
incompletos: number;
sinResponsable: number;
sinEvidencia: number;
};

export function resumirRevisionesLSC(
conceptos: { id: string }[]
): ResumenRevisionLSC {
const registros = cargarRegistrosLSC();

let pendientes = 0;
let enRevision = 0;
let validadas = 0;
let incompletos = 0;
let sinResponsable = 0;
let sinEvidencia = 0;

for (const concepto of conceptos) {
  const registro = registros[concepto.id];

  if (!registro || registro.estado === "pendiente") {
    pendientes++;
    continue;
  }

  if (registro.estado === "en-revision") {
    enRevision++;
  }

  const faltaResponsable = !registro.responsable?.trim();
  const faltaEvidencia = !registro.evidencia?.trim();
  const faltaFecha = !registro.fecha?.trim();

  if (faltaResponsable) sinResponsable++;
  if (faltaEvidencia) sinEvidencia++;

  if (
    faltaResponsable ||
    faltaEvidencia ||
    faltaFecha
  ) {
    incompletos++;
  }

  if (
    registro.estado === "validada-por-revisor" &&
    !faltaResponsable &&
    !faltaEvidencia &&
    !faltaFecha
  ) {
    validadas++;
  }
}

return {
  total: conceptos.length,
  pendientes,
  enRevision,
  validadas,
  incompletos,
  sinResponsable,
  sinEvidencia,
};
}
