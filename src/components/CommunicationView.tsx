
import { useEffect, useRef, useState } from "react";

import Peer, {
  type MediaConnection,
  type DataConnection,
} from "peerjs";

import VoiceRecognition from "../VoiceRecognition";
import LSCVisualSequence from "./LSCVisualSequence";
import LSCAvatar from "./LSCAvatar";

import {
  planificarFraseLSC,
  type PlanFraseLSC,
} from "../data/lscPhrasePlanner";

function crearDetectorActividadAudio(
  stream: MediaStream,
  alCambiar: (activo: boolean) => void
): () => void {
  const pistas = stream.getAudioTracks();

  if (!pistas.some((pista) => pista.readyState === "live")) {
    alCambiar(false);
    return () => {};
  }

  const contexto = new AudioContext();
  const fuente = contexto.createMediaStreamSource(
    new MediaStream(pistas)
  );
  const analizador = contexto.createAnalyser();

  analizador.fftSize = 1024;
  fuente.connect(analizador);

  const muestras = new Float32Array(analizador.fftSize);

  let detenido = false;
  let fotograma = 0;
  let activo = false;
  let positivos = 0;
  let silencios = 0;

  function revisarAudio() {
    if (detenido || contexto.state !== "running") return;

    analizador.getFloatTimeDomainData(muestras);

    let energia = 0;

    for (let i = 0; i < muestras.length; i++) {
      energia += muestras[i] * muestras[i];
    }

    const nivel = Math.sqrt(energia / muestras.length);

    if (nivel > 0.025) {
      positivos++;
      silencios = 0;
    } else {
      silencios++;
      positivos = 0;
    }

    if (!activo && positivos >= 3) {
      activo = true;
      alCambiar(true);
    }

    if (activo && silencios >= 8) {
      activo = false;
      alCambiar(false);
    }

    fotograma = requestAnimationFrame(revisarAudio);
  }

  contexto.resume()
    .then(() => {
      if (!detenido) revisarAudio();
    })
    .catch((error) => {
      console.error("No se pudo analizar el audio:", error);
      alCambiar(false);
    });

  return () => {
    detenido = true;
    cancelAnimationFrame(fotograma);
    fuente.disconnect();
    analizador.disconnect();
    void contexto.close();
    alCambiar(false);
  };
}

export default function CommunicationView() {

  const peerRef = useRef<Peer | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  const canalDatosRef = useRef<DataConnection | null>(null);

const textoVozRef = useRef("");

const [textoRemoto, setTextoRemoto] = useState("");

const [planRemoto, setPlanRemoto] =
  useState<PlanFraseLSC | null>(null);

const [indiceRemoto, setIndiceRemoto] = useState(0);

const [indiceLocal, setIndiceLocal] = useState(0);

const [estadoDatos, setEstadoDatos] =
  useState("Esperando conexión de datos...");

  const [miId, setMiId] = useState("");
  const [idDestino, setIdDestino] = useState("");
  const [estado, setEstado] = useState("Preparando conexión...");
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [microfonoActivo, setMicrofonoActivo] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] =
    useState<MediaConnection | null>(null);

    const [modoComunicacion, setModoComunicacion] =
    useState<"automatico" | "oral" | "lsc">("automatico");

    const [actividadAudioLocal, setActividadAudioLocal] =
    useState(false);

  const [actividadAudioRemota, setActividadAudioRemota] =
    useState(false);

    const [planFrase, setPlanFrase] =
    useState<PlanFraseLSC | null>(null);

    const [fuenteAvatar, setFuenteAvatar] =
  useState<"local" | "remota">("local");

    function conectarCanalDatos(canal: DataConnection) {
      canalDatosRef.current?.close();
    
      canalDatosRef.current = canal;
    
      canal.on("open", () => {
        setEstadoDatos("Canal de mensajes conectado");
    
        canal.send({
          tipo: "texto-voz",
          texto: textoVozRef.current,
        });
      });
    
      canal.on("data", (dato) => {
        if (!dato || typeof dato !== "object") return;
    
        const mensaje = dato as {
          tipo?: string;
          texto?: unknown;
          indice?: unknown;
        };
        
        if (
          mensaje.tipo === "texto-voz" &&
          typeof mensaje.texto === "string"
        ) {
          setTextoRemoto(mensaje.texto);
        
          setPlanRemoto(
            mensaje.texto.trim()
              ? planificarFraseLSC(mensaje.texto)
              : null
          );
        
          setIndiceRemoto(0);
        }
        
        if (
          mensaje.tipo === "posicion-secuencia" &&
          typeof mensaje.indice === "number" &&
          Number.isInteger(mensaje.indice) &&
          mensaje.indice >= 0
        ) {
          setIndiceRemoto(mensaje.indice);
        }
      });
    
      canal.on("close", () => {
        if (canalDatosRef.current === canal) {
          canalDatosRef.current = null;
          setEstadoDatos("Canal de mensajes desconectado");
          setTextoRemoto("");
setPlanRemoto(null);
setIndiceRemoto(0);
        }
      });
    
      canal.on("error", (error) => {
        console.error("Error en el canal de datos:", error);
        setEstadoDatos("Error al transmitir mensajes");
      });
    }
    
    function procesarTextoVoz(texto: string) {
      textoVozRef.current = texto;
    
      setPlanFrase(planificarFraseLSC(texto));
      setIndiceLocal(0);
    
      const canal = canalDatosRef.current;
    
      if (canal?.open) {
        canal.send({
          tipo: "texto-voz",
          texto,
        });
      }
    }

  const detenerDetectorLocalRef = useRef<(() => void) | null>(null);

  const detenerDetectorRemotoRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      setMiId(id);
      setEstado("Listo para conectar");
    });

    peer.on("call", (llamada) => {
      setLlamadaEntrante(llamada);
      setEstado("Tienes una llamada entrante");
    });

    peer.on("connection", (canal) => {
      conectarCanalDatos(canal);
    });

    peer.on("error", (error) => {
      console.error("Error de PeerJS:", error);
    
      const tipoError =
        "type" in error ? String(error.type) : "";
    
      switch (tipoError) {
        case "peer-unavailable":
          setEstado(
            "No encontramos a esa persona. Comprueba su identificador e inténtalo de nuevo."
          );
          break;
    
        case "network":
        case "server-error":
        case "socket-error":
        case "socket-closed":
          setEstado(
            "Problema de conexión. Comprueba Internet e inténtalo de nuevo."
          );
          break;
    
        case "unavailable-id":
          setEstado(
            "No se pudo crear el identificador. Intenta iniciar de nuevo."
          );
          break;
    
        default:
          setEstado(
            "Ocurrió un problema con la llamada. Inténtalo de nuevo."
          );
      }
    });    
    
peer.on("disconnected", () => {
  setEstado(
    "Conexión interrumpida. Intentando reconectar..."
  );

  if (!peer.destroyed) {
    try {
      peer.reconnect();
    } catch (error) {
      console.error(
        "No se pudo reconectar con PeerJS:",
        error
      );

      setEstado(
        "No se pudo reconectar. Comprueba tu conexión a Internet."
      );
    }
  }
});

    return () => {
      detenerDetectorLocalRef.current?.();
      detenerDetectorRemotoRef.current?.();
      callRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
      peer.destroy();
      peerRef.current = null;
    };
  }, []);

  async function activarCamara() {
    try {
      setEstado("Solicitando permiso para cámara y micrófono...");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

      localStreamRef.current = stream;

      detenerDetectorLocalRef.current?.();

      detenerDetectorLocalRef.current =
        crearDetectorActividadAudio(
          stream,
          setActividadAudioLocal
        );

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setCamaraActiva(true);
      setMicrofonoActivo(true);
      setEstado("Cámara y micrófono activos");
    } catch (error) {
      console.error(error);
      setEstado(
        "No se pudo acceder a la cámara o al micrófono. Revisa los permisos."
      );
    }
  }

  function conectarVideo(llamada: MediaConnection) {
    callRef.current = llamada;

    llamada.on("stream", (stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }

      detenerDetectorRemotoRef.current?.();

      detenerDetectorRemotoRef.current =
        crearDetectorActividadAudio(
          stream,
          setActividadAudioRemota
        );

      setConectado(true);
      setEstado("Conectado en tiempo real");
      setLlamadaEntrante(null);
    });

    llamada.on("close", () => {
      detenerDetectorRemotoRef.current?.();
      detenerDetectorRemotoRef.current = null;
      setActividadAudioRemota(false);
      setConectado(false);
      setEstado("La llamada ha finalizado");

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      canalDatosRef.current?.close();
      canalDatosRef.current = null;
      
      textoVozRef.current = "";
      setTextoRemoto("");
      setPlanRemoto(null);
      setIndiceRemoto(0);
      
      setEstadoDatos("Canal de mensajes desconectado");
      callRef.current = null;
    });

    llamada.on("error", (error) => {
      console.error(error);
      setEstado("Se produjo un error durante la llamada");
      setConectado(false);
    });
  }

  function llamar() {
    const peer = peerRef.current;
    const stream = localStreamRef.current;
    const destino = idDestino.trim();

    if (!peer || !stream) {
      setEstado("Primero activa la cámara y el micrófono");
      return;
    }

    if (!destino) {
      setEstado("Escribe el ID de la otra persona");
      return;
    }

    if (destino === miId) {
      setEstado("No puedes llamarte a ti mismo");
      return;
    }

    setEstado("Llamando...");

    const llamada = peer.call(destino, stream);

    if (!llamada) {
      setEstado("No se pudo iniciar la llamada");
      return;
    }

    conectarVideo(llamada);
    const canal = peer.connect(destino, {
      reliable: true,
    });
    
    conectarCanalDatos(canal);
  }

  function responder() {
    const stream = localStreamRef.current;

    if (!stream || !llamadaEntrante) {
      setEstado("Activa la cámara antes de responder");
      return;
    }

    llamadaEntrante.answer(stream);
    conectarVideo(llamadaEntrante);
    setLlamadaEntrante(null);
  }

  function silenciarMicrofono() {
    const stream = localStreamRef.current;

    if (!stream) return;

    const nuevoEstado = !microfonoActivo;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = nuevoEstado;
    });

    setMicrofonoActivo(nuevoEstado);
  }

  function finalizarLlamada() {
    callRef.current?.close();
    callRef.current = null;
    canalDatosRef.current?.close();
canalDatosRef.current = null;

textoVozRef.current = "";
setTextoRemoto("");
setPlanRemoto(null);
setIndiceRemoto(0);
setEstadoDatos("Canal de mensajes desconectado");

    llamadaEntrante?.close();
    setLlamadaEntrante(null);

    setConectado(false);
    setLlamadaEntrante(null);
    setEstado("Llamada finalizada");

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }

  function detenerCamara() {
    detenerDetectorLocalRef.current?.();
    detenerDetectorLocalRef.current = null;

    detenerDetectorRemotoRef.current?.();
    detenerDetectorRemotoRef.current = null;

    setActividadAudioLocal(false);
    setActividadAudioRemota(false);
    finalizarLlamada();

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setCamaraActiva(false);
    setMicrofonoActivo(true);
    setEstado("Cámara desactivada");
  }

  async function copiarId() {
    try {
      await navigator.clipboard.writeText(miId);
      setEstado("ID copiado. Ya puedes compartirlo.");
    } catch {
      setEstado("Selecciona y copia tu ID manualmente.");
    }
  }

  return (
    <section className="communication-view">
      <div className="communication-heading">
        <span className="eyebrow">COMUNICACIÓN EN TIEMPO REAL</span>
        <h2>Conectemos dos dispositivos</h2>
        <p>
          Comparte tu ID con otra persona para iniciar una
          videollamada.
        </p>
      </div>

      <section className="communication-mode-panel">
        <div className="communication-mode-heading">
          <h3>Modo de comunicación</h3>
          <p>
            Selecciona cómo deseas comunicarte durante la videollamada.
          </p>
        </div>

        <div className="communication-mode-options">
          <button
            type="button"
            className={
              modoComunicacion === "automatico"
                ? "communication-mode-option active"
                : "communication-mode-option"
            }
            aria-pressed={modoComunicacion === "automatico"}
            onClick={() => setModoComunicacion("automatico")}
          >
            <span>🔄</span>
            <strong>Automático</strong>
            <small>Preparado para detectar la actividad de comunicación.</small>
          </button>

          <button
            type="button"
            className={
              modoComunicacion === "oral"
                ? "communication-mode-option active"
                : "communication-mode-option"
            }
            aria-pressed={modoComunicacion === "oral"}
            onClick={() => setModoComunicacion("oral")}
          >
            <span>🎙️</span>
            <strong>Oral</strong>
            <small>Prioriza la conversación hablada.</small>
          </button>

          <button
            type="button"
            className={
              modoComunicacion === "lsc"
                ? "communication-mode-option active"
                : "communication-mode-option"
            }
            aria-pressed={modoComunicacion === "lsc"}
            onClick={() => setModoComunicacion("lsc")}
          >
            <span>🤟</span>
            <strong>LSC</strong>
            <small>Prioriza la comunicación mediante señas.</small>
          </button>
        </div>

        <div className="communication-mode-status" aria-live="polite">
          <strong>
            {modoComunicacion === "automatico"
              ? "Modo automático seleccionado"
              : modoComunicacion === "oral"
                ? "Modo oral seleccionado"
                : "Modo LSC seleccionado"}
          </strong>

          <p>
            {modoComunicacion === "automatico"
              ? "La detección automática todavía está en desarrollo. Por ahora, puedes cambiar manualmente al modo oral o LSC."
              : modoComunicacion === "oral"
                ? "La traducción de señas no se activará automáticamente en este modo."
                : "La detección de señas y su traducción todavía deben integrarse y validarse."}
          </p>
        </div>
      </section>

      <div className="connection-panel">
        <h3>Tu identificador de conexión</h3>

        <div className="my-id">
          <code>{miId || "Generando ID..."}</code>
          <button
            type="button"
            onClick={copiarId}
            disabled={!miId}
          >
            Copiar ID
          </button>
        </div>

        <label htmlFor="peer-destino">
          ID de la otra persona
        </label>

        <input
          id="peer-destino"
          value={idDestino}
          onChange={(event) => setIdDestino(event.target.value)}
          placeholder="Pega aquí el ID recibido"
          autoComplete="off"
        />

        <button
          type="button"
          className="primary-button"
          onClick={llamar}
          disabled={!camaraActiva || conectado}
        >
          Iniciar videollamada
        </button>

        {llamadaEntrante && (
          <div className="incoming-call">
            <p>¡Una persona te está llamando!</p>
            <button type="button" onClick={responder}>
              Responder llamada
            </button>
          </div>
        )}
      </div>

      <div className="communication-grid">
        <article className="communication-card">
          <h3>Mi cámara</h3>

          <div className="video-container">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
            />

            {!camaraActiva && (
              <div className="video-placeholder">
                <span>📷</span>
                <p>Tu cámara aparecerá aquí</p>
              </div>
            )}
          </div>
          <p className="video-caption">Tu dispositivo</p>
        </article>

        <article className="communication-card">
          <h3>La otra persona</h3>

          <div className="video-container">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
            />

            {!conectado && (
              <div className="video-placeholder">
                <span>👤</span>
                <p>Esperando conexión...</p>
              </div>
            )}
          </div>
          <p className="video-caption">
            {conectado ? "Conectado" : "Sin conexión"}
          </p>
        </article>
      </div>

      <div className="communication-status">
        <span className={conectado ? "status-dot online" : "status-dot"} />
        <span>{estado}</span>
      </div>

      <section className="audio-activity-panel">
        <h3>Actividad de audio en tiempo real</h3>

        <div className="audio-activity-participant">
          <span>Tu micrófono</span>
          <strong className={actividadAudioLocal ? "audio-active" : ""}>
            {actividadAudioLocal
              ? "🔊 Actividad detectada"
              : "Silencio o nivel bajo"}
          </strong>
        </div>

        <div className="audio-activity-participant">
          <span>La otra persona</span>
          <strong className={actividadAudioRemota ? "audio-active" : ""}>
            {actividadAudioRemota
              ? "🔊 Actividad detectada"
              : "Silencio o nivel bajo"}
          </strong>
        </div>

        <p>
          Este indicador analiza el nivel de sonido. No reconoce
          palabras ni determina por sí solo si existe una conversación.
        </p>
      </section>

      <div className="communication-controls">
        {!camaraActiva ? (
          <button
            type="button"
            className="primary-button"
            onClick={activarCamara}
          >
            Activar cámara y micrófono
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={silenciarMicrofono}
            >
              {microfonoActivo
                ? "🎙️ Silenciar micrófono"
                : "🔇 Activar micrófono"}
            </button>

            <button
              type="button"
              className="danger-button"
              onClick={finalizarLlamada}
            >
              Finalizar llamada
            </button>

            <button
              type="button"
              onClick={detenerCamara}
            >
              Apagar cámara
            </button>
          </>
        )}
      </div>

      <section className="communication-lsc-panel">
        <h3>Comunicación por voz y apoyo visual LSC</h3>

        <p>
          Habla para reconocer tus palabras y consultar los
          conceptos disponibles en la biblioteca LSC.
        </p>

        <VoiceRecognition
          onTextoReconocido={procesarTextoVoz}
        />

<div className="remote-voice-message">
  <h3>Mensaje recibido de la otra persona</h3>

  <p className="remote-voice-status">
    {estadoDatos}
  </p>

  <div className="remote-voice-text" aria-live="polite">
    {textoRemoto.trim()
      ? textoRemoto
      : "Aquí aparecerán las palabras reconocidas en el otro dispositivo."}
  </div>

  
{planRemoto && (
  <div className="remote-lsc-sequence">
    <h4>Secuencia visual recibida</h4>
    <LSCVisualSequence
      segmentos={planRemoto.segmentos}
      indiceSincronizado={indiceRemoto}
    />
  </div>
)}

</div>

<LSCVisualSequence
  segmentos={planFrase?.segmentos ?? []}
  indiceSincronizado={indiceLocal}
  onIndiceChange={(indice) => {
    setIndiceLocal(indice);
    const canal = canalDatosRef.current;

    if (canal?.open) {
      canal.send({
        tipo: "posicion-secuencia",
        indice,
      });
    }
  }}
/>

        
<div className="lsc-voice-avatar-container">
  <h3>Avatar de señas LSC</h3>

  <p>
    Selecciona qué conversación deseas consultar en el avatar.
  </p>

  <div className="lsc-avatar-source-controls">
    <button
      type="button"
      onClick={() => setFuenteAvatar("local")}
      aria-pressed={fuenteAvatar === "local"}
    >
      Mi voz
    </button>

    <button
      type="button"
      onClick={() => setFuenteAvatar("remota")}
      disabled={!planRemoto}
      aria-pressed={fuenteAvatar === "remota"}
    >
      Voz recibida
    </button>
  </div>

  <LSCAvatar
  segmentos={
    fuenteAvatar === "remota" && planRemoto
      ? planRemoto.segmentos
      : planFrase?.segmentos ?? []
  }
  indiceSeleccionado={
    fuenteAvatar === "remota" && planRemoto
      ? indiceRemoto
      : indiceLocal
  }
  seleccionDeshabilitada={fuenteAvatar === "remota"}
  onIndiceSeleccionadoChange={
    fuenteAvatar === "local"
      ? (indice) => {
          setIndiceLocal(indice);

          const canal = canalDatosRef.current;

          if (canal?.open) {
            canal.send({
              tipo: "posicion-secuencia",
              indice,
            });
          }
        }
      : undefined
  }
/>
</div>

        <p className="communication-note">
          Los resultados visuales dependen de las coincidencias
          disponibles en el catálogo. No representan todavía una
          traducción completa ni lingüísticamente validada de LSC.
        </p>
      </section>
    </section>
  );
}
