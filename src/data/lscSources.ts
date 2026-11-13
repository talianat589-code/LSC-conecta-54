export type EstadoFuente =
  | "pendiente-revision"
  | "revisada"
  | "aprobada"
  | "no-utilizable";

export type PermisoUso =
  | "permitido"
  | "no-permitido"
  | "por-verificar";

export type FuenteLSC = {
  id: string;

  nombre: string;

  institucion: string;

  descripcion: string;

  url: string;

  licencia: string;

  estado: EstadoFuente;

  usoComercial: PermisoUso;

  modificacion: PermisoUso;

  redistribucion: PermisoUso;

  entrenamientoIA: PermisoUso;

  datosDisponibles: string[];

  requiereAtribucion: boolean;

  observaciones: string;
};

/*
 * Fuentes registradas para LSC Conecta.
 *
 * IMPORTANTE:
 * Una fuente registrada aquí NO significa automáticamente
 * que todo su contenido pueda copiarse o redistribuirse.
 *
 * La aplicación conservará el estado de revisión de cada fuente.
 */

export const fuentesLSC: FuenteLSC[] = [
  {
    id: "lsc50",

    nombre:
      "LSC50: Colombian Sign Language Video and Inertial Measurement Dataset",

    institucion:
      "Christian Cifuentes-De la Portilla, Luis Felipe Giraldo y Brayan David Solórzano Quevedo",

    descripcion:
      "Conjunto de datos de Lengua de Señas Colombiana que contiene grabaciones de vídeo, mediciones inerciales, landmarks corporales y datos relacionados con el movimiento de la parte superior del cuerpo.",

    url:
      "https://figshare.com/articles/dataset/LSC50_Colombian_Sign_Language_Video_and_Inertial_Measurement_Dataset/27383016",

    licencia:
      "CC BY 4.0",

    estado:
      "revisada",

    usoComercial:
      "permitido",

    modificacion:
      "permitido",

    redistribucion:
      "por-verificar",

    entrenamientoIA:
      "por-verificar",

    datosDisponibles: [
      "vídeos",
      "mediciones inerciales",
      "landmarks corporales",
      "información de movimiento",
      "información de brazos y muñecas",
    ],

    requiereAtribucion:
      true,

    observaciones:
      "La página del conjunto de datos indica licencia CC BY 4.0. Antes de incorporar archivos concretos a una versión distribuida de LSC Conecta debemos revisar los términos aplicables al archivo, la atribución requerida y cualquier condición adicional."
  },

  {
    id: "insor-conecta",

    nombre:
      "INSOR Conecta",

    institucion:
      "Instituto Nacional para Sordos - INSOR",

    descripcion:
      "Portal institucional que publica documentos y recursos relacionados con la Lengua de Señas Colombiana, incluyendo estudios lingüísticos, variación sociolingüística y gestión del léxico.",

    url:
      "https://conecta.insor.gov.co/",

    licencia:
      "por-verificar",

    estado:
      "pendiente-revision",

    usoComercial:
      "por-verificar",

    modificacion:
      "por-verificar",

    redistribucion:
      "por-verificar",

    entrenamientoIA:
      "por-verificar",

    datosDisponibles: [
      "documentos",
      "recursos lingüísticos",
      "información sobre léxico",
      "información sobre variación lingüística",
    ],

    requiereAtribucion:
      true,

    observaciones:
      "Fuente institucional prioritaria para investigación y validación. No se copiarán ni redistribuirán materiales audiovisuales o textuales hasta verificar las condiciones de uso correspondientes."
  },

  {
    id: "insor-educativo",

    nombre:
      "INSOR Educativo - Diccionario y recursos LSC",

    institucion:
      "Instituto Nacional para Sordos - INSOR",

    descripcion:
      "Recursos educativos y diccionario bilingüe relacionados con la Lengua de Señas Colombiana y el español.",

    url:
      "https://educativo.insor.gov.co/",

    licencia:
      "por-verificar",

    estado:
      "pendiente-revision",

    usoComercial:
      "por-verificar",

    modificacion:
      "por-verificar",

    redistribucion:
      "por-verificar",

    entrenamientoIA:
      "por-verificar",

    datosDisponibles: [
      "conceptos",
      "definiciones",
      "usos comunicativos",
      "recursos audiovisuales",
      "información lingüística",
    ],

    requiereAtribucion:
      true,

    observaciones:
      "Se utilizará inicialmente como fuente de consulta y referencia. No asumiremos permiso de reutilización de vídeos, imágenes o textos sin verificar la licencia correspondiente."
  },

];

/**
 * Busca una fuente por su identificador.
 */
export function obtenerFuenteLSC(
  id: string
): FuenteLSC | undefined {
  return fuentesLSC.find(
    (fuente) => fuente.id === id
  );
}

/**
 * Devuelve únicamente las fuentes que actualmente
 * están marcadas como aprobadas.
 */
export function obtenerFuentesAprobadas(): FuenteLSC[] {
  return fuentesLSC.filter(
    (fuente) =>
      fuente.estado === "aprobada"
  );
}