
export type EtiquetaLSC50 = {
  codigo: string;
  concepto: string;
  fuenteId: "lsc50";
};

export const etiquetasLSC50: EtiquetaLSC50[] = [
  { codigo: "0000", concepto: "Gracias", fuenteId: "lsc50" },
  { codigo: "0001", concepto: "Buenos días", fuenteId: "lsc50" },
  { codigo: "0002", concepto: "Buenas tardes", fuenteId: "lsc50" },
  { codigo: "0003", concepto: "Buenas noches", fuenteId: "lsc50" },
  { codigo: "0004", concepto: "Seña", fuenteId: "lsc50" },
  { codigo: "0005", concepto: "Nombre", fuenteId: "lsc50" },
  { codigo: "0006", concepto: "Trabajar", fuenteId: "lsc50" },
  { codigo: "0007", concepto: "Comer", fuenteId: "lsc50" },
  { codigo: "0008", concepto: "Vivir", fuenteId: "lsc50" },
  { codigo: "0009", concepto: "Poco", fuenteId: "lsc50" },
  { codigo: "0010", concepto: "Familia", fuenteId: "lsc50" },
  { codigo: "0011", concepto: "Personas", fuenteId: "lsc50" },
  { codigo: "0012", concepto: "Mujer", fuenteId: "lsc50" },
  { codigo: "0013", concepto: "Hombre", fuenteId: "lsc50" },
  { codigo: "0014", concepto: "Niño", fuenteId: "lsc50" },
  { codigo: "0015", concepto: "Niña", fuenteId: "lsc50" },
  { codigo: "0016", concepto: "Abuelo", fuenteId: "lsc50" },
  { codigo: "0017", concepto: "Tío", fuenteId: "lsc50" },
  { codigo: "0018", concepto: "Hermano", fuenteId: "lsc50" },
  { codigo: "0019", concepto: "Hambre", fuenteId: "lsc50" },
  { codigo: "0020", concepto: "Feliz", fuenteId: "lsc50" },
  { codigo: "0021", concepto: "Contento", fuenteId: "lsc50" },
  { codigo: "0022", concepto: "Triste", fuenteId: "lsc50" },
  { codigo: "0023", concepto: "Aburrido", fuenteId: "lsc50" },
  { codigo: "0024", concepto: "Bien", fuenteId: "lsc50" },
  { codigo: "0025", concepto: "Mal", fuenteId: "lsc50" },
  { codigo: "0026", concepto: "¿Cómo estás?", fuenteId: "lsc50" },
  { codigo: "0027", concepto: "Más o menos", fuenteId: "lsc50" },
  { codigo: "0028", concepto: "Sentir", fuenteId: "lsc50" },
  { codigo: "0029", concepto: "Juicioso", fuenteId: "lsc50" },
  { codigo: "0030", concepto: "Hola", fuenteId: "lsc50" },
  { codigo: "0031", concepto: "Adiós", fuenteId: "lsc50" },
  { codigo: "0032", concepto: "Por favor", fuenteId: "lsc50" },
  { codigo: "0033", concepto: "Con gusto", fuenteId: "lsc50" },
  { codigo: "0034", concepto: "Bienvenido", fuenteId: "lsc50" },
  { codigo: "0035", concepto: "Perdón", fuenteId: "lsc50" },
  { codigo: "0036", concepto: "Permiso", fuenteId: "lsc50" },
  { codigo: "0037", concepto: "Nunca", fuenteId: "lsc50" },
  { codigo: "0038", concepto: "Yo", fuenteId: "lsc50" },
  { codigo: "0039", concepto: "Tú", fuenteId: "lsc50" },
  { codigo: "0040", concepto: "Ustedes", fuenteId: "lsc50" },
  { codigo: "0041", concepto: "¿Qué?", fuenteId: "lsc50" },
  { codigo: "0042", concepto: "¿Cuándo?", fuenteId: "lsc50" },
  { codigo: "0043", concepto: "¿Dónde?", fuenteId: "lsc50" },
  { codigo: "0044", concepto: "¿Cómo?", fuenteId: "lsc50" },
  { codigo: "0045", concepto: "¿Por qué?", fuenteId: "lsc50" },
  { codigo: "0046", concepto: "¿Quién?", fuenteId: "lsc50" },
  { codigo: "0047", concepto: "Diferente", fuenteId: "lsc50" },
  { codigo: "0048", concepto: "Todos", fuenteId: "lsc50" },
  { codigo: "0049", concepto: "Mucho", fuenteId: "lsc50" },
];

export function buscarEtiquetaLSC50(
  codigo: string
): EtiquetaLSC50 | undefined {
  return etiquetasLSC50.find(
    (etiqueta) => etiqueta.codigo === codigo
  );
}

function normalizarConceptoLSC50(
  concepto: string
): string {
  return concepto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function buscarEtiquetaLSC50PorConcepto(
  concepto: string
): EtiquetaLSC50 | undefined {
  const conceptoBuscado =
    normalizarConceptoLSC50(concepto);

  return etiquetasLSC50.find(
    (etiqueta) =>
      normalizarConceptoLSC50(
        etiqueta.concepto
      ) === conceptoBuscado
  );
}
