
import {
  bibliotecaLSC,
  type SenaLSC,
} from "./lscLibrary";

export type SegmentoFraseLSC = {
  texto: string;
  sena: SenaLSC | null;
  estado: "coincidencia" | "sin-coincidencia";
};

export type PlanFraseLSC = {
  fraseOriginal: string;
  segmentos: SegmentoFraseLSC[];
  conceptosEncontrados: number;
  palabrasSinCoincidencia: string[];
  palabrasReconocidas: number;
  totalPalabras: number;
  porcentajeCobertura: number;
  estadoCobertura:
    | "sin-datos"
    | "sin-coincidencias"
    | "parcial"
    | "completa";
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

function palabras(texto: string): string[] {
  return normalizar(texto).split(" ").filter(Boolean);
}

function buscarExpresionExacta(
  expresion: string
): SenaLSC | null {
  const objetivo = normalizar(expresion);
  const equivalencias: Record<string, string> = {
    "muchas gracias": "gracias",
  };
  
  const expresionEquivalente = equivalencias[objetivo];
  
  if (expresionEquivalente) {
    return (
      bibliotecaLSC.find(
        (sena) =>
          normalizar(sena.concepto) === expresionEquivalente
      ) ?? null
    );
  }

  if (!objetivo) return null;

  for (const sena of bibliotecaLSC) {
    const variantes = [
      sena.concepto,
      ...sena.palabrasRelacionadas,
    ];

    const coincide = variantes.some(
      (variante) => normalizar(variante) === objetivo
    );

    if (coincide) return sena;
  }

  return null;
}

export function planificarFraseLSC(
  frase: string
): PlanFraseLSC {
  const tokens = palabras(frase);
  const segmentos: SegmentoFraseLSC[] = [];
  const palabrasSinCoincidencia: string[] = [];

  let posicion = 0;

  while (posicion < tokens.length) {
    let mejorSena: SenaLSC | null = null;
    let longitudMejor = 0;

    const maxLongitud = Math.min(5, tokens.length - posicion);

    for (
      let longitud = maxLongitud;
      longitud >= 1;
      longitud--
    ) {
      const expresion = tokens
        .slice(posicion, posicion + longitud)
        .join(" ");

      const encontrada = buscarExpresionExacta(expresion);

      if (encontrada) {
        mejorSena = encontrada;
        longitudMejor = longitud;
        break;
      }
    }

    if (mejorSena) {
      segmentos.push({
        texto: tokens
          .slice(posicion, posicion + longitudMejor)
          .join(" "),
        sena: mejorSena,
        estado: "coincidencia",
      });

      posicion += longitudMejor;
    } else {
      const palabraSinResultado = tokens[posicion];

      segmentos.push({
        texto: palabraSinResultado,
        sena: null,
        estado: "sin-coincidencia",
      });

      palabrasSinCoincidencia.push(palabraSinResultado);
      posicion++;
    }
  }

  const palabrasReconocidas = segmentos.reduce(
    (total, segmento) =>
      segmento.sena
        ? total + palabras(segmento.texto).length
        : total,
    0
  );

  const totalPalabras = tokens.length;

  const porcentajeCobertura =
    totalPalabras === 0
      ? 0
      : Math.round(
          (palabrasReconocidas / totalPalabras) * 100
        );

  const estadoCobertura:
    PlanFraseLSC["estadoCobertura"] =
    totalPalabras === 0
      ? "sin-datos"
      : palabrasReconocidas === 0
        ? "sin-coincidencias"
        : palabrasReconocidas === totalPalabras
          ? "completa"
          : "parcial";

  return {
    fraseOriginal: frase,
    segmentos,
    conceptosEncontrados: segmentos.filter(
      (segmento) => segmento.sena !== null
    ).length,
    palabrasSinCoincidencia,
    palabrasReconocidas,
    totalPalabras,
    porcentajeCobertura,
    estadoCobertura,
  };
}