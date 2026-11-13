
import { useMemo, useState } from "react";
import LSCLinguisticReview from "./LSCLinguisticReview";
import {
  auditarBibliotecaLSC,
} from "../data/lscAudit";

import { cargarRegistrosLSC } from "../data/lscLinguisticRecords";

import {
  planificarBibliotecaLSC,
  resumirPlanBibliotecaLSC,
  type PlanRecursoLSC,
} from "../data/lscResourcePlanner";

type FiltroRecursos =
  | "todos"
  | "sin-recursos"
  | "pendiente-validacion"
  | "listo-para-revision";

const nombresEstado: Record<PlanRecursoLSC["estado"], string> = {
  "sin-recursos": "Sin recursos",
  "pendiente-validacion": "Pendiente de validación",
  "listo-para-revision": "Listo para revisión",
};

function obtenerEstadoLinguistico(senaId: string): string {
  const registro = cargarRegistrosLSC()[senaId];

  if (!registro || registro.estado === "pendiente") {
    return "Pendiente de revisión lingüística";
  }

  if (registro.estado === "en-revision") {
    return "En revisión lingüística";
  }

  if (
    !registro.responsable?.trim() ||
    !registro.evidencia?.trim() ||
    !registro.fecha?.trim()
  ) {
    return "Registro marcado como validado, pero incompleto";
  }

  return "Validación documentada";
}

export default function LSCResourceReview() {
  const [filtro, setFiltro] = useState<FiltroRecursos>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [revisionActualizada, setRevisionActualizada] =
  useState(0);

  const planes = useMemo(
    () => planificarBibliotecaLSC(),
    []
  );

  const resumen = useMemo(
    () => resumirPlanBibliotecaLSC(),
    []
  );
  const auditoria = useMemo(
    () => auditarBibliotecaLSC(),
    [revisionActualizada]
  );

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es-CO");

    return planes.filter((plan) => {
      const coincideEstado =
        filtro === "todos" || plan.estado === filtro;

      const coincideTexto =
        !texto ||
        plan.concepto.toLocaleLowerCase("es-CO").includes(texto) ||
        plan.senaId.toLocaleLowerCase("es-CO").includes(texto);

      return coincideEstado && coincideTexto;
    });
  }, [planes, filtro, busqueda]);

  return (
    <main className="lsc-resource-review">
      <h2>Revisión de recursos LSC</h2>

      <p>
        Panel de control para revisar recursos, fuentes y
        validaciones pendientes de la biblioteca.
      </p>

      <section className="lsc-audit-panel">
  <h3>Auditoría técnica de la biblioteca</h3>

  <p>
    Revisión automática de identificadores,
    fuentes y recursos multimedia.
  </p>
  <LSCLinguisticReview
  onRegistroActualizado={() =>
    setRevisionActualizada((valor) => valor + 1)
  }
/>
  <div className="lsc-resource-summary">
    <article>
      <strong>{auditoria.conceptosRevisados}</strong>
      <span>Conceptos revisados</span>
    </article>

    <article>
      <strong>{auditoria.fuentesRevisadas}</strong>
      <span>Fuentes registradas</span>
    </article>

    <article>
      <strong>{auditoria.recursosRevisados}</strong>
      <span>Recursos multimedia</span>
    </article>
    
    <article>
  <strong>{auditoria.conceptosPendientesLing}</strong>
  <span>Pendientes de revisión lingüística</span>
</article>

<article>
  <strong>{auditoria.conceptosEnRevisionLing}</strong>
  <span>En revisión lingüística</span>
</article>

<article>
  <strong>{auditoria.conceptosValidadosLing}</strong>
  <span>Validaciones documentadas</span>
</article>

<article>
  <strong>{auditoria.expedientesIncompletos}</strong>
  <span>Expedientes incompletos</span>
</article>

<article>
  <strong>{auditoria.expedientesSinResponsable}</strong>
  <span>Sin responsable</span>
</article>

<article>
  <strong>{auditoria.expedientesSinEvidencia}</strong>
  <span>Sin evidencia</span>
</article>

    <article>
      <strong>{auditoria.errores}</strong>
      <span>Errores estructurales</span>
    </article>
  </div>

  <p>
    <strong>Advertencias:</strong>{" "}
    {auditoria.advertencias}
  </p>

  <details>
    <summary>
      Ver hallazgos de la auditoría
    </summary>

    {auditoria.hallazgos.length === 0 ? (
      <p>
        No se detectaron hallazgos estructurales.
      </p>
    ) : (
      <ul>
        {auditoria.hallazgos.map(
          (hallazgo, indice) => (
            <li key={`${hallazgo.codigo}-${hallazgo.elementoId ?? indice}-${indice}`}>
              <strong>
                {hallazgo.nivel === "error"
                  ? "Error: "
                  : "Advertencia: "}
              </strong>

              {hallazgo.mensaje}

              {hallazgo.elementoId && (
                <small>
                  {" "}ID: {hallazgo.elementoId}
                </small>
              )}
            </li>
          )
        )}
      </ul>
    )}
  </details>

  <small>
    Informe generado:{" "}
    {new Date(auditoria.fecha).toLocaleString("es-CO")}
  </small>
</section>

      <div className="lsc-resource-summary">
        <article>
          <strong>{resumen.totalSenas}</strong>
          <span>Conceptos registrados</span>
        </article>

        <article>
          <strong>{resumen.sinRecursos}</strong>
          <span>Sin recursos</span>
        </article>

        <article>
          <strong>{resumen.pendientes}</strong>
          <span>Pendientes de validación</span>
        </article>

        <article>
          <strong>{resumen.listosParaRevision}</strong>
          <span>Listos para revisión</span>
        </article>
      </div>

      <label htmlFor="buscar-recurso-lsc">
        Buscar concepto
      </label>

      <input
        id="buscar-recurso-lsc"
        type="search"
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        placeholder="Ejemplo: hola, gracias..."
      />

      <label htmlFor="filtro-recurso-lsc">
        Filtrar por estado
      </label>

      <select
        id="filtro-recurso-lsc"
        value={filtro}
        onChange={(evento) =>
          setFiltro(evento.target.value as FiltroRecursos)
        }
      >
        <option value="todos">Todos los conceptos</option>
        <option value="sin-recursos">Sin recursos</option>
        <option value="pendiente-validacion">
          Pendientes de validación
        </option>
        <option value="listo-para-revision">
          Listos para revisión
        </option>
      </select>

      <p>Resultados: {resultados.length}</p>

      {resultados.length === 0 ? (
        <p>No hay conceptos que coincidan con la búsqueda.</p>
      ) : (
        <ul className="lsc-resource-list">
          {resultados.map((plan) => (
            <li key={plan.senaId}>
              <h3>{plan.concepto}</h3>

              <p>
                <strong>ID:</strong> {plan.senaId}
              </p>
              <section className="lsc-source-traceability">
                <h4>Trazabilidad de la fuente</h4>

                {plan.fuenteNombre ? (
                  <>
                    <p>
                      <strong>Fuente:</strong>{" "}
                      {plan.fuenteNombre}
                    </p>

                    <p>
                      <strong>Institución:</strong>{" "}
                      {plan.fuenteInstitucion}
                    </p>
                    {plan.fuenteDescripcion && (
                      <p>
                        <strong>Descripción:</strong>{" "}
                        {plan.fuenteDescripcion}
                      </p>
                    )}

                    {plan.fuenteUrl && (
                      <p>
                        <strong>Enlace de consulta:</strong>{" "}
                        <a
                          href={plan.fuenteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir fuente original
                        </a>
                      </p>
                    )}

                    <p>
                      <strong>Permiso de modificación:</strong>{" "}
                      {plan.fuenteModificacion ?? "Por verificar"}
                    </p>

                    <p>
                      <strong>Requiere atribución:</strong>{" "}
                      {plan.fuenteRequiereAtribucion === true
                        ? "Sí"
                        : plan.fuenteRequiereAtribucion === false
                          ? "No"
                          : "Por verificar"}
                    </p>

                    {plan.fuenteObservaciones && (
                      <p>
                        <strong>Observaciones de la fuente:</strong>{" "}
                        {plan.fuenteObservaciones}
                      </p>
                    )}

                    {plan.trazabilidad && (
                      <div className="lsc-concept-traceability">
                        <h4>Registro individual del concepto</h4>

                        <p>
                          <strong>Licencia declarada:</strong>{" "}
                          {plan.trazabilidad.licencia ?? "Por verificar"}
                        </p>

                        <p>
                          <strong>Permiso de uso:</strong>{" "}
                          {plan.trazabilidad.permisoUso ?? "Por verificar"}
                        </p>

                        <p>
                          <strong>Tipo de material:</strong>{" "}
                          {plan.trazabilidad.tipoMaterial ?? "Sin especificar"}
                        </p>

                        <p>
                          <strong>Responsable de revisión:</strong>{" "}
                          {plan.trazabilidad.responsableRevision ?? "Pendiente"}
                        </p>

                        <p>
                          <strong>Fecha de revisión:</strong>{" "}
                          {plan.trazabilidad.fechaRevision ?? "Pendiente"}
                        </p>

                        <p>
                          <strong>Evidencia lingüística:</strong>{" "}
                          {plan.trazabilidad.evidenciaLinguistica ?? "Pendiente"}
                        </p>

                        {plan.trazabilidad.observaciones && (
                          <p>
                            <strong>Observaciones del concepto:</strong>{" "}
                            {plan.trazabilidad.observaciones}
                          </p>
                        )}
                      </div>
                    )}
                    <p>
                      <strong>Identificador:</strong>{" "}
                      {plan.fuenteId}
                    </p>

                    <p>
                      <strong>Licencia:</strong>{" "}
                      {plan.fuenteLicencia}
                    </p>

                    <p>
                      <strong>Estado de revisión:</strong>{" "}
                      {plan.fuenteEstado}
                    </p>

                    <p>
                      <strong>Uso comercial:</strong>{" "}
                      {plan.permisoUsoComercial}
                    </p>

                    <p>
                      <strong>Redistribución:</strong>{" "}
                      {plan.permisoRedistribucion}
                    </p>

                    <p>
                      <strong>Entrenamiento de IA:</strong>{" "}
                      {plan.permisoEntrenamientoIA}
                    </p>
                  </>
                ) : (
                  <p>
                    Esta seña todavía no tiene una fuente
                    asociada en el registro.
                  </p>
                )}
              </section>

              <p>
                <strong>Estado:</strong>{" "}
                {nombresEstado[plan.estado]}
              </p>

              <p>
  <strong>Estado lingüístico:</strong>{" "}
  {obtenerEstadoLinguistico(plan.senaId)}
</p>

              <p>
                Recursos registrados: {plan.recursosEncontrados}
              </p>

              <p>
                Recursos aptos según las comprobaciones:{" "}
                {plan.recursosAptos}
              </p>

              <p>
                Recursos pendientes: {plan.recursosPendientes}
              </p>

              {plan.detalles.length > 0 && (
                <details>
                  <summary>Ver pendientes y observaciones</summary>
                  <ul>
                    {plan.detalles.map((detalle, indice) => (
                      <li key={`${plan.senaId}-${indice}`}>
                        {detalle}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
