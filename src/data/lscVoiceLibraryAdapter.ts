
import {
  bibliotecaLSC,
  type SenaLSC,
} from "./lscLibrary";

export type ResultadoVozBiblioteca = {
  sena: SenaLSC;
  tieneRecursoVisual: boolean;
  pendienteDeValidacion: boolean;
};

type CoincidenciaInterna = {
  resultado: ResultadoVozBiblioteca;
  posicion: number;
  longitud: number;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[¿?¡!.,;:()[\]{}"'“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buscarPrimeraCoincidencia(
  consulta: string,
  variantes: string[]
): { posicion: number; longitud: number } | null {
  let mejor: { posicion: number; longitud: number } | null =
    null;

  for (const varianteOriginal of variantes) {
    const variante = normalizar(varianteOriginal);

    if (!variante) continue;

    const expresion = new RegExp(
      `(^| )${variante.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?= |$)`,
      "g"
    );

    const coincidencia = expresion.exec(consulta);

    if (!coincidencia) continue;

    const posicion = coincidencia.index + coincidencia[1].length;

    if (
      mejor === null ||
      posicion < mejor.posicion ||
      (posicion === mejor.posicion &&
        variante.length > mejor.longitud)
    ) {
      mejor = {
        posicion,
        longitud: variante.length,
      };
    }
  }

  return mejor;
}

export function buscarCoincidenciasDeVoz(
  transcripcion: string
): ResultadoVozBiblioteca[] {
  const consulta = normalizar(transcripcion);

  if (!consulta) return [];

  const resultados: CoincidenciaInterna[] = [];

  for (const sena of bibliotecaLSC) {
    const variantes = [
      sena.concepto,
      ...sena.palabrasRelacionadas,
    ];

    const coincidencia = buscarPrimeraCoincidencia(
      consulta,
      variantes
    );

    if (!coincidencia) continue;

    resultados.push({
      resultado: {
        sena,
        tieneRecursoVisual: Boolean(
          sena.video || sena.imagen || sena.animacion
        ),
        pendienteDeValidacion:
          sena.estado === "pendiente-validacion",
      },
      posicion: coincidencia.posicion,
      longitud: coincidencia.longitud,
    });
  }

  resultados.sort(
    (a, b) =>
      a.posicion - b.posicion ||
      b.longitud - a.longitud ||
      a.resultado.sena.concepto.localeCompare(
        b.resultado.sena.concepto,
        "es"
      )
  );

  // Evita mostrar dos veces el mismo concepto.
  const idsIncluidos = new Set<string>();

  return resultados
    .filter(({ resultado }) => {
      const id = resultado.sena.id;

      if (idsIncluidos.has(id)) return false;

      idsIncluidos.add(id);
      return true;
    })
    .map(({ resultado }) => resultado);
}
