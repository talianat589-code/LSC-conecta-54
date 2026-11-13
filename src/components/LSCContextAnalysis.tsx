
type Props = {
  frase: string;
};

type PatronRelacion = {
  expresion: string[];
  tipo: string;
};

type RelacionDetectada = {
  tipo: string;
  expresion: string;
  complemento: string;
  posicion: number;
};

type SegmentoAnalizado = {
  conector: string;
  palabras: string[];
  participanteCompartido?: string;
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

const patronesRelacion: PatronRelacion[] = [
  { expresion: ["quiero"], tipo: "Deseo o intención" },
  { expresion: ["necesito"], tipo: "Necesidad" },
  { expresion: ["busco"], tipo: "Búsqueda" },
  { expresion: ["tengo"], tipo: "Posesión o disponibilidad" },

  { expresion: ["me", "gusta"], tipo: "Preferencia" },
  { expresion: ["me", "gustan"], tipo: "Preferencia" },

  { expresion: ["puedo"], tipo: "Posibilidad o capacidad" },
  { expresion: ["puedes"], tipo: "Posible petición" },
  { expresion: ["podrias"], tipo: "Posible petición" },

  { expresion: ["estoy"], tipo: "Estado o condición" },
  { expresion: ["soy"], tipo: "Identidad o descripción" },
  { expresion: ["siento"], tipo: "Sensación o experiencia emocional" },

  { expresion: ["tomo"], tipo: "Acción de consumo" },
  { expresion: ["voy"], tipo: "Desplazamiento" },
  { expresion: ["vivo"], tipo: "Residencia o ubicación" },
  { expresion: ["vive"], tipo: "Residencia o ubicación" },
  { expresion: ["vives"], tipo: "Residencia o ubicación" },
  { expresion: ["viven"], tipo: "Residencia o ubicación" },

  { expresion: ["ayuda"], tipo: "Acción de ayuda" },
  { expresion: ["ayudo"], tipo: "Acción de ayuda" },
  { expresion: ["ayudan"], tipo: "Acción de ayuda" },
  { expresion: ["ensena"], tipo: "Acción de enseñanza" },
  { expresion: ["enseno"], tipo: "Acción de enseñanza" },
  { expresion: ["ensenas"], tipo: "Acción de enseñanza" },
  { expresion: ["ensenan"], tipo: "Acción de enseñanza" },
  { expresion: ["acompana"], tipo: "Acción de acompañamiento" },
  { expresion: ["acompano"], tipo: "Acción de acompañamiento" },
  { expresion: ["acompanas"], tipo: "Acción de acompañamiento" },
  { expresion: ["acompanan"], tipo: "Acción de acompañamiento" },
  { expresion: ["visito"], tipo: "Acción de visita" },
  { expresion: ["visita"], tipo: "Acción de visita" },
  { expresion: ["visitan"], tipo: "Acción de visita" },
];

const conectores = [
  "y",
  "pero",
  "porque",
  "aunque",
];

const marcadoresNegacion = [
  "no",
  "nunca",
  "jamas",
  "tampoco",
];

const marcadoresPregunta = [
  "que",
  "como",
  "donde",
  "cuando",
  "quien",
  "cual",
  "cuanto",
  "por que",
];

function coincideEn(
  palabras: string[],
  expresion: string[],
  inicio: number
): boolean {
  return expresion.every(
    (palabra, indice) =>
      palabras[inicio + indice] === palabra
  );
}

function segmentarFrase(
  palabras: string[]
): SegmentoAnalizado[] {
  const segmentos: SegmentoAnalizado[] = [];
  let acumuladas: string[] = [];
  let conectorActual = "Frase principal";

  palabras.forEach((palabra) => {
    if (conectores.includes(palabra)) {
      if (acumuladas.length > 0) {
        segmentos.push({
          conector: conectorActual,
          palabras: acumuladas,
        });
      }

      acumuladas = [];
      conectorActual = `Conector: ${palabra}`;
    } else {
      acumuladas.push(palabra);
    }
  });

  if (acumuladas.length > 0) {
    segmentos.push({
      conector: conectorActual,
      palabras: acumuladas,
    });
  }

  return segmentos;
}

function segmentarFraseConPuntuacion(
  texto: string
): SegmentoAnalizado[] {
  const partes = texto
  .split(/[,.!?;:]+/)
    .map((parte) => normalizar(parte))
    .filter(Boolean);

  const resultado: SegmentoAnalizado[] = [];

  partes.forEach((parte, indice) => {
    const tokens = parte.split(" ").filter(Boolean);
    const subsegmentos = segmentarFrase(tokens);

    subsegmentos.forEach((segmento, subIndice) => {
      resultado.push({
        ...segmento,
        conector:
          indice > 0 && subIndice === 0
            ? "Separación por puntuación"
            : segmento.conector,
      });
    });
  });

  return resultado;
}

function buscarRelaciones(
  palabras: string[]
): RelacionDetectada[] {
  const encontradas: RelacionDetectada[] = [];

  for (let i = 0; i < palabras.length; i++) {
    const patron = patronesRelacion.find((actual) =>
      coincideEn(palabras, actual.expresion, i)
    );

    if (patron) {
      encontradas.push({
        tipo: patron.tipo,
        expresion: patron.expresion.join(" "),
        complemento: "",
        posicion: i,
      });

      i += patron.expresion.length - 1;
    }
  }

  return encontradas.map((relacion, indice) => {
    const siguiente = encontradas[indice + 1];

    const inicioComplemento =
      relacion.posicion + relacion.expresion.split(" ").length;

    const finComplemento = siguiente
      ? siguiente.posicion
      : palabras.length;

    return {
      ...relacion,
      complemento: palabras
        .slice(inicioComplemento, finComplemento)
        .join(" "),
    };
  });
}


function analizarNegacion(palabras: string[]) {
  const indices = palabras
    .map((palabra, indice) =>
      marcadoresNegacion.includes(palabra)
        ? indice
        : -1
    )
    .filter((indice) => indice >= 0);

  return indices.map((indice) => {
    const marcador = palabras[indice];

    const palabrasPosteriores = palabras.slice(
      indice + 1
    );

    const relacionPosterior =
      buscarRelaciones(palabrasPosteriores)[0];

    const distanciaRelacion =
      relacionPosterior?.posicion ?? -1;

    const relacionInmediata =
      relacionPosterior !== undefined &&
      distanciaRelacion === 0;

    const relacionAfectada =
      relacionPosterior
        ? `${relacionPosterior.tipo}: ${relacionPosterior.expresion}`
        : null;

    let detalle: string;

    if (relacionInmediata) {
      detalle =
        `El marcador «${marcador}» aparece inmediatamente antes de una relación de ${relacionPosterior.tipo.toLowerCase()}. Se propone como posible alcance de la negación.`;
    } else if (relacionPosterior) {
      detalle =
        `Se encontró una relación de ${relacionPosterior.tipo.toLowerCase()} después de la negación, pero hay palabras intermedias. Su alcance no puede confirmarse.`;
    } else {
      detalle =
        "Se detectó un marcador negativo, pero no se encontró una relación reconocida a la cual asociarlo.";
    }

    return {
      marcador,
      expresion: palabras.slice(indice).join(" "),
      relacionAfectada,
      detalle,
    };
  });
}

function clasificarComplemento(texto: string): string[] {
  const palabras = normalizar(texto)
    .split(" ")
    .filter(Boolean);

  if (palabras.length === 0) {
    return ["Sin complemento identificado"];
  }

  const categorias = [
    {
      tipo: "Persona",
      palabras: [
        "mama", "papa", "amigo", "amiga",
        "profesor", "profesora", "hermano",
        "hermana", "doctor", "doctora",
        "nino", "nina", "familia",
      ],
    },
    {
      tipo: "Lugar",
      palabras: [
        "casa", "colegio", "escuela",
        "trabajo", "hospital", "parque",
        "ciudad", "tienda", "universidad",
      ],
    },
    {
      tipo: "Tiempo",
      palabras: [
        "hoy", "manana", "ayer",
        "ahora", "despues", "temprano",
        "tarde", "noche", "siempre",
      ],
    },
    {
      tipo: "Alimento o bebida",
      palabras: [
        "agua", "cafe", "leche", "jugo",
        "comida", "pan", "arroz", "fruta",
        "carne", "desayuno", "almuerzo",
        "cena",
      ],
    },
    {
      tipo: "Ayuda o necesidad",
      palabras: [
        "ayuda", "apoyo", "medicina",
        "medicamento", "dinero", "permiso",
      ],
    },
    {
      tipo: "Objeto",
      palabras: [
        "libro", "celular", "telefono",
        "llave", "ropa", "mesa", "silla",
        "computador", "cuaderno",
      ],
    },
    {
      tipo: "Estado o condición",
      palabras: [
        "feliz", "triste", "enfermo",
        "cansado", "cansada", "bien",
        "mal", "hambre", "sed",
        "preocupado", "preocupada",
      ],
    },
    {
      tipo: "Estado emocional",
      palabras: [
        "alegria", "amor", "miedo",
        "enojo", "rabia", "dolor",
        "tranquilidad", "angustia",
        "felicidad", "tristeza",
      ],
    },
    {
      tipo: "Actividad u ocupación",
      palabras: [
        "estudiante", "profesor",
        "profesora", "medico", "medica",
        "ingeniero", "ingeniera",
        "trabajador", "trabajadora",
        "conductor", "conductora",
        "estudio", "trabajo",
      ],
    },
  ];

  const encontradas = categorias
    .filter((categoria) =>
      categoria.palabras.some((palabra) =>
        palabras.includes(palabra)
      )
    )
    .map((categoria) => categoria.tipo);

  return encontradas.length > 0
    ? encontradas
    : ["Complemento sin clasificar"];
}

function identificarFuncionComplemento(
  tipoRelacion: string,
  categorias: string[]
): string {
  const esPersona = categorias.includes("Persona");
  const esLugar = categorias.includes("Lugar");
  const esAlimento = categorias.includes("Alimento o bebida");
  const esObjeto = categorias.includes("Objeto");
  const esActividad = categorias.includes("Actividad u ocupación");
  const esEstado =
    categorias.includes("Estado o condición") ||
    categorias.includes("Estado emocional");

  if (tipoRelacion === "Desplazamiento") {
    return esLugar
      ? "Posible destino o lugar al que se dirige"
      : "Complemento asociado al desplazamiento";
  }

  if (tipoRelacion === "Residencia o ubicación") {
    return esLugar
      ? "Posible lugar de residencia"
      : "Ubicación de residencia pendiente de clasificar";
  }

  if (tipoRelacion === "Acción de consumo") {
    return esAlimento
      ? "Posible elemento consumido"
      : "Elemento asociado al consumo";
  }

  if (tipoRelacion === "Identidad o descripción") {
    return esPersona || esActividad
      ? "Posible identidad, profesión u ocupación"
      : "Descripción de identidad pendiente de clasificar";
  }

  if (
    tipoRelacion === "Estado o condición" ||
    tipoRelacion === "Sensación o experiencia emocional"
  ) {
    return esEstado
      ? "Posible estado o experiencia descrita"
      : "Complemento asociado al estado o experiencia";
  }

  if (
    tipoRelacion === "Necesidad" ||
    tipoRelacion === "Posible petición"
  ) {
    return "Posible elemento solicitado o necesitado";
  }

  if (tipoRelacion === "Posesión o disponibilidad") {
    return "Posible elemento poseído o disponible";
  }

  if (tipoRelacion === "Acción de ayuda") {
    return esPersona
      ? "Posible persona relacionada con la ayuda; no se determina si la recibe o participa en ella"
      : "Posible recurso o elemento relacionado con la ayuda";
  }

  if (tipoRelacion === "Acción de enseñanza") {
    return esPersona
      ? "Posible persona relacionada con la enseñanza; función exacta pendiente"
      : "Posible contenido relacionado con la enseñanza";
  }

  if (tipoRelacion === "Acción de acompañamiento") {
    return esPersona
      ? "Posible persona relacionada con el acompañamiento"
      : esLugar
        ? "Posible lugar asociado al acompañamiento"
        : "Complemento asociado al acompañamiento";
  }

  if (tipoRelacion === "Acción de visita") {
    return esPersona
      ? "Posible persona visitada o relacionada con la visita"
      : esLugar
        ? "Posible lugar visitado"
        : "Complemento asociado a la visita";
  }

  if (tipoRelacion === "Búsqueda") {
    return esPersona || esObjeto || esLugar
      ? "Posible elemento o persona buscada"
      : "Complemento asociado a la búsqueda";
  }

  if (tipoRelacion === "Deseo o intención") {
    return "Posible objeto, actividad o situación deseada";
  }

  if (tipoRelacion === "Preferencia") {
    return "Posible elemento o actividad relacionada con una preferencia";
  }

  return "Complemento asociado a la relación detectada; función pendiente de determinar";
}

function analizarRolesParticipantes(
  palabras: string[],
  posicionRelacion: number,
  tipoRelacion: string
): string[] {
  const personas = [
    "mama",
    "papa",
    "hermano",
    "hermana",
    "amigo",
    "amiga",
    "profesor",
    "profesora",
    "doctor",
    "doctora",
    "familia",
    "nino",
    "nina",
    "ninos",
    "ninas",
    "maria",
    "juan",
    "carlos",
    "ana",
  ];

  const pronombresSujeto = [
    "yo",
    "ella",
    "nosotros",
    "nosotras",
    "ellos",
    "ellas",
    "usted",
    "ustedes",
  ];

  const pronombresParticipante = [
    "me",
    "te",
    "nos",
    "le",
    "les",
    "lo",
    "la",
    "los",
    "las",
    "se",
  ];

  const accionesConDestinatario = [
    "Acción de ayuda",
    "Acción de enseñanza",
    "Acción de acompañamiento",
    "Acción de visita",
  ];

  const encontrados: string[] = [];

  palabras.forEach((palabra, indice) => {
    if (pronombresSujeto.includes(palabra)) {
      if (indice < posicionRelacion) {
        encontrados.push(
          `${palabra}: posible agente o participante que realiza la acción`
        );
      }
      return;
    }

    if (pronombresParticipante.includes(palabra)) {
      encontrados.push(
        `${palabra}: pronombre relacionado con la acción; función exacta pendiente de determinar`
      );
      return;
    }

    if (!personas.includes(palabra)) {
      return;
    }

    if (indice < posicionRelacion) {
      encontrados.push(
        `${palabra}: posible agente o participante que realiza la acción`
      );
      return;
    }

    const anterior = palabras[indice - 1];
    const dosAntes = palabras[indice - 2];

    const introducidaPorA =
      anterior === "a" ||
      (anterior === "mi" && dosAntes === "a");

    if (
      introducidaPorA &&
      accionesConDestinatario.includes(tipoRelacion)
    ) {
      const funcion =
        tipoRelacion === "Acción de enseñanza"
          ? "posible estudiante o destinatario de la enseñanza"
          : tipoRelacion === "Acción de ayuda"
            ? "posible destinatario de la ayuda"
            : tipoRelacion === "Acción de visita"
              ? "posible persona visitada"
              : "posible persona acompañada";

      encontrados.push(
        `${palabra}: ${funcion}; pendiente de confirmar`
      );
    } else {
      encontrados.push(
        `${palabra}: posible participante posterior a la acción; función pendiente de determinar`
      );
    }
  });

  return encontrados.length > 0
    ? encontrados
    : ["No se identificaron participantes del catálogo"];
}

function analizarRolesDeRelacion(
  palabras: string[],
  relaciones: RelacionDetectada[],
  indiceRelacion: number,
  participanteCompartido?: string
): string[] {

  const relacionActual = relaciones[indiceRelacion];

  if (!relacionActual) {
    return ["No se identificó una relación para analizar"];
  }

  const relacionAnterior =
    relaciones[indiceRelacion - 1];

  const relacionSiguiente =
    relaciones[indiceRelacion + 1];

  const inicio = relacionAnterior
    ? relacionAnterior.posicion +
      relacionAnterior.expresion.split(" ").length
    : 0;

  const fin = relacionSiguiente
    ? relacionSiguiente.posicion
    : palabras.length;

  const palabrasDelAmbito = palabras.slice(
    inicio,
    fin
  );

  const posicionLocal =
    relacionActual.posicion - inicio;

    const roles = analizarRolesParticipantes(
      palabrasDelAmbito,
      posicionLocal,
      relacionActual.tipo
    );
    
    if (!participanteCompartido) {
      return roles;
    }
    
    return [
      ...roles.filter(
        (rol) =>
          rol !== "No se identificaron participantes del catálogo"
      ),
      `${participanteCompartido}: posible agente compartido, inferido por coordinación con «y»; pendiente de confirmar`,
    ];
}

function identificarParticipanteAntesDeRelacion(
  segmento: SegmentoAnalizado
): string | null {
  const primeraRelacion =
    buscarRelaciones(segmento.palabras)[0];

  if (!primeraRelacion) {
    return null;
  }

  const palabrasPrevias = segmento.palabras.slice(
    0,
    primeraRelacion.posicion
  );

  const personas = [
    "mama",
    "papa",
    "hermano",
    "hermana",
    "amigo",
    "amiga",
    "profesor",
    "profesora",
    "doctor",
    "doctora",
    "familia",
    "nino",
    "nina",
    "ninos",
    "ninas",
    "maria",
    "juan",
    "carlos",
    "ana",
  ];

  const pronombresSujeto = [
    "yo",
    "ella",
    "nosotros",
    "nosotras",
    "ellos",
    "ellas",
    "usted",
    "ustedes",
  ];

  const candidatos = palabrasPrevias
    .map((palabra, indice) => ({
      palabra,
      indice,
    }))
    .filter(({ palabra }) =>
      personas.includes(palabra) ||
      pronombresSujeto.includes(palabra)
    );

  // Si aparecen varios participantes antes de la acción,
  // no se elige uno arbitrariamente.
  if (candidatos.length !== 1) {
    return null;
  }

  const candidato = candidatos[0];

  if (pronombresSujeto.includes(candidato.palabra)) {
    return candidato.palabra;
  }

  const palabraAnterior =
    palabrasPrevias[candidato.indice - 1];

  const posesivos = [
    "mi",
    "mis",
    "tu",
    "tus",
    "su",
    "sus",
    "nuestro",
    "nuestra",
    "nuestros",
    "nuestras",
  ];

  return posesivos.includes(palabraAnterior)
    ? `${palabraAnterior} ${candidato.palabra}`
    : candidato.palabra;
}

function identificarParticipantesCompartidos(
  segmentos: SegmentoAnalizado[]
): SegmentoAnalizado[] {
  let participanteActivo: string | null = null;
  let segmentoAnteriorConRelacion = false;

  return segmentos.map((segmento) => {
    const relaciones = buscarRelaciones(
      segmento.palabras
    );

    const participanteExplicito =
      identificarParticipanteAntesDeRelacion(segmento);

    let participanteCompartido: string | undefined;

    const puedeHeredar =
      segmento.conector === "Conector: y" &&
      segmentoAnteriorConRelacion &&
      relaciones.length > 0 &&
      !participanteExplicito &&
      participanteActivo !== null;

    if (puedeHeredar) {
      participanteCompartido = participanteActivo ?? undefined;
    }

    if (participanteExplicito) {
      participanteActivo = participanteExplicito;
    } else if (participanteCompartido) {
      participanteActivo = participanteCompartido;
    } else if (segmento.conector !== "Conector: y") {
      participanteActivo = null;
    }

    segmentoAnteriorConRelacion =
      relaciones.length > 0;

    return {
      ...segmento,
      participanteCompartido,
    };
  });
}

function analizarTipoPregunta(texto: string): string {
  const normalizada = normalizar(texto);

  const tieneSignosInterrogacion =
    /[¿?]/.test(texto);

  const marcadoresIniciales = marcadoresPregunta.some(
    (marcador) =>
      normalizada === marcador ||
      normalizada.startsWith(`${marcador} `)
  );

  const palabras = normalizada.split(" ");

  const comoInterrogativo =
    palabras[0] === "como" &&
    [
      "estas",
      "esta",
      "funciona",
      "puedo",
      "puedes",
      "se",
      "te",
      "llego",
      "hacer",
      "puede",
    ].includes(palabras[1]);

  const iniciosIndirectos = [
    "quiero saber",
    "quisiera saber",
    "me puedes decir",
    "puedes decirme",
    "sabes",
    "dime",
    "quisiera conocer",
  ];

  const tieneInicioIndirecto = iniciosIndirectos.some(
    (inicio) =>
      normalizada.startsWith(`${inicio} `) ||
      normalizada === inicio
  );

  const contieneInterrogativo =
    marcadoresPregunta.some(
      (marcador) =>
        normalizada.includes(` ${marcador} `) ||
        normalizada.endsWith(` ${marcador}`)
    );

  if (tieneSignosInterrogacion) {
    return "Posible pregunta directa: contiene signos de interrogación.";
  }

  if (
    tieneInicioIndirecto &&
    contieneInterrogativo
  ) {
    return "Posible pregunta indirecta: expresa una solicitud de información.";
  }

  if (marcadoresIniciales && palabras[0] !== "como") {
    return "Posible pregunta directa: comienza con un marcador interrogativo.";
  }

  if (comoInterrogativo) {
    return "Posible pregunta directa: comienza con una expresión interrogativa de modo.";
  }

  return "No se detectaron indicadores claros de pregunta.";
}

function analizarFocoPregunta(texto: string): string[] {
  const normalizada = ` ${normalizar(texto)} `;

  const marcadores = [
    {
      variantes: ["por que"],
      enfoque: "Motivo o causa",
    },
    {
      variantes: ["quien", "quienes"],
      enfoque: "Persona o participantes",
    },
    {
      variantes: ["donde"],
      enfoque: "Lugar o ubicación",
    },
    {
      variantes: [
        "cuando",
        "a que hora",
        "que dia",
        "en que momento",
      ],
      enfoque: "Momento o tiempo",
    },
    {
      variantes: ["cuanto", "cuanta", "cuantos", "cuantas"],
      enfoque: "Cantidad",
    },
    {
      variantes: ["como"],
      enfoque: "Manera, estado o procedimiento",
    },
    {
      variantes: ["cual", "cuales"],
      enfoque: "Selección o identificación",
    },
    {
      variantes: ["que"],
      enfoque: "Información, objeto o situación",
    },
  ];

  const resultados: string[] = [];

  marcadores.forEach((marcador) => {
    const expresion = marcador.variantes.find(
      (variante) =>
        normalizada.includes(` ${variante} `)
    );

    if (!expresion) return;

    if (
      expresion === "que" &&
      (
        normalizada.includes(" por que ") ||
        normalizada.includes(" a que hora ") ||
        normalizada.includes(" que dia ") ||
        normalizada.includes(" en que momento ")
      )
    ) {
      return;
    }

    resultados.push(
      `«${expresion}»: posible búsqueda de ${marcador.enfoque.toLowerCase()}`
    );
  });

  return resultados;
}


function relacionarFocoConContexto(
  focos: string[],
  segmentos: SegmentoAnalizado[]
): string[] {
  return focos.map((foco) => {
    const enfoque = normalizar(foco);

    const relaciones = segmentos.flatMap((segmento) => {
      const encontradas = buscarRelaciones(segmento.palabras);

      return encontradas.map((relacion) => ({
        relacion,
        participantes: analizarRolesDeRelacion(
          segmento.palabras,
          encontradas,
          encontradas.indexOf(relacion),
          segmento.participanteCompartido
        ),
      }));
    });

    if (enfoque.includes("persona")) {
      const participantes = relaciones
        .flatMap((item) => item.participantes)
        .filter(
          (rol) =>
            !rol.startsWith("No se identificaron")
        );

      return participantes.length > 0
        ? `Posibles participantes relacionados: ${participantes.join("; ")}`
        : "No se identificaron participantes reconocidos que permitan responder quién.";
    }

    if (
      enfoque.includes("lugar") ||
      enfoque.includes("ubicacion")
    ) {
      
      const lugaresEnRelaciones = relaciones
      .filter((item) =>
        clasificarComplemento(
          item.relacion.complemento
        ).includes("Lugar")
      )
      .map((item) => item.relacion.complemento);

    const lugaresEnSegmentos = segmentos
      .filter((segmento) =>
        clasificarComplemento(
          segmento.palabras.join(" ")
        ).includes("Lugar")
      )
      .map((segmento) => segmento.palabras.join(" "));

    const lugares = Array.from(
      new Set([
        ...lugaresEnRelaciones,
        ...lugaresEnSegmentos,
      ])
    );

      return lugares.length > 0
        ? `Posibles referencias de lugar encontradas: ${lugares.join("; ")}`
        : "No se encontró un complemento clasificado como lugar.";
    }

    if (
      enfoque.includes("tiempo") ||
      enfoque.includes("momento")
    ) {
      
      const tiemposEnRelaciones = relaciones
      .filter((item) =>
        clasificarComplemento(
          item.relacion.complemento
        ).includes("Tiempo")
      )
      .map((item) => item.relacion.complemento);

    const tiemposEnSegmentos = segmentos
      .filter((segmento) =>
        clasificarComplemento(
          segmento.palabras.join(" ")
        ).includes("Tiempo")
      )
      .map((segmento) => segmento.palabras.join(" "));

    const tiempos = Array.from(
      new Set([
        ...tiemposEnRelaciones,
        ...tiemposEnSegmentos,
      ])
    );

      return tiempos.length > 0
        ? `Posibles referencias de tiempo encontradas: ${tiempos.join("; ")}`
        : "No se encontró un complemento clasificado como tiempo.";
    }

    if (enfoque.includes("causa")) {
      const causas = segmentos
        .filter(
          (segmento) =>
            segmento.conector === "Conector: porque"
        )
        .map((segmento) => segmento.palabras.join(" "));

      return causas.length > 0
        ? `Posible segmento que expresa una causa: ${causas.join("; ")}`
        : "No se identificó un segmento introducido por «porque».";
    }

    
    if (enfoque.includes("cantidad")) {
      const patronCantidad =
        /\d+|\b(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|ambos|ambas|muchos|muchas|pocos|pocas|varios|varias|bastante|suficiente|docena)\b/;

      const cantidadesEnRelaciones = relaciones
        .map((item) => item.relacion.complemento)
        .filter((complemento) =>
          patronCantidad.test(normalizar(complemento))
        );

      const cantidadesEnSegmentos = segmentos
        .map((segmento) => segmento.palabras.join(" "))
        .filter((segmento) =>
          patronCantidad.test(normalizar(segmento))
        );

      const cantidades = Array.from(
        new Set([
          ...cantidadesEnRelaciones,
          ...cantidadesEnSegmentos,
        ])
      );

      return cantidades.length > 0
        ? `Posibles expresiones de cantidad encontradas: ${cantidades.join("; ")}`
        : "No se encontró una expresión de cantidad reconocible.";
    }

    if (
      enfoque.includes("manera") ||
      enfoque.includes("estado")
    ) {
      const estados = relaciones.filter((item) =>
        [
          "Estado o condición",
          "Sensación o experiencia emocional",
          "Desplazamiento",
          "Acción de consumo",
        ].includes(item.relacion.tipo)
      );

      return estados.length > 0
        ? `Relaciones que podrían aportar contexto: ${estados
            .map((item) => `${item.relacion.tipo} (${item.relacion.complemento || "sin complemento"})`)
            .join("; ")}`
        : "No se identificó una relación reconocida que aporte información sobre manera o estado.";
    }

    const complementos = relaciones
      .filter((item) => item.relacion.complemento.trim())
      .map((item) => item.relacion.complemento);

    return complementos.length > 0
      ? `Complementos encontrados que podrían aportar información: ${complementos.join("; ")}`
      : "No se encontraron complementos reconocidos para relacionar con esta pregunta.";
  });
}

export default function LSCContextAnalysis({
  frase,
}: Props) {
  const texto = frase.trim();

  if (!texto) {
    return (
      <section className="lsc-context-analysis">
        <h3>Análisis contextual del mensaje</h3>
        <p>
          Habla o escribe una frase para analizar
          sus posibles relaciones comunicativas.
        </p>
      </section>
    );
  }

  const normalizada = normalizar(texto);
  const palabras = normalizada.split(" ").filter(Boolean);

  const segmentos = identificarParticipantesCompartidos(
    segmentarFraseConPuntuacion(texto)
  );
  
  const relacionesPorSegmento = segmentos.map(

    (segmento) => ({
      ...segmento,
      relaciones: buscarRelaciones(segmento.palabras),
      negaciones: analizarNegacion(segmento.palabras),
    })
  );

  const contieneExpresion = (expresion: string) =>
    (` ${normalizada} `).includes(
      ` ${normalizar(expresion)} `
    );

    const tipoPregunta = analizarTipoPregunta(texto);

    const focoPregunta =
  tipoPregunta.startsWith("No se detectaron")
    ? []
    : analizarFocoPregunta(texto);

    const vinculosFocoPregunta =
    relacionarFocoConContexto(
      focoPregunta,
      segmentos
    );

  const negacionesDetectadas =
    palabras.filter((palabra) =>
      marcadoresNegacion.includes(palabra)
    );

  const intenciones: string[] = [];

  if (
    contieneExpresion("hola") ||
    contieneExpresion("buenos dias") ||
    contieneExpresion("buenas noches")
  ) {
    intenciones.push("Posible saludo");
  }

  if (contieneExpresion("gracias")) {
    intenciones.push("Posible agradecimiento");
  }

  if (
    contieneExpresion("por favor") ||
    contieneExpresion("necesito") ||
    contieneExpresion("quiero") ||
    contieneExpresion("puedes") ||
    contieneExpresion("podrias") ||
    contieneExpresion("ayudame")
  ) {
    intenciones.push("Posible solicitud o petición");
  }

  if (palabras.includes("si")) {
    intenciones.push("Posible respuesta afirmativa");
  }

  if (
    negacionesDetectadas.includes("no") &&
    palabras.length <= 4
  ) {
    intenciones.push("Posible respuesta negativa");
  }

  if (intenciones.length === 0) {
    intenciones.push(
      "Intención comunicativa no identificada con estas reglas"
    );
  }

  return (
    <section className="lsc-context-analysis">
      <h3>Análisis contextual del mensaje</h3>

      <div>
        <h4>Tipo de expresión</h4>
        <p>{tipoPregunta}</p>

        
        {focoPregunta.length > 0 && (
          <div>
            <h4>Información que podría solicitar la pregunta</h4>

            <ul>
              {focoPregunta.map((foco, indice) => (
                <li key={indice}>{foco}</li>
              ))}
            </ul>

            <h4>Relación con el contexto del mensaje</h4>

            <ul>
              {vinculosFocoPregunta.map((vinculo, indice) => (
                <li key={indice}>{vinculo}</li>
              ))}
            </ul>

            <p className="helper-text">
              Estas asociaciones son inferencias experimentales
              basadas en palabras y relaciones reconocidas.
              No representan una interpretación lingüística
              definitiva ni una traducción validada en LSC.
            </p>
          </div>
        )}

      </div>

      <div>
        <h4>Relaciones por segmento</h4>

        {relacionesPorSegmento.map(
          (segmento, indice) => (
            <div key={indice}>
              <h4>
                Segmento {indice + 1}
              </h4>

              <p>
                <strong>
                  {segmento.conector}
                </strong>
              </p>

              <p>
                <strong>Texto:</strong>{" "}
                {segmento.palabras.join(" ")}
              </p>

              {segmento.relaciones.length > 0 ? (
                segmento.relaciones.map(
                  (relacion, relacionIndice) => (
                    <div key={relacionIndice}>
                      <p>
                        <strong>Relación:</strong>{" "}
                        {relacion.tipo}
                      </p>

                      <p>
  <strong>Expresión:</strong>{" "}
  {relacion.expresion}
</p>

<div>
  <p>
  <strong>Roles posibles de participantes:</strong>
  </p>

  <ul>
  
  {analizarRolesDeRelacion(
  segmento.palabras,
  segmento.relaciones,
  relacionIndice,
  segmento.participanteCompartido
).map((participante, participanteIndice) => (

      <li key={participanteIndice}>
        {participante}
      </li>
    ))}
  </ul>
</div>
                        
                      <div>
  <p>
    <strong>Complemento textual:</strong>{" "}
    {relacion.complemento || "No identificado"}
  </p>

  <p>
  <strong>Clasificación del complemento:</strong>{" "}
  {clasificarComplemento(
    relacion.complemento
  ).join(", ")}
</p>

<p>
  <strong>Función probable:</strong>{" "}
  {identificarFuncionComplemento(
    relacion.tipo,
    clasificarComplemento(
      relacion.complemento
    )
  )}
</p>
</div>
                    </div>
                  )
                )
              ) : (
                <p>
                  No se encontró una relación
                  reconocida en este segmento.
                </p>
              )}

              {segmento.negaciones.length > 0 ? (
                <div>
                  <strong>Negación detectada</strong>

                  {segmento.negaciones.map(
                    (negacion, negacionIndice) => (
                      <div key={negacionIndice}>
                        <p>
                          Marcador: {negacion.marcador}
                        </p>
                        
<p>
  Expresión analizada:{" "}
  {negacion.expresion}
</p>

{negacion.relacionAfectada && (
  <p>
    <strong>Relación posiblemente afectada:</strong>{" "}
    {negacion.relacionAfectada}
  </p>
)}

<p>{negacion.detalle}</p>

                      </div>
                    )
                  )}
                </div>
              ) : (
                <p>
                  No se detectó negación en este segmento.
                </p>
              )}
            </div>
          )
        )}
      </div>

      <div>
        <h4>Posible intención comunicativa</h4>
        <ul>
          {intenciones.map((intencion) => (
            <li key={intencion}>{intencion}</li>
          ))}
        </ul>
      </div>

      <div>
        <h4>Alcance y limitaciones</h4>
        <p>
          Este módulo separa segmentos mediante
          conectores sencillos y reconoce patrones
          textuales del español. No determina por
          completo el significado ni la estructura
          gramatical de la Lengua de Señas Colombiana.
          Los resultados son experimentales y requieren
          validación lingüística.
        </p>
      </div>
    </section>
  );
}
