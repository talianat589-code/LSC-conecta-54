import { useState } from "react";

type Sena = {
  id: number;
  nombre: string;
  emoji: string;
  descripcion: string;
};

const senas: Sena[] = [
  {
    id: 1,
    nombre: "Hola",
    emoji: "👋",
    descripcion:
      "Aprende una forma básica de saludar en LSC.",
  },
  {
    id: 2,
    nombre: "Gracias",
    emoji: "🤟",
    descripcion:
      "Practica la seña correspondiente a gracias.",
  },
  {
    id: 3,
    nombre: "Buenos días",
    emoji: "🌅",
    descripcion:
      "Aprende una expresión utilizada para saludar durante la mañana.",
  },
  {
    id: 4,
    nombre: "Buenas noches",
    emoji: "🌙",
    descripcion:
      "Practica una expresión habitual para saludar o despedirse por la noche.",
  },
];

export default function LearningModule() {
  const [senaActual, setSenaActual] = useState(0);
  const [aprendiendo, setAprendiendo] = useState(false);

  const sena = senas[senaActual];

  const siguienteSena = () => {
    setSenaActual((actual) => {
      if (actual >= senas.length - 1) {
        return 0;
      }

      return actual + 1;
    });

    setAprendiendo(false);
  };

  const senaAnterior = () => {
    setSenaActual((actual) => {
      if (actual <= 0) {
        return senas.length - 1;
      }

      return actual - 1;
    });

    setAprendiendo(false);
  };

  return (
    <section className="learning-module">
      <div className="learning-header">
        <h2>📚 Aprender LSC</h2>

        <p>
          Aprende y practica diferentes señas de
          la Lengua de Señas Colombiana.
        </p>
      </div>

      <div className="learning-card">
        <div className="learning-progress">
          Seña {senaActual + 1} de {senas.length}
        </div>

        <div className="learning-symbol">
          <span>{sena.emoji}</span>
        </div>

        <h3>{sena.nombre}</h3>

        <p>{sena.descripcion}</p>

        {!aprendiendo ? (
          <button
            type="button"
            onClick={() => setAprendiendo(true)}
            className="learning-primary-button"
          >
            🤟 Aprender esta seña
          </button>
        ) : (
          <div className="learning-practice">
            <h4>Practica esta seña</h4>

            <p>
              Observa la referencia y después
              utilizaremos la cámara para comprobar
              tu movimiento.
            </p>

            <div className="learning-reference">
              <span>{sena.emoji}</span>
              <strong>{sena.nombre}</strong>
            </div>

            <button
              type="button"
              onClick={() => setAprendiendo(false)}
              className="learning-secondary-button"
            >
              ← Volver
            </button>
          </div>
        )}
      </div>

      <div className="learning-navigation">
        <button
          type="button"
          onClick={senaAnterior}
        >
          ← Anterior
        </button>

        <button
          type="button"
          onClick={siguienteSena}
        >
          Siguiente →
        </button>
      </div>
    </section>
  );
}