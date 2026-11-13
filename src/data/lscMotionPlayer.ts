
export type RotacionHuesoLSC = {
  x: number;
  y: number;
  z: number;
};

export type FotogramaMovimientoLSC = {
  tiempoMs: number;
  huesos: Record<string, RotacionHuesoLSC>;
};

export type SecuenciaMovimientoLSC = {
  id: string;
  senaId: string;
  duracionMs: number;
  fotogramas: FotogramaMovimientoLSC[];
};

export type ResultadoValidacionMovimiento = {
  valido: boolean;
  errores: string[];
};

export function validarSecuenciaMovimiento(
  secuencia: SecuenciaMovimientoLSC,
  nombresHuesosDisponibles: string[]
): ResultadoValidacionMovimiento {
  const errores: string[] = [];

  if (!secuencia.id.trim()) {
    errores.push("Falta el identificador de la secuencia.");
  }

  if (!secuencia.senaId.trim()) {
    errores.push("Falta asociar la secuencia a una seña.");
  }

  if (
    !Number.isFinite(secuencia.duracionMs) ||
    secuencia.duracionMs <= 0
  ) {
    errores.push("La duración debe ser mayor que cero.");
  }

  if (
    !Array.isArray(secuencia.fotogramas) ||
    secuencia.fotogramas.length < 2
  ) {
    errores.push(
      "Se necesitan al menos dos fotogramas para reproducir el movimiento."
    );

    return {
      valido: false,
      errores,
    };
  }

  const huesosDisponibles = new Set(
    nombresHuesosDisponibles
  );

  let tiempoAnterior = -1;

  for (const [indice, fotograma] of
    secuencia.fotogramas.entries()) {

    if (
      !Number.isFinite(fotograma.tiempoMs) ||
      fotograma.tiempoMs < 0
    ) {
      errores.push(
        `Fotograma ${indice + 1}: tiempo no válido.`
      );
    }

    if (fotograma.tiempoMs <= tiempoAnterior) {
      errores.push(
        `Fotograma ${indice + 1}: los tiempos deben aumentar.`
      );
    }

    tiempoAnterior = fotograma.tiempoMs;

    const nombres = Object.keys(fotograma.huesos);

    if (nombres.length === 0) {
      errores.push(
        `Fotograma ${indice + 1}: no contiene huesos.`
      );
    }

    for (const nombre of nombres) {
      const rotacion = fotograma.huesos[nombre];

      if (!huesosDisponibles.has(nombre)) {
        errores.push(
          `Fotograma ${indice + 1}: el hueso "${nombre}" no existe en EMA.`
        );
        continue;
      }

      if (
        !Number.isFinite(rotacion.x) ||
        !Number.isFinite(rotacion.y) ||
        !Number.isFinite(rotacion.z)
      ) {
        errores.push(
          `Fotograma ${indice + 1}: rotación no válida en "${nombre}".`
        );
      }
    }
  }

  const ultimoFotograma =
    secuencia.fotogramas[
      secuencia.fotogramas.length - 1
    ];

  if (
    ultimoFotograma &&
    ultimoFotograma.tiempoMs > secuencia.duracionMs
  ) {
    errores.push(
      "La duración es menor que el tiempo del último fotograma."
    );
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}

export function interpolarRotacionLSC(
  inicio: RotacionHuesoLSC,
  final: RotacionHuesoLSC,
  progreso: number
): RotacionHuesoLSC {
  const t = Math.max(0, Math.min(1, progreso));

  return {
    x: inicio.x + (final.x - inicio.x) * t,
    y: inicio.y + (final.y - inicio.y) * t,
    z: inicio.z + (final.z - inicio.z) * t,
  };
}

export function obtenerFotogramaInterpolado(
  secuencia: SecuenciaMovimientoLSC,
  tiempoMs: number
): Record<string, RotacionHuesoLSC> {
  const fotogramas = secuencia.fotogramas;

  if (fotogramas.length === 0) {
    return {};
  }

  if (tiempoMs <= fotogramas[0].tiempoMs) {
    return fotogramas[0].huesos;
  }

  const ultimo = fotogramas[fotogramas.length - 1];

  if (tiempoMs >= ultimo.tiempoMs) {
    return ultimo.huesos;
  }

  for (let i = 0; i < fotogramas.length - 1; i++) {
    const actual = fotogramas[i];
    const siguiente = fotogramas[i + 1];

    if (
      tiempoMs >= actual.tiempoMs &&
      tiempoMs <= siguiente.tiempoMs
    ) {
      const duracion =
        siguiente.tiempoMs - actual.tiempoMs;

      const progreso =
        (tiempoMs - actual.tiempoMs) / duracion;

      const resultado: Record<
        string,
        RotacionHuesoLSC
      > = {};

      const nombres = new Set([
        ...Object.keys(actual.huesos),
        ...Object.keys(siguiente.huesos),
      ]);

      for (const nombre of nombres) {
        const desde = actual.huesos[nombre];
        const hasta = siguiente.huesos[nombre];

        const posturaNeutra = {
          x: 0,
          y: 0,
          z: 0,
        };
        
        resultado[nombre] = interpolarRotacionLSC(
          desde ?? posturaNeutra,
          hasta ?? posturaNeutra,
          progreso
        );
      }

      return resultado;
    }
  }

  return ultimo.huesos;
}
