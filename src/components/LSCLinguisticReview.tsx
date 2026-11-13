
import { useEffect, useState, type FormEvent } from "react";
import { bibliotecaLSC } from "../data/lscLibrary";

import {
  cargarRegistrosLSC,
  guardarRegistrosLSC,
  type RegistroRevisionLSC,
  type RegistrosLSC,
  type EstadoRevisionLSC,
} from "../data/lscLinguisticRecords";

type Props = {
  onRegistroActualizado?: () => void;
};

type RegistroRevision = RegistroRevisionLSC;

const registroVacio: RegistroRevision = {
  estado: "pendiente",
  responsable: "",
  fecha: "",
  region: "",
  variante: "",
  evidencia: "",
  observaciones: "",
};

export default function LSCLinguisticReview({
  onRegistroActualizado,
}: Props) {
  const [conceptoId, setConceptoId] = useState(
    bibliotecaLSC[0]?.id ?? ""
  );

  const [registros, setRegistros] =
    useState<RegistrosLSC>(() => cargarRegistrosLSC());

  const [formulario, setFormulario] =
    useState<RegistroRevision>({ ...registroVacio });

  const [mensaje, setMensaje] = useState("");

  const resumenRevision = bibliotecaLSC.reduce(
    (resumen, sena) => {
      const registro = registros[sena.id];

      resumen.total++;

      if (!registro || registro.estado === "pendiente") {
        resumen.pendientes++;
      } else if (registro.estado === "en-revision") {
        resumen.enRevision++;
      } else if (
        registro.estado === "validada-por-revisor"
      ) {
        resumen.validadas++;
      }

      return resumen;
    },
    {
      total: 0,
      pendientes: 0,
      enRevision: 0,
      validadas: 0,
    }
  );

  useEffect(() => {
    setFormulario({
      ...registroVacio,
      ...(registros[conceptoId] ?? {}),
    });

    setMensaje("");
  }, [conceptoId, registros]);

  const concepto = bibliotecaLSC.find(
    (sena) => sena.id === conceptoId
  );

  function actualizarCampo(
    campo: keyof RegistroRevision,
    valor: string
  ) {
    setFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function guardarRegistro(
    evento: FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    if (!conceptoId) {
      setMensaje("No hay conceptos disponibles.");
      return;
    }

    if (
      formulario.estado === "validada-por-revisor" &&
      (
        !formulario.responsable.trim() ||
        !formulario.evidencia.trim() ||
        !formulario.fecha
      )
    ) {
      setMensaje(
        "Para registrar una validación debes indicar responsable, fecha y evidencia."
      );
      return;
    }

    const nuevosRegistros: RegistrosLSC = {
      ...registros,
      [conceptoId]: { ...formulario },
    };

    const guardado = guardarRegistrosLSC(nuevosRegistros);

    if (!guardado) {
      setMensaje(
        "No se pudo guardar el registro en este dispositivo."
      );
      return;
    }

    setRegistros(nuevosRegistros);
    setMensaje("Registro guardado correctamente.");

    onRegistroActualizado?.();
  }

  return (
    <section className="lsc-linguistic-review">
      <h2>Validación lingüística de señas</h2>

      <p>
        Registra la revisión individual de cada concepto,
        su variante regional y la evidencia consultada.
      </p>

      <div className="lsc-linguistic-summary">
        <h3>Estado general de validación lingüística</h3>

        <div className="lsc-linguistic-summary-grid">
          <div className="panel">
            <strong>{resumenRevision.total}</strong>
            <p>Conceptos registrados</p>
          </div>

          <div className="panel">
            <strong>{resumenRevision.pendientes}</strong>
            <p>Pendientes</p>
          </div>

          <div className="panel">
            <strong>{resumenRevision.enRevision}</strong>
            <p>En revisión</p>
          </div>

          <div className="panel">
            <strong>{resumenRevision.validadas}</strong>
            <p>Con validación documentada</p>
          </div>
        </div>

        <p>
          Este resumen refleja los expedientes registrados en este
          dispositivo. No modifica automáticamente el estado
          lingüístico de la biblioteca.
        </p>
      </div>

      <label htmlFor="concepto-revision-lsc">
        Seleccionar concepto
      </label>

      <select
        id="concepto-revision-lsc"
        value={conceptoId}
        onChange={(evento) => setConceptoId(evento.target.value)}
      >
        {bibliotecaLSC.map((sena) => (
          <option key={sena.id} value={sena.id}>
            {sena.concepto}
          </option>
        ))}
      </select>

      {concepto && (
        <form onSubmit={guardarRegistro}>
          <h3>{concepto.concepto}</h3>

          <label htmlFor="estado-revision-lsc">
            Estado de revisión
          </label>

          <select
            id="estado-revision-lsc"
            value={formulario.estado}
            onChange={(evento) =>
              actualizarCampo(
                "estado",
                evento.target.value as EstadoRevisionLSC
              )
            }
          >
            <option value="pendiente">Pendiente</option>
            <option value="en-revision">En revisión</option>
            <option value="validada-por-revisor">
              Validada por revisor
            </option>
          </select>

          <label htmlFor="responsable-revision-lsc">
            Responsable de la revisión
          </label>

          <input
            id="responsable-revision-lsc"
            value={formulario.responsable}
            onChange={(evento) =>
              actualizarCampo("responsable", evento.target.value)
            }
            placeholder="Nombre del especialista o revisor"
          />

          <label htmlFor="fecha-revision-lsc">
            Fecha de revisión
          </label>

          <input
            id="fecha-revision-lsc"
            type="date"
            value={formulario.fecha}
            onChange={(evento) =>
              actualizarCampo("fecha", evento.target.value)
            }
          />

          <label htmlFor="region-revision-lsc">
            Región o comunidad lingüística
          </label>

          <input
            id="region-revision-lsc"
            value={formulario.region}
            onChange={(evento) =>
              actualizarCampo("region", evento.target.value)
            }
            placeholder="Ejemplo: región o comunidad consultada"
          />

          <label htmlFor="variante-revision-lsc">
            Variante de la seña
          </label>

          <input
            id="variante-revision-lsc"
            value={formulario.variante}
            onChange={(evento) =>
              actualizarCampo("variante", evento.target.value)
            }
            placeholder="Descripción de la variante observada"
          />

          <label htmlFor="evidencia-revision-lsc">
            Evidencia o referencia consultada
          </label>

          <input
            id="evidencia-revision-lsc"
            type="url"
            value={formulario.evidencia}
            onChange={(evento) =>
              actualizarCampo("evidencia", evento.target.value)
            }
            placeholder="https://..."
          />

          <label htmlFor="observaciones-revision-lsc">
            Observaciones lingüísticas
          </label>

          <textarea
            id="observaciones-revision-lsc"
            rows={4}
            value={formulario.observaciones}
            onChange={(evento) =>
              actualizarCampo("observaciones", evento.target.value)
            }
            placeholder="Describe la configuración, movimiento, contexto y observaciones de la revisión."
          />

          <button type="submit">
            Guardar revisión
          </button>

          {mensaje && (
            <p role="status">{mensaje}</p>
          )}
        </form>
      )}

      <p>
        Los registros se guardan en el almacenamiento local
        de este navegador. La validación registrada no cambia
        automáticamente el estado general de la biblioteca.
      </p>
    </section>
  );
}
