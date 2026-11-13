
import {
  bibliotecaLSC,
} from "./lscLibrary";

import {
  fuentesLSC,
} from "./lscSources";

import {
  mediosLSC,
  diagnosticarMediaLSC,
} from "./lscMedia";

import {
  cargarRegistrosLSC,
  resumirRevisionesLSC,
} from "./lscLinguisticRecords";

export type NivelHallazgoLSC =
  | "error"
  | "advertencia";

export type HallazgoAuditoriaLSC = {
  nivel: NivelHallazgoLSC;
  codigo: string;
  mensaje: string;
  elementoId?: string;
};

export type ResultadoAuditoriaLSC = {
  fecha: string;
  conceptosRevisados: number;
  fuentesRevisadas: number;
  recursosRevisados: number;
  errores: number;
  advertencias: number;
  hallazgos: HallazgoAuditoriaLSC[];

  conceptosPendientesLing: number;
  conceptosEnRevisionLing: number;
  conceptosValidadosLing: number;
  expedientesIncompletos: number;
  expedientesSinResponsable: number;
  expedientesSinEvidencia: number;
};

function detectarDuplicados(
  identificadores: string[],
  tipo: string
): HallazgoAuditoriaLSC[] {
  const vistos = new Set<string>();
  const duplicados = new Set<string>();

  for (const identificador of identificadores) {
    if (vistos.has(identificador)) {
      duplicados.add(identificador);
    }

    vistos.add(identificador);
  }

  return Array.from(duplicados).map(
    (identificador) => ({
      nivel: "error",
      codigo: "ID_DUPLICADO",
      mensaje:
        `Identificador duplicado en ${tipo}: ${identificador}.`,
      elementoId: identificador,
    })
  );
}

/**
 * Ejecuta una revisión estructural de la biblioteca,
 * fuentes y recursos multimedia.
 *
 * No certifica licencias ni sustituye una revisión
 * jurídica o lingüística realizada por personas.
 */
export function auditarBibliotecaLSC(): ResultadoAuditoriaLSC {
  const hallazgos: HallazgoAuditoriaLSC[] = [];

const registrosLing = cargarRegistrosLSC();

const resumenLing = resumirRevisionesLSC(
  bibliotecaLSC
);

for (const sena of bibliotecaLSC) {
  const registro = registrosLing[sena.id];

  if (
    registro?.estado === "validada-por-revisor" &&
    (
      !registro.responsable?.trim() ||
      !registro.evidencia?.trim() ||
      !registro.fecha?.trim()
    )
  ) {
    hallazgos.push({
      nivel: "advertencia",
      codigo: "VALIDACION_LINGUISTICA_INCOMPLETA",
      mensaje:
        `El concepto ${sena.concepto} figura como validado, pero su expediente no contiene todos los datos obligatorios.`,
      elementoId: sena.id,
    });
  }

  if (!registro || registro.estado === "pendiente") {
    hallazgos.push({
      nivel: "advertencia",
      codigo: "REVISION_LINGUISTICA_PENDIENTE",
      mensaje:
        `El concepto ${sena.concepto} todavía está pendiente de revisión lingüística.`,
      elementoId: sena.id,
    });

    continue;
  }

  if (registro.estado === "en-revision") {
    hallazgos.push({
      nivel: "advertencia",
      codigo: "REVISION_LINGUISTICA_EN_CURSO",
      mensaje:
        `El concepto ${sena.concepto} está en proceso de revisión lingüística.`,
      elementoId: sena.id,
    });
  }

  if (!registro.responsable?.trim()) {
    hallazgos.push({
      nivel: "advertencia",
      codigo: "EXPEDIENTE_SIN_RESPONSABLE",
      mensaje:
        `El expediente de ${sena.concepto} no tiene responsable registrado.`,
      elementoId: sena.id,
    });
  }

  if (!registro.evidencia?.trim()) {
    hallazgos.push({
      nivel: "advertencia",
      codigo: "EXPEDIENTE_SIN_EVIDENCIA",
      mensaje:
        `El expediente de ${sena.concepto} no tiene evidencia lingüística registrada.`,
      elementoId: sena.id,
    });
  }

  if (!registro.fecha?.trim()) {
    hallazgos.push({
      nivel: "advertencia",
      codigo: "EXPEDIENTE_SIN_FECHA",
      mensaje:
        `El expediente de ${sena.concepto} no tiene fecha de revisión.`,
      elementoId: sena.id,
    });
  }
}

  const idsSenas = new Set(
    bibliotecaLSC.map((sena) => sena.id)
  );

  const idsFuentes = new Set(
    fuentesLSC.map((fuente) => fuente.id)
  );

  // 1. Detectar identificadores duplicados.
  hallazgos.push(
    ...detectarDuplicados(
      bibliotecaLSC.map((sena) => sena.id),
      "la biblioteca de señas"
    )
  );

  hallazgos.push(
    ...detectarDuplicados(
      fuentesLSC.map((fuente) => fuente.id),
      "el registro de fuentes"
    )
  );

  hallazgos.push(
    ...detectarDuplicados(
      mediosLSC.map((media) => media.id),
      "los recursos multimedia"
    )
  );

  // 2. Revisar fuentes registradas.
  for (const fuente of fuentesLSC) {
    if (!fuente.nombre.trim()) {
      hallazgos.push({
        nivel: "error",
        codigo: "FUENTE_SIN_NOMBRE",
        mensaje: "Una fuente no tiene nombre registrado.",
        elementoId: fuente.id,
      });
    }

    if (!fuente.url.trim()) {
      hallazgos.push({
        nivel: "error",
        codigo: "FUENTE_SIN_URL",
        mensaje: "La fuente no tiene una URL registrada.",
        elementoId: fuente.id,
      });
    }

    if (
      !fuente.licencia.trim() ||
      fuente.licencia === "por-verificar"
    ) {
      hallazgos.push({
        nivel: "advertencia",
        codigo: "LICENCIA_PENDIENTE",
        mensaje:
          "La licencia de esta fuente todavía debe verificarse.",
        elementoId: fuente.id,
      });
    }

    if (fuente.estado !== "aprobada") {
      hallazgos.push({
        nivel: "advertencia",
        codigo: "FUENTE_NO_APROBADA",
        mensaje:
          "La fuente todavía no está aprobada para utilizarse.",
        elementoId: fuente.id,
      });
    }

    const permisos = [
      fuente.usoComercial,
      fuente.modificacion,
      fuente.redistribucion,
      fuente.entrenamientoIA,
    ];

    if (permisos.some(
      (permiso) => permiso === "por-verificar"
    )) {
      hallazgos.push({
        nivel: "advertencia",
        codigo: "PERMISOS_PENDIENTES",
        mensaje:
          "Uno o más permisos de uso de esta fuente siguen sin verificarse.",
        elementoId: fuente.id,
      });
    }
  }

  // 3. Revisar referencias de la biblioteca.
  for (const sena of bibliotecaLSC) {
    if (sena.fuenteId && !idsFuentes.has(sena.fuenteId)) {
      hallazgos.push({
        nivel: "error",
        codigo: "FUENTE_DE_SENA_INEXISTENTE",
        mensaje:
          `La seña ${sena.concepto} apunta a una fuente que no existe.`,
        elementoId: sena.id,
      });
    }
  }

  // 4. Revisar recursos multimedia.
  for (const media of mediosLSC) {
    if (!idsSenas.has(media.senaId)) {
      hallazgos.push({
        nivel: "error",
        codigo: "SENA_INEXISTENTE",
        mensaje:
          "El recurso está asociado a una seña que no existe.",
        elementoId: media.id,
      });
    }

    if (media.fuenteId && !idsFuentes.has(media.fuenteId)) {
      hallazgos.push({
        nivel: "error",
        codigo: "FUENTE_DE_MEDIA_INEXISTENTE",
        mensaje:
          "El recurso apunta a una fuente que no existe.",
        elementoId: media.id,
      });
    }

    const diagnostico =
      diagnosticarMediaLSC(media);

    for (
      const pendiente of diagnostico.comprobacionesPendientes
    ) {
      hallazgos.push({
        nivel: "advertencia",
        codigo: "RECURSO_PENDIENTE",
        mensaje: pendiente,
        elementoId: media.id,
      });
    }
  }

  const errores = hallazgos.filter(
    (hallazgo) => hallazgo.nivel === "error"
  ).length;

  const advertencias = hallazgos.filter(
    (hallazgo) => hallazgo.nivel === "advertencia"
  ).length;

  return {
    fecha: new Date().toISOString(),
    conceptosRevisados: bibliotecaLSC.length,
    fuentesRevisadas: fuentesLSC.length,
    recursosRevisados: mediosLSC.length,
    errores,
    advertencias,
    conceptosPendientesLing: resumenLing.pendientes,
    conceptosEnRevisionLing: resumenLing.enRevision,
    conceptosValidadosLing: resumenLing.validadas,
    expedientesIncompletos: resumenLing.incompletos,
    expedientesSinResponsable: resumenLing.sinResponsable,
    expedientesSinEvidencia: resumenLing.sinEvidencia,
    hallazgos,
  };
}
