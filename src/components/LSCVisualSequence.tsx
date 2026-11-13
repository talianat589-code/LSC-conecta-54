
import { useEffect, useState, useId } from "react";
import type { SegmentoFraseLSC } from "../data/lscPhrasePlanner";
import { cargarRegistrosLSC } from "../data/lscLinguisticRecords";
type Props = {
  segmentos: SegmentoFraseLSC[];
  indiceSincronizado?: number;
  onIndiceChange?: (indice: number) => void;
};
function obtenerEstadoRevisionLSC(senaId: string): {
  titulo: string;
  detalle: string;
} {
  const registro = cargarRegistrosLSC()[senaId];

  if (!registro || registro.estado === "pendiente") {
    return {
      titulo: "Pendiente de revisión lingüística",
      detalle:
        "El concepto aparece en el catálogo, pero no tiene una revisión lingüística registrada. No debe presentarse como una traducción confirmada.",
    };
  }

  if (registro.estado === "en-revision") {
    return {
      titulo: "En revisión lingüística",
      detalle:
        "La revisión está en curso. El concepto todavía no debe presentarse como una traducción confirmada.",
    };
  }

  if (
    !registro.responsable?.trim() ||
    !registro.evidencia?.trim() ||
    !registro.fecha?.trim()
  ) {
    return {
      titulo: "Registro de revisión incompleto",
      detalle:
        "El registro está marcado como validado, pero falta responsable, evidencia o fecha. Es necesario completar el expediente.",
    };
  }

  return {
    titulo: "Revisión documentada",
    detalle:
      "El registro contiene responsable, evidencia y fecha. Esto documenta la revisión, pero no constituye por sí solo una garantía independiente de que la seña sea correcta o adecuada para todos los contextos.",
  };
}

export default function LSCVisualSequence({
  segmentos,
  indiceSincronizado,
  onIndiceChange,
}: Props) {
  const idSecuencia = useId();
  const [indice, setIndice] = useState(0);
  const [auto, setAuto] = useState(false);
  const [segundos, setSegundos] = useState(5);

  useEffect(() => {
    setIndice(0);
    setAuto(false);
  }, [segmentos]);

  const indiceActual =
  indiceSincronizado ?? indice;

const posicion =
  segmentos.length > 0
    ? Math.max(
        0,
        Math.min(indiceActual, segmentos.length - 1)
      )
    : 0;

const cambiarIndice = (nuevoIndice: number) => {
  const seguro = Math.max(
    0,
    Math.min(nuevoIndice, segmentos.length - 1)
  );

  if (indiceSincronizado === undefined) {
    setIndice(seguro);
  }

  onIndiceChange?.(seguro);
};

  const actual = segmentos[posicion];
  const sena = actual?.sena;

  const video = sena?.video;
  const imagen = sena?.imagen;
  const animacion = sena?.animacion;

  const avanzar = () => {
    cambiarIndice(posicion + 1);
  };
  
  const retroceder = () => {
    cambiarIndice(posicion - 1);
  };

  useEffect(() => {
    if (!auto || !actual || video) return;

    const temporizador = window.setTimeout(() => {
      if (posicion >= segmentos.length - 1) {
        setAuto(false);
        return;
      }
    
      cambiarIndice(posicion + 1);
    }, segundos * 1000);

    return () => window.clearTimeout(temporizador);
  },[auto, posicion, segmentos.length, video, segundos, actual] );

  const alTerminarVideo = () => {
    if (!auto) return;

    if (posicion < segmentos.length - 1) {
      avanzar();
    } else {
      setAuto(false);
    }
  };

  if (segmentos.length === 0) {
    return (
      <section className="lsc-sequence">
        <h3>Secuencia visual de señas</h3>
        <p>
          Habla para organizar la frase y consultar los
          conceptos disponibles en la biblioteca LSC.
        </p>
      </section>
    );
  }

  return (
    <section className="lsc-sequence">
      <div className="lsc-sequence-header">
        <div>
          <h3>Secuencia visual de la frase</h3>
          <p>
            Los elementos se muestran en el orden de la frase
            reconocida.
          </p>
        </div>

        <span className="lsc-sequence-count">
          {posicion + 1} de {segmentos.length}
        </span>
      </div>

      <div className="lsc-sequence-progress">
        <div
          className="lsc-sequence-progress-fill"
          style={{
            width: `${((posicion + 1) / segmentos.length) * 100}%`,
          }}
        />
      </div>

      <div className="lsc-sequence-card">
        <span className="lsc-sequence-label">
          ELEMENTO {posicion + 1}
        </span>

        <h4>{sena?.concepto ?? actual.texto}</h4>

        {sena ? (
          <>
            {video ? (
              <video
                key={String(video)}
                className="lsc-sequence-media"
                src={video}
                controls
                playsInline
                preload="metadata"
                onEnded={alTerminarVideo}
              >
                Tu navegador no puede reproducir este video.
              </video>
            ) : animacion ? (
              <img
                className="lsc-sequence-media"
                src={animacion}
                alt={`Animación de ${sena.concepto}`}
              />
            ) : imagen ? (
              <img
                className="lsc-sequence-media"
                src={imagen}
                alt={`Imagen de la seña: ${sena.concepto}`}
              />
            ) : (
              <div className="lsc-sequence-empty">
                <span aria-hidden="true">🤟</span>
                <p>
                  El concepto existe en la biblioteca, pero
                  todavía no tiene un recurso visual.
                </p>
              </div>
            )}

{(() => {
  const revision = obtenerEstadoRevisionLSC(sena.id);

  return (
    <div className="lsc-sequence-warning" role="status">
      <p>
        <strong>{revision.titulo}</strong>
      </p>

      <p>{revision.detalle}</p>

      {sena.estado === "pendiente-validacion" && (
        <p>
          <strong>Estado del catálogo:</strong>{" "}
          Pendiente de validación.
        </p>
      )}

      {!video && !imagen && !animacion && (
        <p>
          <strong>Recurso visual:</strong>{" "}
          No hay video, imagen ni animación registrada para este concepto.
        </p>
      )}
    </div>
  );
})()}
          </>
        ) : (
          <div className="lsc-sequence-empty">
            <span aria-hidden="true">🔎</span>
            <p>
              Esta palabra no tiene una coincidencia exacta
              en la biblioteca actual. No se inventará una seña.
            </p>
          </div>
        )}

        <div className="lsc-sequence-dots">
          {segmentos.map((segmento, i) => (
            <button
              key={`${segmento.texto}-${i}`}
              type="button"
              className={
                i === posicion
                  ? "lsc-sequence-dot active"
                  : "lsc-sequence-dot"
              }
              onClick={() => cambiarIndice(i)}
              disabled={
                indiceSincronizado !== undefined &&
                !onIndiceChange
              }
              aria-label={`Ver elemento ${i + 1}: ${segmento.texto}`}
              aria-current={i === posicion ? "step" : undefined}
            />
          ))}
        </div>
      </div>

      <div className="lsc-sequence-settings">
      <label htmlFor={`${idSecuencia}-seconds`}>
          Tiempo por elemento
        </label>

        <select
          id={`${idSecuencia}-seconds`}
          value={segundos}
          onChange={(evento) =>
            setSegundos(Number(evento.target.value))
          }
        >
          <option value={3}>3 segundos</option>
          <option value={5}>5 segundos</option>
          <option value={8}>8 segundos</option>
          <option value={10}>10 segundos</option>
        </select>
      </div>

      <div className="lsc-sequence-controls">
      <button
  type="button"
  onClick={retroceder}
  disabled={
    (indiceSincronizado !== undefined && !onIndiceChange) ||
    posicion === 0
  }
>
  Anterior
</button>

        <button
  type="button"
  onClick={() => setAuto((valor) => !valor)}
  disabled={
    indiceSincronizado !== undefined &&
    !onIndiceChange
  }
>
  {auto ? "Pausar secuencia" : "Reproducir secuencia"}
</button>

<button
  type="button"
  onClick={avanzar}
  disabled={
    (indiceSincronizado !== undefined && !onIndiceChange) ||
    posicion === segmentos.length - 1
  }
>
  Siguiente
</button>
      </div>

      <p className="lsc-sequence-status">
        {auto
          ? video
            ? "La secuencia avanzará al terminar el video."
            : `Avance automático cada ${segundos} segundos.`
          : "Modo manual. Avanza cuando estés listo."}
      </p>
    </section>
  );
}
