
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./index.css";
import HandCamera from "./components/HandCamera";
import CommunicationView from "./components/CommunicationView";
import VoiceRecognition from "./VoiceRecognition";
import SignInterpreter from "./components/SignInterpreter";
import LearningModule from "./components/LearningModule";
import LSCCatalog from "./components/LSCCatalog";
import LSCResourceReview from "./components/LSCResourceReview";
import LSCResourceInventory from "./components/LSCResourceInventory";
import LSCVisualSequence from "./components/LSCVisualSequence";
import LSCContextAnalysis from "./components/LSCContextAnalysis";
import LSCAvatar from "./components/LSCAvatar";
import {
  buscarCoincidenciasDeVoz,
  type ResultadoVozBiblioteca,
} from "./data/lscVoiceLibraryAdapter";
import {
  planificarFraseLSC,
  type PlanFraseLSC,
} from "./data/lscPhrasePlanner";
type Landmark = {
  x: number;
  y: number;
  z: number;
};

type FrameData = {
  timestamp: number;
  hands: Landmark[][];
};

type FotogramaTrayectoriaLSC = {
  tiempoMs: number;
  cambioPostura: number;
  desplazamientoMuneca: number;
  caracteristicas: number[];
};

type MuestraTrayectoriaLSC = {
  id: string;
  inicio: number;
  fin: number;
  fotogramas: number;
  movimientoMaximo: number;
  trayectoria: FotogramaTrayectoriaLSC[];
  estado: "experimental";
  reviewStatus: EstadoRevisionTecnica;
  validacionLinguistica: EstadoValidacionLinguistica;
  fechaImportacion: string;
};

type EstadoRevisionTecnica =
  | "pendiente"
  | "revisada"
  | "descartada";

type EstadoValidacionLinguistica =
  | "pendiente"
  | "validada"
  | "requiere-correccion";

type CategoriaLSC =
  | "saludos"
  | "cortesia"
  | "respuestas"
  | "comunicacion"
  | "necesidades"
  | "otra";

type ManoUtilizada =
  | "izquierda"
  | "derecha"
  | "ambas"
  | "no-especificada";

type SignSample = {
  id: string;
  label: string;
  createdAt: string;

  // Metadatos de la muestra
  categoria?: CategoriaLSC;
  participanteCodigo?: string;
  manoUtilizada?: ManoUtilizada;

  // Revisiones independientes
  reviewStatus?: EstadoRevisionTecnica;
  validacionLinguistica?: EstadoValidacionLinguistica;
  fuenteValidacion?: string;

  timestampMode?: "relative-ms";
  frameCount?: number;
  durationMs?: number;
  approxFps?: number;
  frames: FrameData[];
};

function validarCalidadFrames(
  frames: FrameData[]
): string | null {
  if (!Array.isArray(frames) || frames.length < 5) {
    return "Se necesitan al menos cinco fotogramas.";
  }

  let tiempoAnterior = -1;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (
      !frame ||
      !Number.isFinite(frame.timestamp) ||
      frame.timestamp < 0
    ) {
      return `El fotograma ${i + 1} tiene un tiempo inválido.`;
    }

    if (frame.timestamp < tiempoAnterior) {
      return "Los tiempos de los fotogramas no están ordenados.";
    }

    tiempoAnterior = frame.timestamp;

    if (!Array.isArray(frame.hands) || frame.hands.length === 0) {
      return `El fotograma ${i + 1} no contiene manos.`;
    }

    for (
      let manoIndex = 0;
      manoIndex < frame.hands.length;
      manoIndex++
    ) {
      const mano = frame.hands[manoIndex];

      if (!Array.isArray(mano) || mano.length !== 21) {
        return `El fotograma ${i + 1}, mano ${manoIndex + 1}: se esperaban 21 puntos.`;
      }

      for (
        let puntoIndex = 0;
        puntoIndex < mano.length;
        puntoIndex++
      ) {
        const punto = mano[puntoIndex];

        if (
          !punto ||
          !Number.isFinite(punto.x) ||
          !Number.isFinite(punto.y) ||
          !Number.isFinite(punto.z)
        ) {
          return `El fotograma ${i + 1}, mano ${manoIndex + 1}: el punto ${puntoIndex + 1} tiene coordenadas inválidas.`;
        }
      }
    }
  }

  return null;
}
type Modo =
  | "senas"
  | "voz"
  | "aprender"
  | "comunicar"
  | "entender-senas"
  | "revision-recursos";

type Ejercicio = {
  nombre: string;
  instruccion: string;
  objetivo: string;
  emoji: string;
};

const ejercicios: Ejercicio[] = [
  {
    nombre: "Mano abierta",
    instruccion:
      "Extiende los dedos y muestra la palma hacia la cámara.",
    objetivo: "mano abierta",
    emoji: "✋",
  },
  {
    nombre: "Puño cerrado",
    instruccion:
      "Cierra los dedos formando un puño y mantenlo frente a la cámara.",
    objetivo: "puño cerrado",
    emoji: "✊",
  },
  {
    nombre: "Índice extendido",
    instruccion:
      "Extiende el dedo índice y mantén los demás dedos doblados.",
    objetivo: "índice extendido",
    emoji: "☝️",
  },
];

function reconocerGesto(hands: Landmark[][]): string {
  if (!hands.length) return "sin mano";

  const hand = hands[0];

  if (!hand || hand.length < 21) {
    return "gesto no identificado";
  }

  // Puntos de referencia de las puntas y articulaciones
  // de los dedos según el modelo de MediaPipe.
  const dedosExtendidos = [
    hand[8].y < hand[6].y,   // Índice
    hand[12].y < hand[10].y, // Medio
    hand[16].y < hand[14].y, // Anular
    hand[20].y < hand[18].y, // Meñique
  ];

  const cantidadExtendidos =
    dedosExtendidos.filter(Boolean).length;

  if (cantidadExtendidos === 4) {
    return "mano abierta";
  }

  if (cantidadExtendidos === 0) {
    return "puño cerrado";
  }

  if (
    dedosExtendidos[0] &&
    !dedosExtendidos[1] &&
    !dedosExtendidos[2] &&
    !dedosExtendidos[3]
  ) {
    return "índice extendido";
  }

  return "gesto no identificado";
}


type DatasetLSC = {
  entrenamiento: SignSample[];
  validacion: SignSample[];
  excluidas: SignSample[];
  pendientes: SignSample[];
  sinParticipante: SignSample[];
  etiquetasSinSeparacion: string[];
  participantesEntrenamiento: string[];
  participantesValidacion: string[];
};

function prepararConjuntosLSC(
  muestras: SignSample[]
): DatasetLSC {
  const entrenamiento: SignSample[] = [];
  const validacion: SignSample[] = [];
  const excluidas: SignSample[] = [];
  const pendientes: SignSample[] = [];
  const sinParticipante: SignSample[] = [];

  const aprobadas: SignSample[] = [];

  muestras.forEach((muestra) => {
    const estadoRevision =
      muestra.reviewStatus ?? "pendiente";

    if (estadoRevision === "descartada") {
      excluidas.push(muestra);
      return;
    }

    if (estadoRevision !== "revisada") {
      pendientes.push(muestra);
      return;
    }

    const estadoLinguistico =
      muestra.validacionLinguistica ?? "pendiente";

    if (estadoLinguistico !== "validada") {
      pendientes.push(muestra);
      return;
    }

    if (
      !muestra.participanteCodigo ||
      !muestra.participanteCodigo.trim()
    ) {
      sinParticipante.push(muestra);
      return;
    }

    aprobadas.push(muestra);
  });

  const muestrasPorParticipante = new Map<
    string,
    SignSample[]
  >();

  const nombresParticipantes = new Map<string, string>();

  aprobadas.forEach((muestra) => {
    const codigoOriginal =
      muestra.participanteCodigo!.trim();

    const codigoNormalizado =
      codigoOriginal.toLocaleLowerCase();

    nombresParticipantes.set(
      codigoNormalizado,
      codigoOriginal
    );

    if (!muestrasPorParticipante.has(codigoNormalizado)) {
      muestrasPorParticipante.set(
        codigoNormalizado,
        []
      );
    }

    muestrasPorParticipante
      .get(codigoNormalizado)!
      .push(muestra);
  });

  const participantesPorEtiqueta = new Map<
    string,
    Set<string>
  >();

  aprobadas.forEach((muestra) => {
    const etiqueta = muestra.label
      .trim()
      .toLocaleLowerCase();

    const participante =
      muestra.participanteCodigo!.trim()
        .toLocaleLowerCase();

    if (!participantesPorEtiqueta.has(etiqueta)) {
      participantesPorEtiqueta.set(
        etiqueta,
        new Set<string>()
      );
    }

    participantesPorEtiqueta
      .get(etiqueta)!
      .add(participante);
  });

  const etiquetasSinSeparacion = Array.from(
    participantesPorEtiqueta.entries()
  )
    .filter(([, participantes]) =>
      participantes.size < 2
    )
    .map(([etiqueta]) => etiqueta);

  const participantesOrdenados = Array.from(
    muestrasPorParticipante.keys()
  ).sort();

  const participantesSeleccionados =
    new Set<string>();

  const objetivoValidacion = Math.max(
    1,
    Math.floor(participantesOrdenados.length * 0.2)
  );

  participantesOrdenados.forEach((participante) => {
    if (
      participantesSeleccionados.size >=
      objetivoValidacion
    ) {
      return;
    }

    const muestrasParticipante =
      muestrasPorParticipante.get(participante) ?? [];

    const etiquetasParticipante = new Set(
      muestrasParticipante.map((muestra) =>
        muestra.label.trim().toLocaleLowerCase()
      )
    );

    const puedeValidarse = Array.from(
      etiquetasParticipante
    ).every((etiqueta) => {
      const participantesEtiqueta =
        participantesPorEtiqueta.get(etiqueta);

      if (
        !participantesEtiqueta ||
        participantesEtiqueta.size < 2
      ) {
        return false;
      }

      const quedanEnEntrenamiento = Array.from(
        participantesEtiqueta
      ).filter(
        (codigo) =>
          codigo !== participante &&
          !participantesSeleccionados.has(codigo)
      );

      return quedanEnEntrenamiento.length >= 1;
    });

    if (puedeValidarse) {
      participantesSeleccionados.add(participante);
    }
  });

  muestrasPorParticipante.forEach(
    (grupo, participante) => {
      if (participantesSeleccionados.has(participante)) {
        validacion.push(...grupo);
      } else {
        entrenamiento.push(...grupo);
      }
    }
  );

  const participantesEntrenamiento =
    participantesOrdenados
      .filter(
        (codigo) =>
          !participantesSeleccionados.has(codigo)
      )
      .map(
        (codigo) =>
          nombresParticipantes.get(codigo) ?? codigo
      );

  const participantesValidacion =
    participantesOrdenados
      .filter((codigo) =>
        participantesSeleccionados.has(codigo)
      )
      .map(
        (codigo) =>
          nombresParticipantes.get(codigo) ?? codigo
      );

  return {
    entrenamiento,
    validacion,
    excluidas,
    pendientes,
    sinParticipante,
    etiquetasSinSeparacion,
    participantesEntrenamiento,
    participantesValidacion,
  };
}

type ResultadoVerificacionLSC = {
  valido: boolean;
  errores: string[];
  advertencias: string[];
  totalMuestras: number;
  totalEtiquetas: number;
};

function verificarArchivoDatasetLSC(
  datos: unknown
): ResultadoVerificacionLSC {
  const errores: string[] = [];
  const advertencias: string[] = [];

  let totalMuestras = 0;
  let totalEtiquetas = 0;

  if (
    typeof datos !== "object" ||
    datos === null ||
    Array.isArray(datos)
  ) {
    return {
      valido: false,
      errores: ["El archivo no contiene un objeto JSON válido."],
      advertencias,
      totalMuestras,
      totalEtiquetas,
    };
  }

  const archivo = datos as Record<string, unknown>;

  if (archivo.project !== "LSC Conecta") {
    errores.push("El archivo no identifica el proyecto LSC Conecta.");
  }

  if (archivo.formatVersion !== 1) {
    errores.push("La versión del formato no es compatible.");
  }

  const tiposPermitidos = [
    "entrenamiento",
    "validacion",
    "excluidas",
  ];

  if (
    typeof archivo.datasetType !== "string" ||
    !tiposPermitidos.includes(archivo.datasetType)
  ) {
    errores.push("El tipo de conjunto de datos no es válido.");
  }

  if (
    !Array.isArray(archivo.samples)
  ) {
    errores.push("No se encontró una lista válida de muestras.");
  } else {
    const muestras = archivo.samples;
    totalMuestras = muestras.length;

    const etiquetas = new Set<string>();
    const ids = new Set<string>();

    muestras.forEach((elemento, indice) => {
      const numero = indice + 1;

      if (
        typeof elemento !== "object" ||
        elemento === null ||
        Array.isArray(elemento)
      ) {
        errores.push(
          `Muestra ${numero}: el contenido no es un objeto válido.`
        );
        return;
      }

      const muestra = elemento as Record<string, unknown>;

      if (
        typeof muestra.id !== "string" ||
        muestra.id.trim() === ""
      ) {
        errores.push(`Muestra ${numero}: falta un identificador válido.`);
      } else if (ids.has(muestra.id)) {
        errores.push(`Muestra ${numero}: identificador duplicado.`);
      } else {
        ids.add(muestra.id);
      }

      if (
        typeof muestra.label !== "string" ||
        muestra.label.trim() === ""
      ) {
        errores.push(`Muestra ${numero}: falta la etiqueta de la seña.`);
      } else {
        etiquetas.add(muestra.label.trim().toLocaleLowerCase());
      }

      if (
        !Array.isArray(muestra.frames)
      ) {
        errores.push(`Muestra ${numero}: faltan los fotogramas.`);
      } else {
        const problema = validarCalidadFrames(
          muestra.frames as FrameData[]
        );

        if (problema) {
          errores.push(`Muestra ${numero}: ${problema}`);
        }
      }

      if (
        muestra.reviewStatus !== "revisada" &&
        archivo.datasetType !== "excluidas"
      ) {
        errores.push(
          `Muestra ${numero}: no figura como revisada.`
        );
      }
      if (
        archivo.datasetType !== "excluidas" &&
        muestra.validacionLinguistica !== "validada"
      ) {
        errores.push(
          `Muestra ${numero}: no cuenta con validación lingüística aprobada.`
        );
      }

      if (
        archivo.datasetType === "excluidas" &&
        muestra.reviewStatus !== "descartada"
      ) {
        errores.push(
          `Muestra ${numero}: debería estar descartada.`
        );
      }
    });

    totalEtiquetas = etiquetas.size;

    if (
      typeof archivo.totalSamples !== "number" ||
      archivo.totalSamples !== muestras.length
    ) {
      errores.push(
        "El total declarado no coincide con las muestras del archivo."
      );
    }

    if (
      typeof archivo.totalLabels !== "number" ||
      archivo.totalLabels !== totalEtiquetas
    ) {
      errores.push(
        "El total declarado de etiquetas no coincide con el contenido."
      );
    }

    if (muestras.length === 0) {
      advertencias.push(
        "El conjunto está vacío; no hay muestras para utilizar."
      );
    }
  }

  if (
    typeof archivo.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(archivo.exportedAt))
  ) {
    errores.push("La fecha de exportación falta o no es válida.");
  }

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    totalMuestras,
    totalEtiquetas,
  };
}


type ResultadoComparacionLSC = {
  valido: boolean;
  errores: string[];
  advertencias: string[];
  totalEntrenamiento: number;
  totalValidacion: number;
  idsCompartidos: string[];
  participantesCompartidos: string[];
  muestrasDuplicadas: string[];
  etiquetasEntrenamiento: string[];
  etiquetasValidacion: string[];
};

function compararConjuntosLSC(
  datosEntrenamiento: unknown,
  datosValidacion: unknown
): ResultadoComparacionLSC {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const verificacionEntrenamiento =
    verificarArchivoDatasetLSC(datosEntrenamiento);

  const verificacionValidacion =
    verificarArchivoDatasetLSC(datosValidacion);

  if (!verificacionEntrenamiento.valido) {
    errores.push(
      ...verificacionEntrenamiento.errores.map(
        (error) => `Entrenamiento: ${error}`
      )
    );
  }

  if (!verificacionValidacion.valido) {
    errores.push(
      ...verificacionValidacion.errores.map(
        (error) => `Validación: ${error}`
      )
    );
  }

  const obtenerMuestras = (
    datos: unknown
  ): Record<string, unknown>[] => {
    if (
      typeof datos !== "object" ||
      datos === null ||
      Array.isArray(datos)
    ) {
      return [];
    }

    const muestras = (
      datos as Record<string, unknown>
    ).samples;

    if (!Array.isArray(muestras)) {
      return [];
    }

    return muestras.filter(
      (muestra): muestra is Record<string, unknown> =>
        typeof muestra === "object" &&
        muestra !== null &&
        !Array.isArray(muestra)
    );
  };

  const muestrasEntrenamiento =
    obtenerMuestras(datosEntrenamiento);

  const muestrasValidacion =
    obtenerMuestras(datosValidacion);

  const idsEntrenamiento = new Set(
    muestrasEntrenamiento
      .map((muestra) => muestra.id)
      .filter(
        (id): id is string => typeof id === "string"
      )
  );

  const idsCompartidos = [
    ...new Set(
      muestrasValidacion
        .map((muestra) => muestra.id)
        .filter(
          (id): id is string =>
            typeof id === "string" &&
            idsEntrenamiento.has(id)
        )
    ),
  ];

  if (idsCompartidos.length > 0) {
    errores.push(
      `Hay ${idsCompartidos.length} identificador(es) compartido(s) entre entrenamiento y validación.`
    );
  }

    // Comprobar que una persona no aparezca en ambos conjuntos.
    const obtenerParticipantes = (
      muestras: Record<string, unknown>[]
    ): Set<string> => {
      return new Set(
        muestras
          .map((muestra) =>
            typeof muestra.participanteCodigo === "string"
              ? muestra.participanteCodigo.trim().toLocaleLowerCase()
              : ""
          )
          .filter((codigo) => codigo !== "")
      );
    };
  
    const participantesEntrenamiento =
      obtenerParticipantes(muestrasEntrenamiento);
  
    const participantesValidacion =
      obtenerParticipantes(muestrasValidacion);
  
    const participantesCompartidos = [
      ...participantesValidacion,
    ].filter((codigo) =>
      participantesEntrenamiento.has(codigo)
    );
  
    if (participantesCompartidos.length > 0) {
      errores.push(
        `Hay ${participantesCompartidos.length} participante(s) presente(s) en entrenamiento y validación. La separación no es independiente.`
      );
    }
  
    const sinCodigoEntrenamiento =
      muestrasEntrenamiento.filter(
        (muestra) =>
          typeof muestra.participanteCodigo !== "string" ||
          !muestra.participanteCodigo.trim()
      ).length;
  
    const sinCodigoValidacion =
      muestrasValidacion.filter(
        (muestra) =>
          typeof muestra.participanteCodigo !== "string" ||
          !muestra.participanteCodigo.trim()
      ).length;
  
    if (
      sinCodigoEntrenamiento > 0 ||
      sinCodigoValidacion > 0
    ) {
      advertencias.push(
        `Hay muestras sin código de participante: ${sinCodigoEntrenamiento} en entrenamiento y ${sinCodigoValidacion} en validación. No se puede comprobar su identidad.`
      );
    }

  const crearHuella = (
    muestra: Record<string, unknown>
  ): string | null => {
    if (
      typeof muestra.label !== "string" ||
      !Array.isArray(muestra.frames)
    ) {
      return null;
    }

    try {
      return JSON.stringify({
        etiqueta: muestra.label.trim().toLocaleLowerCase(),
        frames: muestra.frames,
      });
    } catch {
      return null;
    }
  };

  const huellasEntrenamiento = new Set(
    muestrasEntrenamiento
      .map(crearHuella)
      .filter(
        (huella): huella is string => huella !== null
      )
  );

  const muestrasDuplicadas = [
    ...new Set(
      muestrasValidacion
        .filter((muestra) => {
          const huella = crearHuella(muestra);

          return (
            huella !== null &&
            huellasEntrenamiento.has(huella)
          );
        })
        .map((muestra) =>
          typeof muestra.id === "string"
            ? muestra.id
            : "sin identificador"
        )
    ),
  ];

  if (muestrasDuplicadas.length > 0) {
    errores.push(
      `Se encontraron ${muestrasDuplicadas.length} muestra(s) con la misma etiqueta y los mismos fotogramas en ambos conjuntos.`
    );
  }

  const obtenerEtiquetas = (
    muestras: Record<string, unknown>[]
  ): string[] =>
    [
      ...new Set(
        muestras
          .map((muestra) =>
            typeof muestra.label === "string"
              ? muestra.label.trim()
              : ""
          )
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

  const etiquetasEntrenamiento =
    obtenerEtiquetas(muestrasEntrenamiento);

  const etiquetasValidacion =
    obtenerEtiquetas(muestrasValidacion);

  const etiquetasEntrenamientoNormalizadas = new Set(
    etiquetasEntrenamiento.map((etiqueta) =>
      etiqueta.toLocaleLowerCase()
    )
  );

  const etiquetasSinEntrenamiento =
    etiquetasValidacion.filter(
      (etiqueta) =>
        !etiquetasEntrenamientoNormalizadas.has(
          etiqueta.toLocaleLowerCase()
        )
    );

  if (etiquetasSinEntrenamiento.length > 0) {
    errores.push(
      "Hay etiquetas en validación que no aparecen en entrenamiento: " +
        etiquetasSinEntrenamiento.join(", ")
    );
  }

  if (
    muestrasEntrenamiento.length === 0 ||
    muestrasValidacion.length === 0
  ) {
    advertencias.push(
      "Uno de los conjuntos está vacío; no es posible realizar una comparación completa."
    );
  }

  advertencias.push(
    "La comparación no detecta necesariamente grabaciones de la misma persona ni señas visualmente similares."
  );

  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    totalEntrenamiento: muestrasEntrenamiento.length,
    totalValidacion: muestrasValidacion.length,
    idsCompartidos,
    participantesCompartidos, 
    muestrasDuplicadas,
    etiquetasEntrenamiento,
    etiquetasValidacion,
  };
}

function App() {
  const [modo, setModo] = useState<Modo>("senas");
  const [consultaVoz, setConsultaVoz] =
  useState("");
  const [resultadosVoz, setResultadosVoz] = useState<
  ResultadoVozBiblioteca[]
>([]);
const procesarTextoVoz = (texto: string) => {
  setConsultaVoz(texto);
  setResultadosVoz(buscarCoincidenciasDeVoz(texto));
  setPlanFrase(planificarFraseLSC(texto));
};
const [planFrase, setPlanFrase] =
  useState<PlanFraseLSC | null>(null);
  const [etiqueta, setEtiqueta] = useState("");
  const [categoriaMuestra, setCategoriaMuestra] =
  useState<CategoriaLSC>("otra");

const [codigoParticipante, setCodigoParticipante] =
  useState("PARTICIPANTE-01");

const [manoUtilizada, setManoUtilizada] =
  useState<ManoUtilizada>("no-especificada");
  const [grabando, setGrabando] = useState(false);
  const [muestras, setMuestras] = useState<SignSample[]>([]);
  const [trayectoriasImportadas, setTrayectoriasImportadas] =
  useState<MuestraTrayectoriaLSC[]>([]);
  const [resultadoVerificacion, setResultadoVerificacion] =
  useState<ResultadoVerificacionLSC | null>(null);

const [nombreArchivoVerificado, setNombreArchivoVerificado] =
  useState("");

const [resultadoComparacion, setResultadoComparacion] =
useState<ResultadoComparacionLSC | null>(null);

const [nombreArchivoEntrenamiento, setNombreArchivoEntrenamiento] =
useState("");

const [nombreArchivoValidacion, setNombreArchivoValidacion] =
useState("");

const [datosEntrenamientoComparacion, setDatosEntrenamientoComparacion] =
useState<unknown | null>(null);

const [datosValidacionComparacion, setDatosValidacionComparacion] =
useState<unknown | null>(null);

  const [filtroMuestras, setFiltroMuestras] = useState<
  "todas" | "pendiente" | "revisada" | "descartada"
>("todas");
  const [estado, setEstado] = useState(
    "Escribe el nombre de una seña para comenzar."
  );
  const [datosCargados, setDatosCargados] = useState(false);

  // Estados del módulo de aprendizaje
  const [ejercicioActual, setEjercicioActual] = useState(0);
  const [ejerciciosCompletados, setEjerciciosCompletados] =
    useState<number[]>([]);
  const [gestoDetectado, setGestoDetectado] = useState(
    "Esperando la cámara..."
  );
  const [mensajeAprendizaje, setMensajeAprendizaje] =
    useState("Coloca tu mano frente a la cámara.");
  const [acierto, setAcierto] = useState(false);

  const [textoVoz, setTextoVoz] = useState("");

  const grabandoRef = useRef(false);
const framesRef = useRef<FrameData[]>([]);
const etiquetaRef = useRef("");
const timerRef = useRef<number | null>(null);
const inicioGrabacionRef = useRef<number | null>(null);

  // Recuperar muestras guardadas
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(
        "lsc-conecta-muestras"
      );

      if (guardado) {
        const datos = JSON.parse(guardado);

        if (Array.isArray(datos)) {
          setMuestras(datos);
          setEstado(
            `Se recuperaron ${datos.length} muestras guardadas.`
          );
        }
      }
    } catch (error) {
      console.error("Error al recuperar muestras:", error);
      setEstado("No se pudieron recuperar los datos guardados.");
    } finally {
      setDatosCargados(true);
    }
  }, []);

  // Recuperar trayectorias experimentales guardadas
useEffect(() => {
  try {
    const guardadas = localStorage.getItem(
      "lsc-conecta-trayectorias"
    );

    if (guardadas) {
      const datos = JSON.parse(guardadas);

      if (Array.isArray(datos)) {
        setTrayectoriasImportadas(datos);
      }
    }
  } catch (error) {
    console.error(
      "Error al recuperar trayectorias:",
      error
    );
  }
}, []);

// Guardar trayectorias experimentales automáticamente
useEffect(() => {
  if (!datosCargados) return;

  try {
    localStorage.setItem(
      "lsc-conecta-trayectorias",
      JSON.stringify(trayectoriasImportadas)
    );
  } catch (error) {
    console.error(
      "Error al guardar trayectorias:",
      error
    );
    setEstado(
      "No se pudieron guardar las trayectorias. Descarga una copia del archivo original."
    );
  }
}, [trayectoriasImportadas, datosCargados]);


  useEffect(() => {
    if (!datosCargados) return;

    try {
      localStorage.setItem(
        "lsc-conecta-muestras",
        JSON.stringify(muestras)
      );
    } catch (error) {
      console.error("Error al guardar muestras:", error);
      setEstado(
        "No se pudieron guardar todos los datos. Descarga una copia JSON."
      );
    }
  }, [muestras, datosCargados]);

  // Procesar los puntos que entrega la cámara
  const procesarManos = useCallback(
    (hands: Landmark[][]) => {
      if (grabandoRef.current && hands.length > 0) {
        framesRef.current.push({
          timestamp: Math.max(
            0,
            Math.round(
              performance.now() -
                (inicioGrabacionRef.current ?? performance.now())
            )
          ),
          hands: hands.map((hand) =>
            hand.map((point) => ({
              x: point.x,
              y: point.y,
              z: point.z,
            }))
          ),
        });
      }

      if (modo === "aprender") {
        const gesto = reconocerGesto(hands);
        setGestoDetectado(gesto);

        const ejercicio = ejercicios[ejercicioActual];

        if (
          gesto === ejercicio.objetivo &&
          !ejerciciosCompletados.includes(ejercicioActual)
        ) {
          setAcierto(true);
          setMensajeAprendizaje(
            "¡Muy bien! Has realizado el gesto correctamente."
          );

          setEjerciciosCompletados((anteriores) =>
            anteriores.includes(ejercicioActual)
              ? anteriores
              : [...anteriores, ejercicioActual]
          );
        } else if (gesto === ejercicio.objetivo) {
          setAcierto(true);
          setMensajeAprendizaje(
            "¡Excelente! Ya completaste este ejercicio."
          );
        } else {
          setAcierto(false);

          setMensajeAprendizaje(
            hands.length === 0
              ? "No detectamos tu mano. Colócala frente a la cámara."
              : "Inténtalo nuevamente. Sigue las instrucciones del ejercicio."
          );
        }
      }
    },
    [modo, ejercicioActual, ejerciciosCompletados]
  );

  // Finalizar grabación de una muestra
  const finalizarGrabacion = useCallback(() => {
    if (!grabandoRef.current) return;

    grabandoRef.current = false;
    setGrabando(false);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const frames = [...framesRef.current];
    const nombre = etiquetaRef.current;

    if (frames.length < 5) {
      setEstado(
        "Se capturaron muy pocos fotogramas. Intenta grabar nuevamente."
      );
      return;
    }
    const errorCalidad = validarCalidadFrames(frames);

    if (errorCalidad !== null) {
      setEstado(
        `Muestra no guardada: ${errorCalidad} Intenta grabar nuevamente.`
      );
      return;
    }
    const duracionMs =
    frames.length > 1
      ? Math.max(
          0,
          frames[frames.length - 1].timestamp -
            frames[0].timestamp
        )
      : 0;

  const frecuenciaAproximada =
    duracionMs > 0 && frames.length > 1
      ? Math.round(
          ((frames.length - 1) / (duracionMs / 1000)) * 100
        ) / 100
      : 0;

      const nuevaMuestra: SignSample = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      
        label: nombre,
        createdAt: new Date().toISOString(),
      
        categoria: categoriaMuestra,
        participanteCodigo: codigoParticipante.trim(),
        manoUtilizada,
      
        reviewStatus: "pendiente",
        validacionLinguistica: "pendiente",
        fuenteValidacion: "",
      
        timestampMode: "relative-ms",
        frameCount: frames.length,
        durationMs: duracionMs,
        approxFps: frecuenciaAproximada,
        frames,
      };

    setMuestras((actuales) => [...actuales, nuevaMuestra]);

    setEstado(
      `Muestra guardada: ${nombre}. Fotogramas capturados: ${frames.length}.`
    );
  }, [
    categoriaMuestra,
    codigoParticipante,
    manoUtilizada,
  ]);

  // Iniciar grabación
  const iniciarGrabacion = () => {
    const nombre = etiqueta.trim();

    if (!nombre) {
      setEstado("Primero escribe el nombre de la seña.");
      return;
    }

    if (grabandoRef.current) return;

    framesRef.current = [];
etiquetaRef.current = nombre;
inicioGrabacionRef.current = performance.now();

grabandoRef.current = true;
    setGrabando(true);
    setEstado(
      `Grabando la seña: ${nombre}. Mantén tus manos visibles.`
    );

    timerRef.current = window.setTimeout(() => {
      finalizarGrabacion();
    }, 3000);
  };

  // Limpiar temporizador al salir
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      grabandoRef.current = false;
    };
  }, []);

  // Descargar muestras
  const descargarDatos = () => {
    if (muestras.length === 0) {
      setEstado("Todavía no hay muestras para descargar.");
      return;
    }

    const dataset = {
      project: "LSC Conecta",
      formatVersion: 1,
      description:
        "Muestras de puntos de referencia de manos para investigación y entrenamiento.",
      totalSamples: muestras.length,
      samples: muestras,
    };

    const archivo = new Blob(
      [JSON.stringify(dataset, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "lsc-conecta-dataset.json";

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    URL.revokeObjectURL(url);

    setEstado("Archivo de datos descargado correctamente.");
  };

  // Eliminar todas las muestras
  const limpiarMuestras = () => {
    if (grabandoRef.current) {
      setEstado(
        "Finaliza la grabación antes de limpiar los datos."
      );
      return;
    }

    setMuestras([]);
    setEstado("Se eliminaron las muestras de esta sesión.");
  };

  // Importar muestras y trayectorias JSON
  const importarDatos = async (

  event: React.ChangeEvent<HTMLInputElement>
) => {
  const archivo = event.target.files?.[0];

  if (!archivo) return;

  try {
    const contenido = await archivo.text();
    const datos: unknown = JSON.parse(contenido);

    // Reconocer el formato de trayectorias experimentales
    if (
      typeof datos === "object" &&
      datos !== null &&
      !Array.isArray(datos) &&
      (datos as any).tipoDatos ===
        "segmentos_experimentales_de_movimiento"
    ) {
      const objeto = datos as any;

      if (
        objeto.estadoValidacion !==
        "no_validado_linguisticamente"
      ) {
        throw new Error(
          "El archivo no tiene el estado de validación experimental esperado."
        );
      }

      if (
        !Array.isArray(objeto.segmentos) ||
        objeto.segmentos.length === 0
      ) {
        throw new Error(
          "El archivo no contiene segmentos de movimiento."
        );
      }

      const validas = objeto.segmentos.filter(
        (segmento: any) =>
          segmento &&
          typeof segmento.inicio === "number" &&
          Number.isFinite(segmento.inicio) &&
          typeof segmento.fin === "number" &&
          Number.isFinite(segmento.fin) &&
          typeof segmento.fotogramas === "number" &&
          Number.isFinite(segmento.fotogramas) &&
          typeof segmento.movimientoMaximo === "number" &&
          Number.isFinite(segmento.movimientoMaximo) &&
          Array.isArray(segmento.trayectoria) &&
          segmento.trayectoria.length > 0 &&
          segmento.trayectoria.every(
            (fotograma: any) =>
              fotograma &&
              Number.isFinite(fotograma.tiempoMs) &&
              Number.isFinite(fotograma.cambioPostura) &&
              Number.isFinite(fotograma.desplazamientoMuneca) &&
              Array.isArray(fotograma.caracteristicas) &&
              fotograma.caracteristicas.length > 0 &&
              fotograma.caracteristicas.every(
                (valor: unknown) =>
                  typeof valor === "number" &&
                  Number.isFinite(valor)
              )
          )
      );

      if (validas.length === 0) {
        throw new Error(
          "No se encontraron trayectorias con estructura numérica válida."
        );
      }

      setTrayectoriasImportadas((actuales) => {
        const ids = new Set(
          actuales.map((segmento) => segmento.id)
        );

        const nuevas = validas.map(
          (segmento: any, indice: number) => {
            let id =
              typeof segmento.id === "string"
                ? segmento.id
                : `trayectoria-${Date.now()}-${indice}`;

            if (ids.has(id)) {
              id = `${id}-${Date.now()}-${indice}`;
            }

            ids.add(id);

            return {
              id,
              inicio: segmento.inicio,
              fin: segmento.fin,
              fotogramas: segmento.fotogramas,
              movimientoMaximo: segmento.movimientoMaximo,
              trayectoria: segmento.trayectoria,
              estado: "experimental" as const,
              reviewStatus: "pendiente" as const,
              validacionLinguistica: "pendiente" as const,
              fechaImportacion: new Date().toISOString(),
            };
          }
        );

        return [...actuales, ...nuevas];
      });

      setEstado(
        `Se importaron ${validas.length} trayectorias experimentales. Pendientes de revisión.`
      );

      return;
    }

    // Mantener la importación tradicional de muestras de manos
    const muestrasImportadas = Array.isArray(datos)
      ? datos
      : (datos as any)?.samples;

    if (!Array.isArray(muestrasImportadas)) {
      throw new Error(
        "El archivo no contiene una lista de muestras válida."
      );
    }

    const validas = muestrasImportadas.filter(
      (muestra: any) =>
        typeof muestra.label === "string" &&
        Array.isArray(muestra.frames) &&
        muestra.frames.length > 0
    );

    if (validas.length === 0) {
      throw new Error(
        "No se encontraron muestras válidas en el archivo."
      );
    }

    setMuestras((actuales) => {
      const ids = new Set(
        actuales.map((muestra) => muestra.id)
      );

      const nuevas = validas.map((muestra: any) => {
        let id = muestra.id;

        if (!id || ids.has(id)) {
          id = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`;
        }

        ids.add(id);

        return {
          ...muestra,
          id,
          createdAt:
            muestra.createdAt || new Date().toISOString(),
        };
      });

      return [...actuales, ...nuevas];
    });

    setEstado(
      `Se importaron ${validas.length} muestras correctamente.`
    );
  } catch (error) {
    console.error("Error al importar:", error);

    setEstado(
      error instanceof Error
        ? error.message
        : "No se pudo importar el archivo."
    );
  } finally {
    event.target.value = "";
  }
};

  // Eliminar una muestra individual
  const eliminarMuestra = (id: string) => {
    setMuestras((actuales) =>
      actuales.filter((muestra) => muestra.id !== id)
    );

    setEstado("La muestra fue eliminada.");
  };

  const actualizarEstadoRevision = (
    id: string,
    nuevoEstado: "pendiente" | "revisada" | "descartada"
  ) => {
    setMuestras((actuales) =>
      actuales.map((muestra) =>
        muestra.id === id
          ? { ...muestra, reviewStatus: nuevoEstado }
          : muestra
      )
    );
  
    setEstado("Estado de revisión actualizado correctamente.");
  };

  const actualizarValidacionLinguistica = (
    id: string,
    nuevoEstado:
      | "pendiente"
      | "validada"
      | "requiere-correccion"
  ) => {
    setMuestras((actuales) =>
      actuales.map((muestra) =>
        muestra.id === id
          ? {
              ...muestra,
              validacionLinguistica: nuevoEstado,
            }
          : muestra
      )
    );

    setEstado("Validación lingüística actualizada correctamente.");
  };

  const actualizarFuenteValidacion = (
    id: string,
    nuevaFuente: string
  ) => {
    setMuestras((actuales) =>
      actuales.map((muestra) =>
        muestra.id === id
          ? {
              ...muestra,
              fuenteValidacion: nuevaFuente,
            }
          : muestra
      )
    );
  };

  // Reiniciar el módulo de aprendizaje
  const reiniciarAprendizaje = () => {
    setEjercicioActual(0);
    setEjerciciosCompletados([]);
    setAcierto(false);
    setGestoDetectado("Esperando la cámara...");
    setMensajeAprendizaje(
      "Coloca tu mano frente a la cámara."
    );
  };

  // Avanzar al siguiente ejercicio
  const siguienteEjercicio = () => {
    if (ejercicioActual < ejercicios.length - 1) {
      setEjercicioActual((actual) => actual + 1);
      setAcierto(false);
      setMensajeAprendizaje(
        "Realiza el nuevo gesto frente a la cámara."
      );
    }
  };

  const ejercicio = ejercicios[ejercicioActual];

  const muestrasFiltradas = muestras.filter((muestra) => {
    const estadoRevision = muestra.reviewStatus ?? "pendiente";
  
    return (
      filtroMuestras === "todas" ||
      estadoRevision === filtroMuestras
    );
  });
  const conjuntosDatos = prepararConjuntosLSC(muestras);

const etiquetasPreparadas = Array.from(
  new Set(
    conjuntosDatos.entrenamiento.map((muestra) =>
      muestra.label.trim()
    )
  )
);

const descargarConjuntoLSC = (
  tipo: "entrenamiento" | "validacion" | "excluidas"
) => {
  const muestrasExportar = conjuntosDatos[tipo];

  const etiquetas = Array.from(
    new Set(
      muestrasExportar.map((muestra) =>
        muestra.label.trim()
      )
    )
  );

  const archivo = {
    project: "LSC Conecta",
    datasetType: tipo,
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    totalSamples: muestrasExportar.length,
    totalLabels: etiquetas.length,
    labels: etiquetas,
    description:
      "Conjunto de datos de Lengua de Señas Colombiana. La exportación conserva los fotogramas y coordenadas originales.",
    samples: muestrasExportar,
  };

  const contenido = JSON.stringify(archivo, null, 2);

  const blob = new Blob([contenido], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = `lsc_${tipo}.json`;

  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);

  setEstado(
    `Conjunto ${tipo} exportado correctamente.`
  );
};
const verificarArchivoSeleccionado = async (
  archivo: File
) => {
  setResultadoVerificacion(null);
  setNombreArchivoVerificado(archivo.name);

  try {
    const contenido = await archivo.text();
    const datos: unknown = JSON.parse(contenido);

    const resultado = verificarArchivoDatasetLSC(datos);

    setResultadoVerificacion(resultado);

    setEstado(
      resultado.valido
        ? "Verificación técnica completada: no se encontraron errores."
        : "Verificación completada: se encontraron errores."
    );
  } catch {
    setResultadoVerificacion({
      valido: false,
      errores: [
        "No se pudo leer el archivo. Comprueba que sea un JSON válido.",
      ],
      advertencias: [],
      totalMuestras: 0,
      totalEtiquetas: 0,
    });

    setEstado("No se pudo verificar el archivo seleccionado.");
  }
};

const leerArchivoParaComparacion = async (
  archivo: File,
  tipo: "entrenamiento" | "validacion"
) => {
  try {
    const contenido = await archivo.text();
    const datos: unknown = JSON.parse(contenido);

    if (
      typeof datos !== "object" ||
      datos === null ||
      Array.isArray(datos)
    ) {
      throw new Error("El archivo no contiene un objeto JSON válido.");
    }

    const objeto = datos as Record<string, unknown>;

    if (objeto.datasetType !== tipo) {
      throw new Error(
        `Selecciona un archivo del conjunto de ${tipo}.`
      );
    }

    if (tipo === "entrenamiento") {
      setDatosEntrenamientoComparacion(datos);
      setNombreArchivoEntrenamiento(archivo.name);
    } else {
      setDatosValidacionComparacion(datos);
      setNombreArchivoValidacion(archivo.name);
    }

    setResultadoComparacion(null);
    setEstado(
      `Archivo de ${tipo} cargado correctamente.`
    );
  } catch (error) {
    setEstado(
      error instanceof Error
        ? error.message
        : "No se pudo leer el archivo seleccionado."
    );

    if (tipo === "entrenamiento") {
      setDatosEntrenamientoComparacion(null);
      setNombreArchivoEntrenamiento("");
    } else {
      setDatosValidacionComparacion(null);
      setNombreArchivoValidacion("");
    }

    setResultadoComparacion(null);
  }
};

const ejecutarComparacionLSC = () => {
  if (
    datosEntrenamientoComparacion === null ||
    datosValidacionComparacion === null
  ) {
    setEstado(
      "Primero selecciona los archivos de entrenamiento y validación."
    );
    return;
  }

  const resultado = compararConjuntosLSC(
    datosEntrenamientoComparacion,
    datosValidacionComparacion
  );

  setResultadoComparacion(resultado);
  setEstado(
    resultado.valido
      ? "Comparación terminada: no se detectaron errores."
      : "Comparación terminada: revisa los errores encontrados."
  );
};

  return (
    <main className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">🤟</span>
          <div>
            <h1>LSC Conecta</h1>
            <p>La comunicación nos une</p>
          </div>
        </div>

        <span className="status">● Prototipo</span>
      </header>

      <section className="welcome">
        <span className="eyebrow">
          COMUNICACIÓN SIN BARRERAS
        </span>

        <h2>Conectemos a través de la comunicación.</h2>

        <p>
          Una herramienta para acercar a las personas sordas
          y oyentes mediante la Lengua de Señas Colombiana.
        </p>
      </section>

      <nav className="selector">
        <button
          className={modo === "senas" ? "tab active" : "tab"}
          onClick={() => setModo("senas")}
        >
          🤟 Laboratorio
        </button>

        <button
          className={modo === "voz" ? "tab active" : "tab"}
          onClick={() => setModo("voz")}
        >
          🎙️ Voz a señas
        </button>
        <button
  type="button"
  onClick={() => setModo("entender-senas")}
>
  🤟 Entender señas
</button>
        <button
          className={
            modo === "aprender" ? "tab active" : "tab"
          }
          onClick={() => setModo("aprender")}
        >
          📚 Aprender
        </button>
        <button
  className={
    modo === "comunicar" ? "tab active" : "tab"
  }
  onClick={() => setModo("comunicar")}
>
  📹 Comunicar
</button>
<button
  type="button"
  className={
    modo === "revision-recursos" ? "tab active" : "tab"
  }
  onClick={() => setModo("revision-recursos")}
>
  📋 Revisar recursos LSC
</button>
      </nav>
      {modo === "senas" && (
        <section className="panel">
          <div className="panel-heading">
            <h3>Laboratorio de señas</h3>
            <span className="tag">Recopilación</span>
          </div>

          <div className="learning-intro">
            <h3>Enseñemos nuevas señas a la aplicación</h3>
            <p>
              Registra ejemplos de movimientos para construir
              nuestro primer conjunto de datos.
            </p>
          </div>

          <label className="field-label" htmlFor="sign-name">
            Nombre de la seña
          </label>

          <input
            id="sign-name"
            className="sign-input"
            type="text"
            value={etiqueta}
            onChange={(event) =>
              setEtiqueta(event.target.value)
            }
            placeholder="Ejemplo: saludo"
            disabled={grabando}
          />

<div className="metadata-form">
            <h4>Datos de la muestra</h4>
            <p className="helper-text">
              Estos datos ayudan a organizar las señas y estudiar su diversidad.
              Usa un código anónimo; no escribas nombres ni datos personales.
            </p>

            <label className="field-label" htmlFor="sample-category">
              Categoría lingüística
            </label>
            <select
              id="sample-category"
              className="sign-input"
              value={categoriaMuestra}
              onChange={(event) =>
                setCategoriaMuestra(event.target.value as CategoriaLSC)
              }
              disabled={grabando}
            >
              <option value="saludos">Saludos</option>
              <option value="cortesia">Cortesía</option>
              <option value="respuestas">Respuestas</option>
              <option value="comunicacion">Comunicación</option>
              <option value="necesidades">Necesidades</option>
              <option value="otra">Otra</option>
            </select>

            <label className="field-label" htmlFor="participant-code">
              Código anónimo del participante
            </label>
            <input
              id="participant-code"
              className="sign-input"
              type="text"
              value={codigoParticipante}
              onChange={(event) =>
                setCodigoParticipante(event.target.value)
              }
              placeholder="Ejemplo: PARTICIPANTE-01"
              disabled={grabando}
              maxLength={40}
            />

            <label className="field-label" htmlFor="sample-hand">
              Mano utilizada
            </label>
            <select
              id="sample-hand"
              className="sign-input"
              value={manoUtilizada}
              onChange={(event) =>
                setManoUtilizada(event.target.value as ManoUtilizada)
              }
              disabled={grabando}
            >
              <option value="no-especificada">No especificada</option>
              <option value="izquierda">Izquierda</option>
              <option value="derecha">Derecha</option>
              <option value="ambas">Ambas manos</option>
            </select>
          </div>

          <div className="recording-instructions">
            <strong>Instrucciones:</strong>
            <ol>
              <li>Escribe una etiqueta para la seña.</li>
              <li>Coloca tus manos frente a la cámara.</li>
              <li>Pulsa «Grabar muestra».</li>
              <li>Realiza la seña durante tres segundos.</li>
              <li>Repite para recopilar más ejemplos.</li>
            </ol>
          </div>

          <HandCamera onDetection={procesarManos} />

          <div className="recording-status">
            <span
              className={
                grabando
                  ? "recording-indicator recording"
                  : "recording-indicator"
              }
            />

            <p>{estado}</p>
          </div>

          {!grabando ? (
            <button
              className="primary record-button"
              onClick={iniciarGrabacion}
            >
              ● Grabar muestra (3 segundos)
            </button>
          ) : (
            <button
              className="primary stop-button"
              onClick={finalizarGrabacion}
            >
              Detener y guardar muestra
            </button>
          )}

          <div className="dataset-summary">
            <div>
              <p className="helper-text">
                {datosCargados
                  ? "✓ Datos cargados. Las muestras nuevas se guardan automáticamente."
                  : "Cargando muestras guardadas..."}
              </p>

              <span className="result-label">
                MUESTRAS RECOPILADAS
              </span>

              <p className="dataset-number">
                {muestras.length}
              </p>
            </div>

            <div>
              <span className="result-label">
                SEÑAS DIFERENTES
              </span>

              <p className="dataset-number">
                {
                  new Set(
                    muestras.map((sample) => sample.label)
                  ).size
                }
              </p>
            </div>
          </div>

          <div className="import-section">
            <h3>Importar datos anteriores</h3>

            <p className="helper-text">
              Selecciona un archivo JSON de LSC Conecta
              para recuperar muestras guardadas.
            </p>

            <label className="import-button">
              📂 Seleccionar archivo JSON

              <input
                type="file"
                accept=".json,application/json"
                onChange={importarDatos}
                disabled={grabando || !datosCargados}
              />
            </label>
          </div>
        
          <section className="dataset-panel">
  <h3>Preparación de datos para el traductor</h3>

  <div className="dataset-verifier">
  <h4>Verificar un archivo JSON</h4>

  <p className="helper-text">
    Selecciona un archivo exportado de LSC Conecta
    para revisar su estructura e integridad técnica.
  </p>

  <input
    type="file"
    accept=".json,application/json"
    className="sign-input"
    onChange={(event) => {
      const archivo = event.target.files?.[0];

      if (archivo) {
        void verificarArchivoSeleccionado(archivo);
      }
    }}
  />

  {resultadoVerificacion && (
    <div className="verification-results">
      <h4>Informe de verificación</h4>

      <p>
        <strong>Archivo:</strong>{" "}
        {nombreArchivoVerificado}
      </p>

      <p>
        <strong>Resultado:</strong>{" "}
        {resultadoVerificacion.valido
          ? "Verificación técnica superada"
          : "Se encontraron errores"}
      </p>

      <p>
        <strong>Muestras:</strong>{" "}
        {resultadoVerificacion.totalMuestras}
      </p>

      <p>
        <strong>Etiquetas distintas:</strong>{" "}
        {resultadoVerificacion.totalEtiquetas}
      </p>

      {resultadoVerificacion.errores.length > 0 && (
        <div>
          <h4>Errores</h4>
          <ul>
            {resultadoVerificacion.errores.map(
              (error, indice) => (
                <li key={`${indice}-${error}`}>
                  {error}
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {resultadoVerificacion.advertencias.length > 0 && (
        <div>
          <h4>Advertencias</h4>
          <ul>
            {resultadoVerificacion.advertencias.map(
              (advertencia, indice) => (
                <li key={`${indice}-${advertencia}`}>
                  {advertencia}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  )}
</div>


<div className="dataset-comparison">
  <h3>Comparar entrenamiento y validación</h3>

  <p className="helper-text">
    Selecciona los dos archivos JSON exportados por LSC Conecta.
    El sistema comprobará su integridad y buscará posibles
    coincidencias entre las muestras.
  </p>

  <div className="comparison-file">
    <label className="field-label" htmlFor="archivo-entrenamiento">
      Archivo de entrenamiento
    </label>

    <input
      id="archivo-entrenamiento"
      className="sign-input"
      type="file"
      accept=".json,application/json"
      onChange={(event) => {
        const archivo = event.target.files?.[0];

        if (archivo) {
          void leerArchivoParaComparacion(
            archivo,
            "entrenamiento"
          );
        }

        event.target.value = "";
      }}
    />

    <p className="helper-text">
      {nombreArchivoEntrenamiento ||
        "Todavía no has seleccionado el archivo de entrenamiento."}
    </p>
  </div>

  <div className="comparison-file">
    <label className="field-label" htmlFor="archivo-validacion">
      Archivo de validación
    </label>

    <input
      id="archivo-validacion"
      className="sign-input"
      type="file"
      accept=".json,application/json"
      onChange={(event) => {
        const archivo = event.target.files?.[0];

        if (archivo) {
          void leerArchivoParaComparacion(
            archivo,
            "validacion"
          );
        }

        event.target.value = "";
      }}
    />

    <p className="helper-text">
      {nombreArchivoValidacion ||
        "Todavía no has seleccionado el archivo de validación."}
    </p>
  </div>

  <button
    type="button"
    className="primary"
    onClick={ejecutarComparacionLSC}
    disabled={
      datosEntrenamientoComparacion === null ||
      datosValidacionComparacion === null
    }
  >
    Comparar conjuntos
  </button>

  {resultadoComparacion && (
    <div className="comparison-results">
      <h4>Informe de comparación</h4>

      <p>
        <strong>Entrenamiento:</strong>{" "}
        {nombreArchivoEntrenamiento}
      </p>

      <p>
        <strong>Validación:</strong>{" "}
        {nombreArchivoValidacion}
      </p>

      <p>
        <strong>Resultado:</strong>{" "}
        {resultadoComparacion.valido
          ? "No se detectaron errores en esta comparación."
          : "Se encontraron problemas que debes revisar."}
      </p>

      <div className="dataset-summary">
        <div className="dataset-card">
          <strong>Muestras de entrenamiento</strong>
          <span>{resultadoComparacion.totalEntrenamiento}</span>
        </div>

        <div className="dataset-card">
          <strong>Muestras de validación</strong>
          <span>{resultadoComparacion.totalValidacion}</span>
        </div>

        <div className="dataset-card">
          <strong>Identificadores compartidos</strong>
          <span>{resultadoComparacion.idsCompartidos.length}</span>
        </div>

        <div className="dataset-card">
  <strong>Participantes compartidos</strong>
  <span>
    {resultadoComparacion.participantesCompartidos.length}
  </span>
  <small>No deben repetirse</small>
</div>

        <div className="dataset-card">
          <strong>Muestras duplicadas</strong>
          <span>{resultadoComparacion.muestrasDuplicadas.length}</span>
        </div>
      </div>

      <h4>Etiquetas de entrenamiento</h4>

      {resultadoComparacion.etiquetasEntrenamiento.length === 0 ? (
        <p className="helper-text">No se encontraron etiquetas.</p>
      ) : (
        <ul>
          {resultadoComparacion.etiquetasEntrenamiento.map(
            (etiqueta) => (
              <li key={etiqueta}>{etiqueta}</li>
            )
          )}
        </ul>
      )}

      <h4>Etiquetas de validación</h4>

      {resultadoComparacion.etiquetasValidacion.length === 0 ? (
        <p className="helper-text">No se encontraron etiquetas.</p>
      ) : (
        <ul>
          {resultadoComparacion.etiquetasValidacion.map(
            (etiqueta) => (
              <li key={etiqueta}>{etiqueta}</li>
            )
          )}
        </ul>
      )}

      {resultadoComparacion.errores.length > 0 && (
        <>
          <h4>Problemas encontrados</h4>
          <ul>
            {resultadoComparacion.errores.map(
              (error, indice) => (
                <li key={`${indice}-${error}`}>{error}</li>
              )
            )}
          </ul>
        </>
      )}

      {resultadoComparacion.advertencias.length > 0 && (
        <>
          <h4>Advertencias</h4>
          <ul>
            {resultadoComparacion.advertencias.map(
              (advertencia, indice) => (
                <li key={`${indice}-${advertencia}`}>
                  {advertencia}
                </li>
              )
            )}
          </ul>
        </>
      )}

      <p className="helper-text">
        Esta comprobación detecta coincidencias técnicas, pero no
        garantiza que las señas estén lingüísticamente correctas
        ni que las grabaciones pertenezcan a personas diferentes.
      </p>
    </div>
  )}
</div>

  <p className="helper-text">
    Resumen de las muestras clasificadas para preparar
    el futuro entrenamiento del modelo LSC.
  </p>

  <div className="dataset-summary">
    <div className="dataset-card">
      <strong>Entrenamiento</strong>
      <span>{conjuntosDatos.entrenamiento.length}</span>
      <small>Muestras aprobadas</small>
    </div>

    <div className="dataset-card">
  <strong>Sin participante</strong>
  <span>{conjuntosDatos.sinParticipante.length}</span>
  <small>No aptas para separación</small>
</div>

<div className="dataset-card">
  <strong>Participantes de validación</strong>
  <span>{conjuntosDatos.participantesValidacion.length}</span>
  <small>Códigos independientes</small>
</div>

    <div className="dataset-card">
      <strong>Validación</strong>
      <span>{conjuntosDatos.validacion.length}</span>
      <small>Muestras reservadas</small>
    </div>

    <div className="dataset-card">
      <strong>Pendientes</strong>
      <span>{conjuntosDatos.pendientes.length}</span>
      <small>Por revisar</small>
    </div>

    <div className="dataset-card">
      <strong>Excluidas</strong>
      <span>{conjuntosDatos.excluidas.length}</span>
      <small>Descartadas</small>
    </div>
  </div>

  {conjuntosDatos.etiquetasSinSeparacion.length > 0 && (
  <div className="verification-results">
    <h4>Etiquetas sin separación independiente</h4>

    <p className="helper-text">
      Estas señas no tienen suficientes participantes
      para crear una evaluación independiente.
      Sus muestras permanecen fuera de validación.
    </p>

    <ul>
      {conjuntosDatos.etiquetasSinSeparacion.map(
        (etiqueta) => (
          <li key={etiqueta}>{etiqueta}</li>
        )
      )}
    </ul>
  </div>
)}

{conjuntosDatos.sinParticipante.length > 0 && (
  <p className="helper-text">
    Hay {conjuntosDatos.sinParticipante.length} muestras
    aprobadas sin código de participante. No se incluyen
    en los conjuntos hasta completar ese metadato.
  </p>
)}
  <div className="dataset-labels">
    <h4>Señas incluidas en entrenamiento</h4>

    {etiquetasPreparadas.length === 0 ? (
      <p className="helper-text">
        Todavía no hay muestras revisadas disponibles.
      </p>
    ) : (
      <ul>
        {etiquetasPreparadas.map((etiqueta) => (
          <li key={etiqueta}>{etiqueta}</li>
        ))}
      </ul>
    )}
  </div>
  <div className="dataset-downloads">
  <h4>Descargar conjuntos de datos</h4>

  <button
    type="button"
    onClick={() =>
      descargarConjuntoLSC("entrenamiento")
    }
    disabled={conjuntosDatos.entrenamiento.length === 0}
  >
    Descargar entrenamiento JSON
  </button>

  <button
    type="button"
    onClick={() =>
      descargarConjuntoLSC("validacion")
    }
    disabled={conjuntosDatos.validacion.length === 0}
  >
    Descargar validación JSON
  </button>

  <button
    type="button"
    onClick={() =>
      descargarConjuntoLSC("excluidas")
    }
    disabled={conjuntosDatos.excluidas.length === 0}
  >
    Descargar muestras excluidas JSON
  </button>
</div>
  <p className="helper-text">
    La separación es organizativa. Todavía no se ha
    entrenado ningún modelo de inteligencia artificial.
  </p>
</section>
          <div className="sample-list">
  <h3>Mis muestras</h3>

  <label htmlFor="filtro-muestras" className="field-label">
    Filtrar por estado de revisión
  </label>

  <select
    id="filtro-muestras"
    className="sign-input"
    value={filtroMuestras}
    onChange={(event) =>
      setFiltroMuestras(
        event.target.value as
          | "todas"
          | "pendiente"
          | "revisada"
          | "descartada"
      )
    }
  >
    <option value="todas">Todas las muestras</option>
    <option value="pendiente">Pendientes</option>
    <option value="revisada">Revisadas</option>
    <option value="descartada">Descartadas</option>
  </select>

  {muestras.length === 0 ? (
  <p className="helper-text">
    Aún no has guardado muestras.
  </p>
) : muestrasFiltradas.length === 0 ? (
  <p className="helper-text">
    No hay muestras en esta categoría.
  </p>
) : (
  muestrasFiltradas.map((sample, index) => (
                <div className="sample-item" key={sample.id}>
                  <div className="sample-information">
                    <strong>
                      {index + 1}. {sample.label}
                    </strong>
              
                    <p>
                      {sample.frameCount ?? sample.frames.length} fotogramas
                    </p>
              
                    <p>
                      Duración:{" "}
                      {typeof sample.durationMs === "number"
                        ? `${(sample.durationMs / 1000).toFixed(2)} segundos`
                        : "Sin datos"}
                    </p>
              
                    <p>
                      Frecuencia:{" "}
                      {typeof sample.approxFps === "number"
                        ? `${sample.approxFps} FPS`
                        : "Sin datos"}
                    </p>
              
                    <p>
                      Estado de revisión:{" "}
                      {sample.reviewStatus ?? "pendiente"}
                    </p>
                    {(() => {
  const frames = Array.isArray(sample.frames)
    ? sample.frames
    : [];

  const errorCalidad = validarCalidadFrames(frames);
  const calidadValida = errorCalidad === null;

  const framesConManos = frames.filter(
    (frame) =>
      Array.isArray(frame.hands) &&
      frame.hands.length > 0
  ).length;

  const totalManosDetectadas = frames.reduce(
    (total, frame) =>
      total +
      (Array.isArray(frame.hands)
        ? frame.hands.length
        : 0),
    0
  );

  const cobertura = frames.length > 0
    ? Math.round((framesConManos / frames.length) * 100)
    : 0;

  return (
    <div
      className={`sample-quality-panel ${
        calidadValida ? "quality-valid" : "quality-error"
      }`}
    >
      <h4>Informe de calidad técnica</h4>

      <p className="sample-quality-status">
        {calidadValida
          ? "✓ Estructura técnica correcta"
          : "⚠ Requiere revisión técnica"}
      </p>

      <div className="sample-quality-grid">
        <div className="sample-quality-metric">
          <strong>{frames.length}</strong>
          <span>Fotogramas</span>
        </div>

        <div className="sample-quality-metric">
          <strong>{framesConManos}</strong>
          <span>Fotogramas con manos</span>
        </div>

        <div className="sample-quality-metric">
          <strong>{totalManosDetectadas}</strong>
          <span>Detecciones de manos</span>
        </div>

        <div className="sample-quality-metric">
          <strong>{cobertura}%</strong>
          <span>Cobertura de detección</span>
        </div>
      </div>

      <div className="sample-quality-progress">
        <div
          className="sample-quality-progress-fill"
          style={{ width: `${cobertura}%` }}
        />
      </div>

      {errorCalidad && (
        <p className="sample-quality-error">
          {errorCalidad}
        </p>
      )}

      <p className="sample-quality-note">
        Este informe evalúa la estructura de los datos.
        No sustituye la validación lingüística de la seña.
      </p>
    </div>
  );
})()}
                    <label
  className="field-label"
  htmlFor={`revision-${sample.id}`}
>
  Clasificación de la muestra
</label>

<select
  id={`revision-${sample.id}`}
  className="sign-input"
  value={sample.reviewStatus ?? "pendiente"}
  onChange={(event) =>
    actualizarEstadoRevision(
      sample.id,
      event.target.value as
        | "pendiente"
        | "revisada"
        | "descartada"
    )
  }
  disabled={grabando}
>
  <option value="pendiente">Pendiente de revisión</option>
  <option value="revisada">Revisada</option>
  <option value="descartada">Descartada</option>
</select>

<div className="linguistic-review">
                      <h4>Validación lingüística</h4>

                      <p className="helper-text">
                        Esta revisión debe comprobar que la seña corresponde
                        al significado y uso lingüístico indicado.
                      </p>

                      <label
                        className="field-label"
                        htmlFor={`validacion-${sample.id}`}
                      >
                        Estado lingüístico
                      </label>

                      <select
                        id={`validacion-${sample.id}`}
                        className="sign-input"
                        value={sample.validacionLinguistica ?? "pendiente"}
                        onChange={(event) =>
                          actualizarValidacionLinguistica(
                            sample.id,
                            event.target.value as
                              | "pendiente"
                              | "validada"
                              | "requiere-correccion"
                          )
                        }
                        disabled={grabando}
                      >
                        <option value="pendiente">
                          Pendiente de validación
                        </option>
                        <option value="validada">
                          Validada lingüísticamente
                        </option>
                        <option value="requiere-correccion">
                          Requiere corrección
                        </option>
                      </select>

                      <label
                        className="field-label"
                        htmlFor={`fuente-${sample.id}`}
                      >
                        Fuente de validación
                      </label>

                      <input
                        id={`fuente-${sample.id}`}
                        className="sign-input"
                        type="text"
                        value={sample.fuenteValidacion ?? ""}
                        onChange={(event) =>
                          actualizarFuenteValidacion(
                            sample.id,
                            event.target.value
                          )
                        }
                        placeholder="Ej.: experto LSC, institución o fuente"
                        disabled={grabando}
                        maxLength={200}
                      />
                    </div>

                  </div>
              
                  <button
                    className="delete-sample"
                    onClick={() =>
                      eliminarMuestra(sample.id)
                    }
                    disabled={grabando}
                    aria-label={`Eliminar muestra ${sample.label}`}
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            className="primary download-button"
            onClick={descargarDatos}
            disabled={muestras.length === 0 || grabando}
          >
            Descargar conjunto de datos
          </button>

          <button
            className="secondary-button"
            onClick={limpiarMuestras}
            disabled={muestras.length === 0 || grabando}
          >
            Limpiar muestras
          </button>

          <p className="helper-text">
            Las muestras se guardan en el almacenamiento local
            del navegador. Descarga una copia JSON como respaldo.
          </p>
        </section>
      )}

      {modo === "aprender" && (
        <section className="panel learning-module">
          <LSCCatalog
  consultaVoz={consultaVoz}
/>
          <div className="panel-heading">
            <h3>Mis primeras señas</h3>
            <span className="tag">Nivel 1</span>
          </div>

          <p className="helper-text">
            Practica posturas básicas de la mano y aprende
            a utilizar el sistema de detección.
          </p>

          <div className="learning-progress">
            <div className="progress-label">
              <strong>Tu progreso</strong>
              <span>
                {ejerciciosCompletados.length} de{" "}
                {ejercicios.length} ejercicios
              </span>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={ejerciciosCompletados.length}
              aria-valuemin={0}
              aria-valuemax={ejercicios.length}
              aria-label="Progreso de aprendizaje"
            >
              <div
                className="progress-fill"
                style={{
                  width: `${
                    (ejerciciosCompletados.length /
                      ejercicios.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>

          {ejerciciosCompletados.length ===
          ejercicios.length ? (
            <div className="learning-complete">
              <div className="completion-icon">🏆</div>
              <h3>¡Felicitaciones!</h3>
              <p>
                Has completado los tres ejercicios de este
                primer nivel.
              </p>

              <button
                className="primary"
                onClick={reiniciarAprendizaje}
              >
                Volver a practicar
              </button>
            </div>
          ) : (
            <>
              <div className="exercise-card">
                <span className="exercise-number">
                  EJERCICIO {ejercicioActual + 1} DE{" "}
                  {ejercicios.length}
                </span>

                <div className="exercise-emoji">
                  {ejercicio.emoji}
                </div>

                <h2>{ejercicio.nombre}</h2>

                <p>{ejercicio.instruccion}</p>
              </div>

              <HandCamera onDetection={procesarManos} />

              <div
                className={
                  acierto
                    ? "learning-feedback success"
                    : "learning-feedback"
                }
                aria-live="polite"
              >
                <strong>
                  {acierto
                    ? "✓ ¡Gesto reconocido!"
                    : "Práctica en curso"}
                </strong>

                <p>{mensajeAprendizaje}</p>

                <span>
                  Detección actual: {gestoDetectado}
                </span>
              </div>

              {acierto && (
                <div className="exercise-actions">
                  {ejercicioActual <
                  ejercicios.length - 1 ? (
                    <button
                      className="primary"
                      onClick={siguienteEjercicio}
                    >
                      Siguiente ejercicio →
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={reiniciarAprendizaje}
                    >
                      Finalizar y repetir
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <div className="learning-note">
            <strong>Nota de aprendizaje</strong>
            <p>
              Esta versión reconoce posturas sencillas de la
              mano para practicar el uso de la cámara. No es
              todavía un traductor de Lengua de Señas Colombiana.
            </p>
          </div>
          <div className="lsc-avatar-section">
  <LSCAvatar />
</div>
        </section>
      )}
{modo === "entender-senas" && (
  <SignInterpreter />
)}
{modo === "voz" && (
  <section className="panel">
    <VoiceRecognition
      onTextoReconocido={procesarTextoVoz}
    />

    <div className="voice-search-results">
      <h3>Resultados en la biblioteca LSC</h3>

      {!consultaVoz.trim() ? (
        <p>Habla para buscar señas en el catálogo.</p>
      ) : resultadosVoz.length === 0 ? (
        <p>No se encontraron coincidencias en la biblioteca.</p>
      ) : (
        <ul>
          {resultadosVoz.map(({ sena, tieneRecursoVisual, pendienteDeValidacion }) => (
            <li key={sena.id}>
              <strong>{sena.concepto}</strong>

              <p>{sena.descripcion}</p>

              <p>
                {tieneRecursoVisual
                  ? "Tiene un recurso visual registrado."
                  : "Todavía no tiene un recurso visual registrado."}
              </p>

              {pendienteDeValidacion && (
                <small>
                  Seña pendiente de validación lingüística.
                </small>
              )}
            </li>
          ))}
        </ul>
      )}

<LSCVisualSequence
  segmentos={planFrase?.segmentos ?? []}
/>

<LSCContextAnalysis
  frase={consultaVoz}
/>

<section className="lsc-voice-avatar-section">
  
  <h3>Avatar de señas LSC</h3>

  <p>
    El avatar se está preparando para representar visualmente
    los conceptos reconocidos. Los movimientos LSC aún requieren
    animaciones validadas.
  </p>

  <div className="lsc-voice-avatar-container">
  <LSCAvatar
    segmentos={planFrase?.segmentos ?? []}
  />
</div>
</section>
    <section className="phrase-plan-results">
  <h3>Secuencia de conceptos</h3>

  {!planFrase || planFrase.segmentos.length === 0 ? (
    <p>Habla para analizar una frase.</p>
  ) : (
    <>
      <p>
        Conceptos encontrados: {planFrase.conceptosEncontrados}
      </p>
      <div className="phrase-coverage">
  <h4>Análisis de cobertura del mensaje</h4>

  <p>
    Palabras reconocidas: {planFrase.palabrasReconocidas}
    {" de "}
    {planFrase.totalPalabras}
  </p>

  <p>
    Cobertura del catálogo: {planFrase.porcentajeCobertura}%
  </p>

  <progress
    value={planFrase.porcentajeCobertura}
    max={100}
  />

  <p>
    {planFrase.estadoCobertura === "completa"
      ? "Todas las palabras tienen coincidencias en el catálogo."
      : planFrase.estadoCobertura === "parcial"
        ? "El mensaje contiene palabras sin coincidencia. La interpretación está incompleta."
        : planFrase.estadoCobertura === "sin-coincidencias"
          ? "No hay coincidencias en el catálogo."
          : "No hay palabras para analizar."}
  </p>

  <small>
    Este porcentaje mide coincidencias de palabras, no
    exactitud lingüística ni calidad de una traducción LSC.
  </small>
</div>
      <ol>
        {planFrase.segmentos.map((segmento, indice) => (
          <li key={`${segmento.texto}-${indice}`}>
            <strong>{segmento.texto}</strong>

            {segmento.sena ? (
              <>
                <p>Concepto: {segmento.sena.concepto}</p>
                <p>
                  {segmento.sena.video || segmento.sena.imagen ||
                  segmento.sena.animacion
                    ? "Recurso visual registrado."
                    : "Pendiente de incorporar un recurso visual."}
                </p>
              </>
            ) : (
              <p>Sin coincidencia exacta en el catálogo.</p>
            )}
          </li>
        ))}
      </ol>
    </>
  )}
  <div className="resource-review-container">
  <h3>Biblioteca de recursos LSC</h3>
  <LSCResourceInventory />
</div>
</section>
</div>
  </section>
)}

{modo === "revision-recursos" && (
  <section className="panel">
    <LSCResourceReview />
  </section>
)}

{modo === "comunicar" && (
  <CommunicationView />
)}
      <footer>
        <p>LSC Conecta · Proyecto de accesibilidad</p>
        <p>Desarrollado para Colombia 🇨🇴</p>
      </footer>
    </main>
  );
}

export default App;
