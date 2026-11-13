
import { bibliotecaLSC } from "./lscLibrary";
import {
  buscarEtiquetaLSC50PorConcepto,
  type EtiquetaLSC50,
} from "./lsc50Labels";

export type CorrespondenciaLSC50 = {
  idCatalogo: string;
  conceptoCatalogo: string;
  etiquetaLSC50: EtiquetaLSC50 | null;
  estado:
    | "coincidencia-pendiente-validacion"
    | "sin-coincidencia";
};

export function compararCatalogoConLSC50(): CorrespondenciaLSC50[] {
  return bibliotecaLSC.map((sena) => {
    const etiqueta = buscarEtiquetaLSC50PorConcepto(
      sena.concepto
    );

    return {
      idCatalogo: sena.id,
      conceptoCatalogo: sena.concepto,
      etiquetaLSC50: etiqueta ?? null,
      estado: etiqueta
        ? "coincidencia-pendiente-validacion"
        : "sin-coincidencia",
    };
  });
}

export function obtenerResumenLSC50() {
  const correspondencias = compararCatalogoConLSC50();

  const coincidencias = correspondencias.filter(
    (item) =>
      item.estado ===
      "coincidencia-pendiente-validacion"
  );

  const sinCoincidencia = correspondencias.filter(
    (item) => item.estado === "sin-coincidencia"
  );

  return {
    totalConceptos: correspondencias.length,
    totalCoincidencias: coincidencias.length,
    totalSinCoincidencia: sinCoincidencia.length,
    conceptosCoincidentes: coincidencias.map(
      (item) => ({
        id: item.idCatalogo,
        concepto: item.conceptoCatalogo,
        codigoLSC50: item.etiquetaLSC50?.codigo ?? null,
      })
    ),
    conceptosPendientes: sinCoincidencia.map(
      (item) => ({
        id: item.idCatalogo,
        concepto: item.conceptoCatalogo,
      })
    ),
  };
}
