
export type RegistroGestoLSC = {
  id: string;
  gesto: string;
  fecha: string;
  confianza: "experimental";
  origen: "camara";
};

const MAX_REGISTROS = 50;

export function crearRegistroGesto(
  gesto: string
): RegistroGestoLSC {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    gesto,
    fecha: new Date().toISOString(),
    confianza: "experimental",
    origen: "camara",
  };
}

export function agregarRegistroGesto(
  historial: RegistroGestoLSC[],
  registro: RegistroGestoLSC
): RegistroGestoLSC[] {
  return [registro, ...historial].slice(0, MAX_REGISTROS);
}

export function formatearFechaGesto(fecha: string): string {
  return new Date(fecha).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
