
import { useCallback, useRef, useState } from "react";
import HandCamera from "./HandCamera";
import { bibliotecaLSC } from "../data/lscLibrary";
import {
  agregarRegistroGesto,
  crearRegistroGesto,
  formatearFechaGesto,
  type RegistroGestoLSC,
} from "../data/lscGestureHistory";
import {
  agregarMuestra,
  crearSecuencia,
  guardarSecuencia,
  cargarSecuencias,
  persistirSecuencias,
  borrarSecuenciasGuardadas,
  type MuestraGesto,
  type SecuenciaDetectada,
} from "../data/lscSequenceEngine";
import {
  extraerCaracteristicasMano,
  calcularCambioMovimiento,
  agregarFotogramaMovimiento,
  calcularDesplazamientoMuneca,
  resumirMovimiento,
  type FotogramaMovimientoLSC,
} from "../data/lscMotionFeatures";

type Landmark = {
  x: number;
  y: number;
  z: number;
};

type Gesto = {
  nombre: string;
  descripcion: string;
};

type FotogramaSegmentoLSC = {
  tiempoMs: number;
  cambioPostura: number;
  desplazamientoMuneca: number;
  caracteristicas: number[];
};

type SegmentoMovimientoLSC = {
  id: string;
  inicio: number;
  fin: number;
  fotogramas: number;
  movimientoMaximo: number;
  trayectoria: FotogramaSegmentoLSC[];
  estado: "experimental";
};

const UMBRAL_INICIO_MOVIMIENTO = 0.018;
const UMBRAL_FIN_MOVIMIENTO = 0.008;
const FOTOGRAMAS_QUIETUD_PARA_CERRAR = 3;
const MAX_SEGMENTOS_MOVIMIENTO = 10;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clasificarGesto(mano: Landmark[]): Gesto {
  if (mano.length < 21) {
    return {
      nombre: "Analizando",
      descripcion: "No hay suficientes puntos de referencia.",
    };
  }

  const puntas = [8, 12, 16, 20];
  const articulaciones = [6, 10, 14, 18];

  const dedosArriba = puntas.map(
    (punta, indice) =>
      mano[punta].y < mano[articulaciones[indice]].y
  );

  const cantidadArriba = dedosArriba.filter(Boolean).length;

  if (cantidadArriba === 4) {
    return {
      nombre: "Mano abierta",
      descripcion: "Se observan cuatro dedos extendidos.",
    };
  }

  if (cantidadArriba === 0) {
    return {
      nombre: "Puño",
      descripcion: "No se observan los cuatro dedos extendidos.",
    };
  }

  if (
    dedosArriba[0] &&
    !dedosArriba[1] &&
    !dedosArriba[2] &&
    !dedosArriba[3]
  ) {
    return {
      nombre: "Índice extendido",
      descripcion: "El índice parece extendido.",
    };
  }

  return {
    nombre: "Gesto no identificado",
    descripcion: "La posición no coincide con los gestos básicos.",
  };
}

function buscarCoincidencias(gesto: string) {
  const terminos: Record<string, string[]> = {
    "Mano abierta": ["mano abierta", "abierta", "mano"],
    Puño: ["puño", "punio", "cerrada"],
    "Índice extendido": ["indice", "índice", "dedo"],
  };

  const palabras = terminos[gesto] ?? [];

  if (palabras.length === 0) {
    return [];
  }

  return bibliotecaLSC
    .map((sena) => {
      const texto = normalizar(
        [
          sena.concepto,
          sena.categoria,
          ...sena.palabrasRelacionadas,
        ].join(" ")
      );

      const coincidencias = palabras.filter((palabra) =>
        texto.includes(normalizar(palabra))
      ).length;

      return { sena, coincidencias };
    })
    .filter((item) => item.coincidencias > 0)
    .sort((a, b) => b.coincidencias - a.coincidencias)
    .slice(0, 3)
    .map((item) => item.sena);
}

export default function SignInterpreter() {
  const [camara, setCamara] = useState<
    "user" | "environment"
  >("environment");

  const [cantidadManos, setCantidadManos] = useState(0);
  const [resumenMovimiento, setResumenMovimiento] = useState({
    cantidadFotogramas: 0,
    duracionMs: 0,
    movimientoPromedio: 0,
    movimientoMaximo: 0,
    desplazamientoPromedio: 0,
    desplazamientoMaximo: 0,
  });

const fotogramasMovimientoRef =
  useRef<FotogramaMovimientoLSC[]>([]);
  const [segmentosMovimiento, setSegmentosMovimiento] =
  useState<SegmentoMovimientoLSC[]>([]);

  const segmentoActivoRef = useRef<{
    inicio: number;
    ultimoMovimiento: number;
    fotogramas: number;
    movimientoMaximo: number;
    fotogramasQuietud: number;
    trayectoria: FotogramaSegmentoLSC[];
  } | null>(null);

const caracteristicasAnterioresRef =
  useRef<number[] | null>(null);
  const posicionMunecaAnteriorRef =
  useRef<Landmark | null>(null);

const ultimoFotogramaRef = useRef(0);

const [secuencias, setSecuencias] =
useState<SecuenciaDetectada[]>(() => cargarSecuencias());

const muestrasRef = useRef<MuestraGesto[]>([]);

  const [historial, setHistorial] = useState<RegistroGestoLSC[]>([]);
const ultimoGestoGuardado = useRef("");
  const [resultado, setResultado] = useState<Gesto>({
    nombre: "Esperando las manos",
    descripcion: "Coloca una mano dentro de la imagen.",
  });

  const [coincidencias, setCoincidencias] = useState<
    typeof bibliotecaLSC
  >([]);

  const [estado, setEstado] = useState(
    "Esperando detección..."
  );

  const candidatoRef = useRef("");
  const repeticionesRef = useRef(0);

  const manejarDeteccion = useCallback(
    (manos: Landmark[][]) => {
      const manoPrincipal = manos[0];
      const ahora = Date.now();
      
      if (!manoPrincipal) {
        const segmentoActual = segmentoActivoRef.current;
      
        if (segmentoActual) {
          const segmentoCerrado: SegmentoMovimientoLSC = {
            id: `${segmentoActual.inicio}-${ahora}`,
            inicio: segmentoActual.inicio,
            fin: segmentoActual.ultimoMovimiento,
            fotogramas: segmentoActual.fotogramas,
            movimientoMaximo: segmentoActual.movimientoMaximo,
            trayectoria: segmentoActual.trayectoria,
            estado: "experimental",
          };

setSegmentosMovimiento((actuales) =>
[segmentoCerrado, ...actuales].slice(
  0,
  MAX_SEGMENTOS_MOVIMIENTO
)
);
      
          segmentoActivoRef.current = null;
        }
      
        caracteristicasAnterioresRef.current = null;
        posicionMunecaAnteriorRef.current = null;
        ultimoFotogramaRef.current = 0;
      }

      else if (ahora - ultimoFotogramaRef.current >= 120) {
        const caracteristicas =
          extraerCaracteristicasMano(manoPrincipal);
      
        if (caracteristicas) {
          const movimiento = calcularCambioMovimiento(
            caracteristicasAnterioresRef.current,
            caracteristicas
          );
          
          const desplazamiento = calcularDesplazamientoMuneca(
            posicionMunecaAnteriorRef.current,
            manoPrincipal[0]
          );
          
          const nuevosFotogramas = agregarFotogramaMovimiento(
            fotogramasMovimientoRef.current,
            caracteristicas,
            movimiento,
            ahora,
            desplazamiento
          );
          
          posicionMunecaAnteriorRef.current = {
            x: manoPrincipal[0].x,
            y: manoPrincipal[0].y,
            z: manoPrincipal[0].z,
          };
      
          fotogramasMovimientoRef.current = nuevosFotogramas;
          caracteristicasAnterioresRef.current = caracteristicas;
          ultimoFotogramaRef.current = ahora;
      
          setResumenMovimiento(
            resumirMovimiento(nuevosFotogramas)
          );
          
const actividad = Math.max(movimiento, desplazamiento);
const segmentoActual = segmentoActivoRef.current;

const crearFotogramaSegmento = (
  inicio: number
): FotogramaSegmentoLSC => ({
  tiempoMs: ahora - inicio,
  cambioPostura: movimiento,
  desplazamientoMuneca: desplazamiento,
  caracteristicas: [...caracteristicas],
});

if (actividad >= UMBRAL_INICIO_MOVIMIENTO) {
  if (!segmentoActual) {
    segmentoActivoRef.current = {
      inicio: ahora,
      ultimoMovimiento: ahora,
      fotogramas: 1,
      movimientoMaximo: actividad,
      fotogramasQuietud: 0,
      trayectoria: [crearFotogramaSegmento(ahora)],
    };
  } else {
    segmentoActual.ultimoMovimiento = ahora;
    segmentoActual.fotogramas += 1;
    segmentoActual.movimientoMaximo = Math.max(
      segmentoActual.movimientoMaximo,
      actividad
    );
    segmentoActual.fotogramasQuietud = 0;
    segmentoActual.trayectoria.push(
      crearFotogramaSegmento(segmentoActual.inicio)
    );
  }
} else if (segmentoActual) {
  segmentoActual.fotogramasQuietud += 1;
  segmentoActual.trayectoria.push(
    crearFotogramaSegmento(segmentoActual.inicio)
  );

  if (
    actividad < UMBRAL_FIN_MOVIMIENTO &&
    segmentoActual.fotogramasQuietud >=
      FOTOGRAMAS_QUIETUD_PARA_CERRAR
  ) {
    const segmentoCerrado: SegmentoMovimientoLSC = {
      id: `${segmentoActual.inicio}-${ahora}`,
      inicio: segmentoActual.inicio,
      fin: segmentoActual.ultimoMovimiento,
      fotogramas: segmentoActual.fotogramas,
      movimientoMaximo: segmentoActual.movimientoMaximo,
      trayectoria: segmentoActual.trayectoria,
      estado: "experimental",
    };

    setSegmentosMovimiento((actuales) =>
      [segmentoCerrado, ...actuales].slice(
        0,
        MAX_SEGMENTOS_MOVIMIENTO
      )
    );

    segmentoActivoRef.current = null;
  }
}

        }
      }
      
      setCantidadManos(manos.length);

      if (manos.length === 0) {
        candidatoRef.current = "";
        repeticionesRef.current = 0;
        setEstado("No se detectan manos.");
        return;
      }

      const gesto = clasificarGesto(manos[0]);

      if (gesto.nombre === candidatoRef.current) {
        repeticionesRef.current += 1;
      } else {
        candidatoRef.current = gesto.nombre;
        repeticionesRef.current = 1;
      }

      setEstado(
        manos.length > 1
          ? "Se detectaron varias manos; se analiza la primera."
          : "Mano detectada."
      );

      
if (repeticionesRef.current >= 4) {
  setResultado(gesto);
  setCoincidencias(buscarCoincidencias(gesto.nombre));

  if (ultimoGestoGuardado.current !== gesto.nombre) {
    ultimoGestoGuardado.current = gesto.nombre;

    const registro = crearRegistroGesto(gesto.nombre);

    setHistorial((actual) =>
      agregarRegistroGesto(actual, registro)
    );

    const muestrasActualizadas = agregarMuestra(
      muestrasRef.current,
      gesto.nombre
    );

    muestrasRef.current = muestrasActualizadas;

    const nuevaSecuencia = crearSecuencia(
      muestrasActualizadas
    );

    if (nuevaSecuencia) {
      setSecuencias((actual) => {
        const actualizadas = guardarSecuencia(
          actual,
          nuevaSecuencia
        );

        persistirSecuencias(actualizadas);
        return actualizadas;
      });
    }
  }
}
    },
    []
  );

  return (
    <section className="sign-interpreter">
      <h2>Entender señas</h2>

      <p>
        Coloca la mano frente a la cámara con buena iluminación.
      </p>

      <button
        type="button"
        onClick={() => {
          setCamara((actual) =>
            actual === "environment" ? "user" : "environment"
          );
          candidatoRef.current = "";
          repeticionesRef.current = 0;
          setEstado("Cambiando cámara...");
        }}
      >
        🔄 Cambiar a cámara{" "}
        {camara === "environment" ? "frontal" : "posterior"}
      </button>

      <HandCamera
        key={camara}
        facingMode={camara}
        onDetection={manejarDeteccion}
      />

      <div role="status" aria-live="polite">
        <p><strong>Manos detectadas:</strong> {cantidadManos}</p>
        <p><strong>Gesto estimado:</strong> {resultado.nombre}</p>
        <p>{resultado.descripcion}</p>
        <p>{estado}</p>
      </div>

      <section>
        <h3>Coincidencias en la biblioteca LSC</h3>

        {coincidencias.length > 0 ? (
          <ul>
            {coincidencias.map((sena) => (
              <li key={sena.id}>
                <strong>{sena.concepto}</strong>
                <p>{sena.descripcion}</p>
                <small>Estado: {sena.estado}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No hay coincidencias para este gesto en la biblioteca.
          </p>
        )}
      </section>

      <section>
  <h3>Historial de gestos detectados</h3>

  {historial.length === 0 ? (
    <p>Los gestos detectados aparecerán aquí.</p>
  ) : (
    <>
      <button
        type="button"
        onClick={() =>
          setHistorial([])
        }
      >
        Borrar historial
      </button>

      <ul>
        {historial.map((registro) => (
          <li key={registro.id}>
            <strong>{registro.gesto}</strong>
            <p>{formatearFechaGesto(registro.fecha)}</p>
            <small>Resultado experimental</small>
          </li>
        ))}
      </ul>
    </>
  )}
</section>

<section className="sign-sequence-history">
  <h3>Secuencias de gestos</h3>

  <p>
    Se registran cambios de postura detectados por la cámara.
    Los resultados todavía son experimentales.
  </p>

  {secuencias.length === 0 ? (
    <p>Aún no hay secuencias completas.</p>
  ) : (
    <>
      <button
        type="button"
        onClick={() => {
          borrarSecuenciasGuardadas();
          setSecuencias([]);
          muestrasRef.current = [];
        }}
      >
        Borrar secuencias guardadas
      </button>

      <ul>
        {secuencias.map((secuencia) => (
          <li key={secuencia.id}>
            <strong>
              {secuencia.pasos.join(" → ")}
            </strong>
            <p>
              {new Date(secuencia.fin).toLocaleString("es-CO")}
            </p>
            <small>Reconocimiento experimental</small>
          </li>
        ))}
      </ul>
    </>
  )}
</section>

<section className="sign-motion-analysis">
  <h3>Análisis del movimiento</h3>

  <p>
    Fotogramas analizados: {resumenMovimiento.cantidadFotogramas}
  </p>

  <p>
    Duración: {(resumenMovimiento.duracionMs / 1000).toFixed(1)} s
  </p>

  <p>
  Cambio promedio de postura:{" "}
  {resumenMovimiento.movimientoPromedio.toFixed(4)}
</p>

  <p>
    Movimiento máximo: {resumenMovimiento.movimientoMaximo.toFixed(4)}
  </p>
  <p>
  Desplazamiento promedio de la muñeca:{" "}
  {resumenMovimiento.desplazamientoPromedio.toFixed(4)}
</p>

<p>
  Desplazamiento máximo de la muñeca:{" "}
  {resumenMovimiento.desplazamientoMaximo.toFixed(4)}
</p>

  <small>
    Métricas experimentales; no representan una traducción confirmada.
  </small>

  <button
    type="button"
    onClick={() => {
      fotogramasMovimientoRef.current = [];
      caracteristicasAnterioresRef.current = null;
      ultimoFotogramaRef.current = 0;

      setResumenMovimiento({
        cantidadFotogramas: 0,
        duracionMs: 0,
        movimientoPromedio: 0,
        movimientoMaximo: 0,
        desplazamientoPromedio: 0,
        desplazamientoMaximo: 0,
      });
      
      posicionMunecaAnteriorRef.current = null;
    }}
  >
    Reiniciar análisis
  </button>
</section>
<section className="sign-motion-segments">
  <h3>Segmentos de movimiento detectados</h3>

  <p>
    Segmentos completos: {segmentosMovimiento.length}
  </p>

  {segmentosMovimiento.length === 0 ? (
    <p>
      Aún no hay segmentos completos. Mueve la mano y haz
      una pausa breve para probar la detección.
    </p>
  ) : (
    

<>
  <button
    type="button"
    onClick={() => {
      const segmentosValidos = segmentosMovimiento.every(
        (segmento) =>
          Array.isArray(segmento.trayectoria) &&
          segmento.trayectoria.every(
            (fotograma) =>
              Number.isFinite(fotograma.tiempoMs) &&
              Number.isFinite(fotograma.cambioPostura) &&
              Number.isFinite(fotograma.desplazamientoMuneca) &&
              Array.isArray(fotograma.caracteristicas) &&
              fotograma.caracteristicas.every(Number.isFinite)
          )
      );

      if (!segmentosValidos) {
        window.alert(
          "No se pudo exportar: hay segmentos con datos incompletos."
        );
        return;
      }

      const exportacion = {
        proyecto: "LSC Conecta",
        versionFormato: "1.0.0",
        fechaExportacion: new Date().toISOString(),
        tipoDatos: "segmentos_experimentales_de_movimiento",
        estadoValidacion: "no_validado_linguisticamente",
        descripcionMetricas: {
          tiempoMs: "Milisegundos desde el inicio del segmento.",
          cambioPostura: "Variación numérica de las características de la mano.",
          desplazamientoMuneca: "Desplazamiento normalizado de la muñeca entre fotogramas.",
          caracteristicas: "Vector numérico de características de la mano."
        },
        segmentos: segmentosMovimiento
      };

      const contenido = JSON.stringify(exportacion, null, 2);

      const archivo = new Blob(
        [contenido],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download =
        `lsc-conecta-trayectorias-${Date.now()}.json`;

      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}
  >
    Descargar trayectorias JSON
  </button>

  <button
    type="button"
    onClick={() => setSegmentosMovimiento([])}
  >
    Borrar segmentos
  </button>

      <ul>
        {segmentosMovimiento.map((segmento) => (
          <li key={segmento.id}>
            <strong>
              Segmento {new Date(segmento.inicio).toLocaleTimeString("es-CO")}
            </strong>

            <p>
              Duración:{" "}
              {(
                (segmento.fin - segmento.inicio) /
                1000
              ).toFixed(2)}{" "}
              s
            </p>

            <p>
              Fotogramas activos: {segmento.fotogramas}
            </p>
            <p>
  Fotogramas en la trayectoria: {segmento.trayectoria.length}
</p>
            <p>
              Actividad máxima:{" "}
              {segmento.movimientoMaximo.toFixed(4)}
            </p>

            <small>Registro experimental, no traducción validada.</small>
          </li>
        ))}
      </ul>
    </>
  )}
</section>

      <div className="sign-interpreter-notice">
        <strong>Resultado experimental</strong>
        <p>
          Las coincidencias se basan en palabras del catálogo,
          no en una traducción confirmada de la seña. La LSC
          completa requiere reconocer movimientos, orientación,
          expresiones faciales y contexto.
        </p>
      </div>
    </section>
  );
}
