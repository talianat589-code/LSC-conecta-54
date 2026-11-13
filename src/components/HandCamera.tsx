
import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

type Landmark = {
  x: number;
  y: number;
  z: number;
};

type HandCameraProps = {
  onDetection?: (hands: Landmark[][]) => void;
  facingMode?: "user" | "environment";
};

function HandCamera({
  onDetection,
  facingMode = "user",
}: HandCameraProps) {

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef(onDetection);

  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState("");
  const [handsDetected, setHandsDetected] = useState(0);

  useEffect(() => {
    callbackRef.current = onDetection;
  }, [onDetection]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let handLandmarker: HandLandmarker | null = null;
    let animationFrame = 0;
    let mounted = true;
    let lastVideoTime = -1;

    async function startCamera() {
      try {
        setError("");

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Este navegador no permite acceder a la cámara."
          );
        }

        // 1. Solicitar acceso a la cámara
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;

        if (!video) {
          throw new Error("No se encontró el elemento de video.");
        }

        video.srcObject = stream;
        await video.play();

        setCameraReady(true);

        // 2. Cargar el sistema de visión artificial
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        if (!mounted) return;

        // 3. Crear el detector de manos
        handLandmarker = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );

        if (!mounted) {
          handLandmarker.close();
          return;
        }

        setModelReady(true);

        // 4. Detectar manos continuamente
        const detectHands = () => {
          if (!mounted) return;

          const currentVideo = videoRef.current;
          const canvas = canvasRef.current;

          if (
            !currentVideo ||
            !canvas ||
            !handLandmarker ||
            currentVideo.readyState < 2
          ) {
            animationFrame = requestAnimationFrame(detectHands);
            return;
          }

          const ctx = canvas.getContext("2d");

          if (!ctx) return;

          // Ajustar el tamaño del lienzo al video
          if (
            canvas.width !== currentVideo.videoWidth ||
            canvas.height !== currentVideo.videoHeight
          ) {
            canvas.width = currentVideo.videoWidth;
            canvas.height = currentVideo.videoHeight;
          }

          // Evitar procesar dos veces el mismo fotograma
          if (currentVideo.currentTime !== lastVideoTime) {
            lastVideoTime = currentVideo.currentTime;

            const results = handLandmarker.detectForVideo(
              currentVideo,
              performance.now()
            );

            // Limpiar los dibujos anteriores
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const drawingUtils = new DrawingUtils(ctx);

            // Dibujar conexiones y puntos de cada mano
            if (results.landmarks) {
              results.landmarks.forEach((landmarks) => {
                drawingUtils.drawConnectors(
                  landmarks,
                  HandLandmarker.HAND_CONNECTIONS,
                  {
                    color: "#00FF88",
                    lineWidth: 4,
                  }
                );

                drawingUtils.drawLandmarks(landmarks, {
                  color: "#FF3366",
                  lineWidth: 2,
                  radius: 4,
                });
              });
            }

            const detectedHands = results.landmarks ?? [];

            setHandsDetected(detectedHands.length);

            callbackRef.current?.(detectedHands);
          }

          animationFrame = requestAnimationFrame(detectHands);
        };

        detectHands();
      } catch (err) {
        console.error("Error en la cámara o detector:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo iniciar el detector de manos."
          );
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;

      cancelAnimationFrame(animationFrame);

      stream?.getTracks().forEach((track) => track.stop());

      handLandmarker?.close();
    };
  }, [facingMode]);

  return (
    <div className="camera-container">
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        playsInline
        muted
      />

      <canvas
        ref={canvasRef}
        className="camera-canvas"
      />

      {!cameraReady && !error && (
        <div className="camera-message">
          Iniciando cámara...
        </div>
      )}

      {cameraReady && !modelReady && !error && (
        <div className="camera-message">
          Cargando detector de manos...
        </div>
      )}

      {error && (
        <div className="camera-message camera-error">
          {error}
        </div>
      )}

      {modelReady && (
        <div className="camera-status">
          ● Detector activo
        </div>
      )}

      {modelReady && (
        <div className="hand-counter">
          Manos detectadas: {handsDetected}
        </div>
      )}
    </div>
  );
}

export default HandCamera;
