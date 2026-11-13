
export type MuestraGesto = {
  nombre: string;
  momento: number;
};

export type SecuenciaDetectada = {
  id: string;
  pasos: string[];
  inicio: string;
  fin: string;
  estado: "experimental";
};

const MAX_PASOS = 8;
const MAX_SECUENCIAS = 50;
const CLAVE_HISTORIAL = "lsc-conecta-secuencias-v1";

function normalizarGesto(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-CO");
}

export function agregarMuestra(
  historial: MuestraGesto[],
  nombre: string,
  momento = Date.now()
): MuestraGesto[] {
  const nuevoNombre = normalizarGesto(nombre);

  if (!nuevoNombre) return historial;

  const ultimo = historial[historial.length - 1];

  // No repetir el mismo gesto en cada fotograma de la cámara.
  if (ultimo && normalizarGesto(ultimo.nombre) === nuevoNombre) {
    return historial;
  }

  return [
    ...historial,
    { nombre, momento },
  ].slice(-MAX_PASOS);
}

export function crearSecuencia(
  pasos: MuestraGesto[]
): SecuenciaDetectada | null {
  if (pasos.length < 2) return null;

  const nombres = pasos.map((paso) => paso.nombre);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pasos: nombres,
    inicio: new Date(pasos[0].momento).toISOString(),
    fin: new Date(pasos[pasos.length - 1].momento).toISOString(),
    estado: "experimental",
  };
}

export function guardarSecuencia(
  secuencias: SecuenciaDetectada[],
  nueva: SecuenciaDetectada
): SecuenciaDetectada[] {
  return [nueva, ...secuencias].slice(0, MAX_SECUENCIAS);
}

export function cargarSecuencias(): SecuenciaDetectada[] {
  try {
    const contenido = localStorage.getItem(CLAVE_HISTORIAL);

    if (!contenido) return [];

    const datos: unknown = JSON.parse(contenido);

    if (!Array.isArray(datos)) return [];

    return datos.slice(0, MAX_SECUENCIAS) as SecuenciaDetectada[];
  } catch {
    return [];
  }
}

export function persistirSecuencias(
  secuencias: SecuenciaDetectada[]
): boolean {
  try {
    localStorage.setItem(
      CLAVE_HISTORIAL,
      JSON.stringify(secuencias.slice(0, MAX_SECUENCIAS))
    );

    return true;
  } catch {
    return false;
  }
}

export function borrarSecuenciasGuardadas(): void {
  try {
    localStorage.removeItem(CLAVE_HISTORIAL);
  } catch {
    // La aplicación continúa funcionando si el almacenamiento no está disponible.
  }
}
