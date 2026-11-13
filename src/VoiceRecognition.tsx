import { useRef, useState } from "react";

type VoiceRecognitionProps = {
  onTextoReconocido?: (texto: string) => void;
};

export default function VoiceRecognition({
  onTextoReconocido,
}: VoiceRecognitionProps) {
  const [texto, setTexto] = useState("");
  const [resultadoParcial, setResultadoParcial] = useState("");
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState("");

  const reconocimientoRef = useRef<any>(null);
  const textoConfirmadoRef = useRef("");

  const limpiarEspacios = (texto: string) => {
    return texto.replace(/\s+/g, " ").trim();
  };

  const quitarDuplicaciones = (
    anterior: string,
    nuevo: string
  ) => {
    anterior = limpiarEspacios(anterior);
    nuevo = limpiarEspacios(nuevo);

    if (!anterior) {
      return nuevo;
    }

    if (!nuevo) {
      return anterior;
    }

    const anteriorMinusculas = anterior.toLowerCase();
    const nuevoMinusculas = nuevo.toLowerCase();

    // Si el nuevo resultado contiene exactamente
    // el texto anterior al comienzo, significa que
    // el navegador está enviando una versión acumulada.
    if (
      nuevoMinusculas.startsWith(
        anteriorMinusculas
      )
    ) {
      return nuevo;
    }

    // Si el texto anterior ya contiene completamente
    // el nuevo resultado, no agregamos nada.
    if (
      anteriorMinusculas.includes(
        nuevoMinusculas
      )
    ) {
      return anterior;
    }

    // Comprobamos si el final del texto anterior
    // coincide con el comienzo del nuevo resultado.
    const palabrasAnteriores =
      anterior.split(" ");

    const palabrasNuevas =
      nuevo.split(" ");

    let mayorCoincidencia = 0;

    const maximo = Math.min(
      palabrasAnteriores.length,
      palabrasNuevas.length
    );

    for (let cantidad = 1; cantidad <= maximo; cantidad++) {
      const finalAnterior = palabrasAnteriores
        .slice(-cantidad)
        .join(" ")
        .toLowerCase();

      const inicioNuevo = palabrasNuevas
        .slice(0, cantidad)
        .join(" ")
        .toLowerCase();

      if (finalAnterior === inicioNuevo) {
        mayorCoincidencia = cantidad;
      }
    }

    if (mayorCoincidencia > 0) {
      return limpiarEspacios(
        anterior +
          " " +
          palabrasNuevas
            .slice(mayorCoincidencia)
            .join(" ")
      );
    }

    return limpiarEspacios(
      anterior + " " + nuevo
    );
  };

  const iniciarReconocimiento = () => {
    const navegador = window as any;

    const SpeechRecognition =
      navegador.SpeechRecognition ||
      navegador.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Tu navegador no admite el reconocimiento de voz. Prueba con Google Chrome."
      );
      return;
    }

    if (escuchando) {
      return;
    }

    setError("");
    setResultadoParcial("");

    const reconocimiento =
      new SpeechRecognition();

    reconocimiento.lang = "es-CO";
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;
    reconocimiento.maxAlternatives = 1;

    reconocimiento.onstart = () => {
      setEscuchando(true);
    };

    reconocimiento.onresult = (evento: any) => {
      let finalActual = "";
      let parcialActual = "";

      for (
        let i = evento.resultIndex;
        i < evento.results.length;
        i++
      ) {
        const resultado = evento.results[i];

        const transcripcion =
          resultado[0]?.transcript || "";

        if (resultado.isFinal) {
          finalActual +=
            " " + transcripcion;
        } else {
          parcialActual +=
            " " + transcripcion;
        }
      }

      finalActual = limpiarEspacios(
        finalActual
      );

      parcialActual = limpiarEspacios(
        parcialActual
      );

      /*
       * IMPORTANTE:
       *
       * No agregamos directamente cada resultado.
       *
       * El navegador puede enviar:
       *
       * "lsc"
       * "lsc muy"
       * "lsc muy buenas"
       * "lsc muy buenas noches"
       *
       * Por eso comparamos cada resultado
       * con lo que ya tenemos.
       */

      if (finalActual) {
        const anterior =
          textoConfirmadoRef.current;
      
        const textoNuevo =
          quitarDuplicaciones(
            anterior,
            finalActual
          );
      
        textoConfirmadoRef.current =
          textoNuevo;
      
        setTexto(textoNuevo);
      
        onTextoReconocido?.(textoNuevo);
      }

      setResultadoParcial(
        parcialActual
      );
    };

    reconocimiento.onerror = (
      evento: any
    ) => {
      console.log(
        "Error de reconocimiento:",
        evento.error
      );

      if (
        evento.error === "not-allowed" ||
        evento.error === "service-not-allowed"
      ) {
        setError(
          "El navegador no tiene permiso para utilizar el micrófono."
        );
      } else if (
        evento.error === "no-speech"
      ) {
        setError(
          "No se detectó ninguna voz. Intenta hablar nuevamente."
        );
      } else if (
        evento.error === "network"
      ) {
        setError(
          "Hubo un problema de conexión durante el reconocimiento de voz."
        );
      } else {
        setError(
          "Ocurrió un problema con el reconocimiento de voz."
        );
      }

      setEscuchando(false);
    };

    reconocimiento.onend = () => {
      setEscuchando(false);
      setResultadoParcial("");
      reconocimientoRef.current = null;
    };

    reconocimientoRef.current =
      reconocimiento;

    try {
      reconocimiento.start();
    } catch (e) {
      console.log(
        "No se pudo iniciar el reconocimiento:",
        e
      );

      setError(
        "No se pudo iniciar el reconocimiento de voz."
      );

      setEscuchando(false);
    }
  };

  const detenerReconocimiento = () => {
    if (reconocimientoRef.current) {
      reconocimientoRef.current.stop();
      reconocimientoRef.current = null;
    }

    setEscuchando(false);
    setResultadoParcial("");
  };

  const copiarTexto = async () => {
    if (!texto.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        texto
      );

      alert(
        "Texto copiado correctamente."
      );
    } catch {
      setError(
        "No se pudo copiar el texto."
      );
    }
  };

  const borrarTexto = () => {
    setTexto("");
    setResultadoParcial("");
    setError("");
  
    textoConfirmadoRef.current = "";
  
    // Limpiar también los resultados externos.
    onTextoReconocido?.("");
  };

  return (
    <section className="voice-recognition">
      <h2>
        Habla y convierte tu voz en texto
      </h2>

      <p>
        Habla con naturalidad. La aplicación
        mostrará tus palabras para facilitar
        la comunicación.
      </p>

      <div className="voice-controls">
        {!escuchando ? (
          <button
            type="button"
            onClick={
              iniciarReconocimiento
            }
          >
            🎙️ Iniciar reconocimiento
          </button>
        ) : (
          <button
            type="button"
            onClick={
              detenerReconocimiento
            }
          >
            ⏹️ Detener reconocimiento
          </button>
        )}
      </div>

      <div className="voice-status">
        {escuchando
          ? "🔴 Escuchando..."
          : "⚪ Micrófono detenido"}
      </div>

      <textarea
        className="voice-message"
        value={texto}
        onChange={(e) => {
          const nuevoTexto = e.target.value;
        
          setTexto(nuevoTexto);
        
          textoConfirmadoRef.current = nuevoTexto;
        
          // Actualizar el catálogo y el planificador LSC.
          onTextoReconocido?.(nuevoTexto);
        }}
        placeholder="Aquí aparecerá el texto de lo que dices..."
        rows={6}
      />

      {resultadoParcial &&
        escuchando && (
          <p className="voice-partial">
            Escuchando:{" "}
            {resultadoParcial}
          </p>
        )}

      {error && (
        <p className="voice-error">
          {error}
        </p>
      )}

      <div className="voice-controls">
        <button
          type="button"
          onClick={copiarTexto}
          disabled={!texto.trim()}
        >
          📋 Copiar texto
        </button>

        <button
          type="button"
          onClick={borrarTexto}
          disabled={!texto}
        >
          🗑️ Borrar
        </button>
      </div>

      <p className="voice-note">
        Esta función convierte la voz en
        texto. La traducción automática a
        señas colombianas se desarrollará
        en una etapa posterior.
      </p>
    </section>
  );
}