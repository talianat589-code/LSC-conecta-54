
export type ElementoCatalogoLSC = {
  id: string;
  palabra: string;
  aliases?: string[];
  descripcion?: string;
};

export type ResultadoBusquedaLSC = {
  elemento: ElementoCatalogoLSC;
  puntuacion: number;
  coincidencia: string;
};

export function normalizarTextoLSC(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .replace(/[¿?¡!.,;:()[\]{}"'“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function obtenerPalabras(texto: string): string[] {
  return normalizarTextoLSC(texto)
    .split(" ")
    .filter((palabra) => palabra.length > 0);
}

export function buscarEnCatalogoLSC(
  frase: string,
  catalogo: ElementoCatalogoLSC[],
  limite = 8
): ResultadoBusquedaLSC[] {
  const consulta = normalizarTextoLSC(frase);

  if (!consulta || catalogo.length === 0) {
    return [];
  }

  const palabrasConsulta = obtenerPalabras(consulta);
  const resultados: ResultadoBusquedaLSC[] = [];

  for (const elemento of catalogo) {
    const variantes = [
      elemento.palabra,
      ...(elemento.aliases ?? []),
    ];

    let mejorPuntuacion = 0;
    let mejorCoincidencia = "";

    for (const variante of variantes) {
      const textoVariante = normalizarTextoLSC(variante);

      if (!textoVariante) continue;

      let puntuacion = 0;

      // Coincidencia de la frase completa.
      if (consulta === textoVariante) {
        puntuacion = 100;
      }
      // La frase hablada contiene la expresión del catálogo.
      else if (
        consulta.includes(` ${textoVariante} `) ||
        consulta.startsWith(`${textoVariante} `) ||
        consulta.endsWith(` ${textoVariante}`)
      ) {
        puntuacion = 80;
      }
      // Coincidencia parcial por palabras.
      else {
        const palabrasVariante = obtenerPalabras(textoVariante);
        const palabrasCoincidentes = palabrasVariante.filter(
          (palabra) => palabrasConsulta.includes(palabra)
        );

        if (palabrasVariante.length > 0) {
          puntuacion =
            (palabrasCoincidentes.length / palabrasVariante.length) *
            60;
        }
      }

      if (puntuacion > mejorPuntuacion) {
        mejorPuntuacion = puntuacion;
        mejorCoincidencia = variante;
      }
    }

    if (mejorPuntuacion > 0) {
      resultados.push({
        elemento,
        puntuacion: Math.round(mejorPuntuacion),
        coincidencia: mejorCoincidencia,
      });
    }
  }

  return resultados
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, Math.max(0, limite));
}
