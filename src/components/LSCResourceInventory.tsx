
import { useMemo, useState } from "react";
import {
  bibliotecaLSC,
  type SenaLSC,
} from "../data/lscLibrary";

type FiltroRecursos =
  | "todos"
  | "con-recursos"
  | "sin-recursos"
  | "pendientes";

function tieneRecurso(sena: SenaLSC): boolean {
  return Boolean(sena.video || sena.imagen || sena.animacion);
}

function contarRecursos(sena: SenaLSC): number {
  return [
    sena.video,
    sena.imagen,
    sena.animacion,
  ].filter(Boolean).length;
}

export default function LSCResourceInventory() {
  const [filtro, setFiltro] =
    useState<FiltroRecursos>("todos");

  const resumen = useMemo(() => {
    const total = bibliotecaLSC.length;

    const conRecursos = bibliotecaLSC.filter(
      tieneRecurso
    ).length;

    const validadas = bibliotecaLSC.filter(
      (sena) =>
        sena.estado === "referencia-validada" ||
        sena.estado === "disponible-para-practica"
    ).length;

    return {
      total,
      conRecursos,
      sinRecursos: total - conRecursos,
      pendientes: total - validadas,
      validadas,
    };
  }, []);

  const senasFiltradas = useMemo(() => {
    return bibliotecaLSC.filter((sena) => {
      switch (filtro) {
        case "con-recursos":
          return tieneRecurso(sena);

        case "sin-recursos":
          return !tieneRecurso(sena);

        case "pendientes":
          return (
            sena.estado === "pendiente-validacion"
          );

        default:
          return true;
      }
    });
  }, [filtro]);

  return (
    <section className="lsc-resource-inventory">
      <h3>Inventario de recursos LSC</h3>

      <p>
        Consulta el estado de cada concepto de la
        biblioteca y detecta qué recursos faltan.
      </p>

      <div className="lsc-resource-summary">
        <article>
          <strong>{resumen.total}</strong>
          <span>Conceptos registrados</span>
        </article>

        <article>
          <strong>{resumen.conRecursos}</strong>
          <span>Con recursos visuales</span>
        </article>

        <article>
          <strong>{resumen.sinRecursos}</strong>
          <span>Sin recursos visuales</span>
        </article>

        <article>
          <strong>{resumen.pendientes}</strong>
          <span>Pendientes de validación</span>
        </article>
      </div>

      <label htmlFor="lsc-resource-filter">
        Mostrar conceptos
      </label>

      <select
        id="lsc-resource-filter"
        value={filtro}
        onChange={(evento) =>
          setFiltro(
            evento.target.value as FiltroRecursos
          )
        }
      >
        <option value="todos">Todos los conceptos</option>
        <option value="con-recursos">
          Con recursos visuales
        </option>
        <option value="sin-recursos">
          Sin recursos visuales
        </option>
        <option value="pendientes">
          Pendientes de validación
        </option>
      </select>

      <p className="lsc-resource-result-count">
        Mostrando {senasFiltradas.length} de{" "}
        {resumen.total} conceptos
      </p>

      <div className="lsc-resource-list">
        {senasFiltradas.map((sena) => {
          const cantidad = contarRecursos(sena);
          const tieneVisual = cantidad > 0;

          return (
            <article
              className="lsc-resource-item"
              key={sena.id}
            >
              <div className="lsc-resource-item-header">
                <h4>{sena.concepto}</h4>

                <span
                  className={
                    tieneVisual
                      ? "lsc-resource-badge disponible"
                      : "lsc-resource-badge faltante"
                  }
                >
                  {tieneVisual
                    ? "Tiene recursos"
                    : "Falta recurso"}
                </span>
              </div>

              <p>
                <strong>Categoría:</strong>{" "}
                {sena.categoria}
              </p>

              <p>
                <strong>Estado:</strong>{" "}
                {sena.estado === "pendiente-validacion"
                  ? "Pendiente de validación"
                  : sena.estado === "referencia-validada"
                    ? "Referencia validada"
                    : "Disponible para práctica"}
              </p>

              <ul>
                <li>
                  Video: {sena.video ? "Registrado" : "Falta"}
                </li>
                <li>
                  Imagen: {sena.imagen ? "Registrada" : "Falta"}
                </li>
                <li>
                  Animación:{" "}
                  {sena.animacion ? "Registrada" : "Falta"}
                </li>
              </ul>

              <p className="lsc-resource-description">
                {sena.descripcion}
              </p>

              {sena.fuenteId ? (
                <p>
                  <strong>Fuente:</strong> {sena.fuenteId}
                </p>
              ) : (
                <p className="lsc-resource-warning">
                  Falta registrar una fuente identificable.
                </p>
              )}

<section className="lsc-resource-traceability">
  <h5>Trazabilidad del recurso</h5>

  <p>
    <strong>Nombre de la fuente:</strong>{" "}
    {sena.trazabilidad?.nombreFuente ??
      "Pendiente de registrar"}
  </p>

  <p>
    <strong>URL de referencia:</strong>{" "}
    {sena.trazabilidad?.urlFuente ? (
      <a
        href={sena.trazabilidad.urlFuente}
        target="_blank"
        rel="noopener noreferrer"
      >
        Consultar fuente
      </a>
    ) : (
      "Pendiente de registrar"
    )}
  </p>

  <p>
    <strong>Licencia:</strong>{" "}
    {sena.trazabilidad?.licencia ??
      "Pendiente de verificar"}
  </p>

  <p>
    <strong>Permiso de uso:</strong>{" "}
    {sena.trazabilidad?.permisoUso === "permitido"
      ? "Registrado como permitido"
      : sena.trazabilidad?.permisoUso === "no-permitido"
        ? "No permitido"
        : "Pendiente de verificar"}
  </p>

  <p>
    <strong>Responsable de revisión:</strong>{" "}
    {sena.trazabilidad?.responsableRevision ??
      "Pendiente de asignar"}
  </p>

  <p>
    <strong>Fecha de revisión:</strong>{" "}
    {sena.trazabilidad?.fechaRevision ??
      "Sin registrar"}
  </p>

  <p>
    <strong>Evidencia lingüística:</strong>{" "}
    {sena.trazabilidad?.evidenciaLinguistica ??
      "Pendiente de documentar"}
  </p>

  {sena.trazabilidad?.observaciones && (
    <p>
      <strong>Observaciones:</strong>{" "}
      {sena.trazabilidad.observaciones}
    </p>
  )}
</section>

              {sena.validacionLinguistica !==
                "validada" && (
                <p className="lsc-resource-warning">
                  La referencia lingüística todavía
                  requiere revisión.
                </p>
              )}
            </article>
          );
        })}
      </div>

      {senasFiltradas.length === 0 && (
        <p>
          No hay conceptos que coincidan con este filtro.
        </p>
      )}

      <p className="lsc-resource-note">
        Tener un recurso visual no significa que la seña
        esté validada. La fuente, los permisos de uso y la
        correspondencia con la LSC deben revisarse antes
        de incorporarla como referencia oficial.
      </p>
    </section>
  );
}
