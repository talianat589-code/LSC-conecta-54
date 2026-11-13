
import {
  bibliotecaLSC,
  type SenaLSC,
} from "./lscLibrary";

import {
  obtenerFuenteLSC,
} from "./lscSources";

import {
  mediosLSC,
  diagnosticarMediaLSC,
  type MediaLSC,
} from "./lscMedia";

export type PlanRecursoLSC = {
  senaId: string;
  concepto: string;
  recursosEncontrados: number;
  recursosAptos: number;
  recursosPendientes: number;
  estado:
    | "sin-recursos"
    | "pendiente-validacion"
    | "listo-para-revision";
  detalles: string[];
  fuenteId?: string;
  fuenteNombre?: string;
  fuenteInstitucion?: string;
  fuenteDescripcion?: string;
  fuenteUrl?: string;
  fuenteLicencia?: string;
  fuenteModificacion?: string;
  fuenteRequiereAtribucion?: boolean;
  fuenteObservaciones?: string;
  trazabilidad?: SenaLSC["trazabilidad"];
  fuenteEstado?: string;
  permisoUsoComercial?: string;
  permisoRedistribucion?: string;
  permisoEntrenamientoIA?: string;
};

function obtenerMediosDeSena(sena: SenaLSC): MediaLSC[] {
  return mediosLSC.filter(
    (media) => media.senaId === sena.id
  );
}

export function planificarRecursosLSC(
  sena: SenaLSC
): PlanRecursoLSC {
  const fuente = sena.fuenteId
  ? obtenerFuenteLSC(sena.fuenteId)
  : undefined;
  const medios = obtenerMediosDeSena(sena);

  const diagnosticos = medios.map((media) =>
    diagnosticarMediaLSC(media)
  );

  const recursosAptos = diagnosticos.filter(
    (diagnostico) => diagnostico.aptoComoReferencia
  ).length;

  const detalles = diagnosticos.flatMap(
    (diagnostico) => diagnostico.comprobacionesPendientes
  );

  if (medios.length === 0) {
    detalles.push(
      "No hay recursos visuales registrados para este concepto."
    );
  }

  return {
    senaId: sena.id,
    concepto: sena.concepto,
    fuenteId: sena.fuenteId,
    fuenteNombre: fuente?.nombre,
    fuenteInstitucion: fuente?.institucion,
    fuenteDescripcion: fuente?.descripcion,
    fuenteUrl: fuente?.url,
    fuenteLicencia: fuente?.licencia,
    fuenteModificacion: fuente?.modificacion,
    fuenteRequiereAtribucion: fuente?.requiereAtribucion,
    fuenteObservaciones: fuente?.observaciones,
    trazabilidad: sena.trazabilidad,
    fuenteEstado: fuente?.estado,
    permisoUsoComercial: fuente?.usoComercial,
    permisoRedistribucion: fuente?.redistribucion,
    permisoEntrenamientoIA: fuente?.entrenamientoIA,
    recursosEncontrados: medios.length,
    recursosAptos,
    recursosPendientes: medios.length - recursosAptos,
    estado:
      medios.length === 0
        ? "sin-recursos"
        : recursosAptos > 0
          ? "listo-para-revision"
          : "pendiente-validacion",
    detalles: [...new Set(detalles)],
  };
}

export function planificarBibliotecaLSC(): PlanRecursoLSC[] {
  return bibliotecaLSC.map((sena) =>
    planificarRecursosLSC(sena)
  );
}

export function resumirPlanBibliotecaLSC() {
  const planes = planificarBibliotecaLSC();

  return {
    totalSenas: planes.length,
    sinRecursos: planes.filter(
      (plan) => plan.estado === "sin-recursos"
    ).length,
    pendientes: planes.filter(
      (plan) => plan.estado === "pendiente-validacion"
    ).length,
    listosParaRevision: planes.filter(
      (plan) => plan.estado === "listo-para-revision"
    ).length,
  };
}
