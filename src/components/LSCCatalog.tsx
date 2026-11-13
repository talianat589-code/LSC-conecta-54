import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  bibliotecaLSC,
  buscarSenas,
  type SenaLSC,
} from "../data/lscLibrary";
import {
  obtenerMediosAprobadosPorSena,
} from "../data/lscMedia";

type LSCCatalogProps = {
  onSeleccionar?: (sena: SenaLSC) => void;
  consultaVoz?: string;
};

export default function LSCCatalog({
  onSeleccionar,
  consultaVoz,
}: LSCCatalogProps) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [senaSeleccionada, setSenaSeleccionada] =
    useState<SenaLSC | null>(null);
    const mediosSeleccionados =
  senaSeleccionada
    ? obtenerMediosAprobadosPorSena(
        senaSeleccionada.id
      )
    : [];
    useEffect(() => {
      if (consultaVoz?.trim()) {
        setBusqueda(consultaVoz);
      }
    }, [consultaVoz]);

  const categorias = useMemo(() => {
    return [
      "Todas",
      ...Array.from(
        new Set(
          bibliotecaLSC.map(
            (sena) => sena.categoria
          )
        )
      ),
    ];
  }, []);

  const resultados = useMemo(() => {
    let lista = bibliotecaLSC;

    if (busqueda.trim()) {
      lista = buscarSenas(busqueda);
    }

    if (categoria !== "Todas") {
      lista = lista.filter(
        (sena) => sena.categoria === categoria
      );
    }

    return lista;
  }, [busqueda, categoria]);

  const seleccionarSena = (sena: SenaLSC) => {
    setSenaSeleccionada(sena);

    if (onSeleccionar) {
      onSeleccionar(sena);
    }
  };

  return (
    <div className="lsc-catalog">
      <div className="lsc-catalog-header">
        <h3>🇨🇴 Biblioteca LSC</h3>

        <p>
          Explora los conceptos disponibles en
          nuestra biblioteca de Lengua de Señas
          Colombiana.
        </p>
      </div>

      <div className="lsc-catalog-search">
        <input
          type="text"
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
          placeholder="Buscar una seña o concepto..."
          aria-label="Buscar una seña"
        />
      </div>

      <div className="lsc-catalog-categories">
        {categorias.map((item) => (
          <button
            key={item}
            type="button"
            className={
              categoria === item
                ? "lsc-category active"
                : "lsc-category"
            }
            onClick={() =>
              setCategoria(item)
            }
          >
            {item}
          </button>
        ))}
      </div>

      <div className="lsc-catalog-grid">
        {resultados.map((sena) => (
          <button
            key={sena.id}
            type="button"
            className="lsc-card"
            onClick={() =>
              seleccionarSena(sena)
            }
          >
            <span className="lsc-card-icon">
              🤟
            </span>

            <strong>{sena.concepto}</strong>

            <span className="lsc-card-category">
              {sena.categoria}
            </span>

            <span className="lsc-card-status">
              {sena.estado ===
              "pendiente-validacion"
                ? "Referencia pendiente"
                : "Disponible"}
            </span>
          </button>
        ))}
      </div>

      {resultados.length === 0 && (
        <div className="lsc-empty">
          No encontramos ese concepto en la
          biblioteca actual.
        </div>
      )}

      {senaSeleccionada && (
        <div className="lsc-selected">
          <button
            type="button"
            className="lsc-close"
            onClick={() =>
              setSenaSeleccionada(null)
            }
          >
            ✕
          </button>

          <h4>
            {senaSeleccionada.concepto}
          </h4>

          <p>
            {senaSeleccionada.descripcion}
          </p>

          <p>
            <strong>Categoría:</strong>{" "}
            {senaSeleccionada.categoria}
          </p>

          <p>
            <strong>Estado:</strong>{" "}
            {senaSeleccionada.estado}
          </p>
          <div className="lsc-media-section">
  <h5>Referencia visual</h5>

  {mediosSeleccionados.length === 0 ? (
    <div className="lsc-media-empty">
      <div className="lsc-media-empty-icon">
        🎥
      </div>

      <p>
        Aún no hay una referencia multimedia
        aprobada para esta seña.
      </p>

      <small>
        La referencia se incorporará después
        de verificar su fuente, licencia y
        validación lingüística.
      </small>
    </div>
  ) : (
    <div className="lsc-media-list">
      {mediosSeleccionados.map((media) => (
        <div
          key={media.id}
          className="lsc-media-item"
        >
          {media.tipo === "video" &&
            media.url && (
              <video
                controls
                playsInline
                preload="metadata"
                className="lsc-media-video"
                src={media.url}
              />
            )}

          {media.tipo === "imagen" &&
            media.url && (
              <img
                src={media.url}
                alt={media.titulo}
                className="lsc-media-image"
              />
            )}

          <h6>{media.titulo}</h6>

          <p>
            {media.descripcion}
          </p>

          <div className="lsc-media-source">
            <strong>Licencia:</strong>{" "}
            {media.licencia}
          </div>

          <div className="lsc-media-source">
            <strong>Estado:</strong>{" "}
            {media.estado}
          </div>

<div className="lsc-media-source">
  <strong>Fuente registrada:</strong>{" "}
  {media.fuenteId}
</div>

<div className="lsc-media-source">
  <strong>Atribución requerida:</strong>{" "}
  {media.requiereAtribucion ? "Sí" : "No"}
</div>

        </div>
      ))}
    </div>
  )}
</div>
          {senaSeleccionada.imagen ||
          senaSeleccionada.video ||
          senaSeleccionada.animacion ? (
            <p>
              Referencia disponible para
              reproducción.
            </p>
          ) : (
            <p className="lsc-warning">
              ⚠️ Todavía no hemos incorporado una
              referencia visual validada para esta
              entrada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}