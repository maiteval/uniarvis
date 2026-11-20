/* U.A.R.V.I.S. · Constantes y fuentes de la base en evidencia */
/* Cada número lleva su fuente o la marca ESTIMACIÓN DE DISEÑO. */
const EVIDENCE={
  sources:{
    sleepDebt:'Van Dongen et al. (2003), Sleep: la privación crónica de sueño acumula déficits de atención y rendimiento.',
    individualSleep:'Rupp et al. (2012), Sleep: la vulnerabilidad al sueño insuficiente es estable entre personas.',
    spacing:'Cepeda et al. (2008), Psychological Science: espaciar la práctica mejora la retención frente a agruparla.',
    retrieval:'Dunlosky et al. (2013), Psychological Science in the Public Interest: la práctica de recuperación y el espaciado tienen utilities altas; releer y subrayar, bajas.',
    interleaving:'Brunmair & Richter (2019), Psychological Bulletin: intercalar puede ayudar, con efectos moderados y dependientes del material.',
    microbreaks:'Albulescu et al. (2022), PLOS ONE: las micropausas mejoran vigor y fatiga; el efecto sobre rendimiento global no fue significativo.',
    breathing:'Balban et al. (2023), Cell Reports Medicine: respiración estructurada breve reduce activación fisiológica y mejora ánimo.',
    chronotype:'May, Hasher & Healey (2023), Perspectives on Psychological Science: el ajuste entre cronotipo y hora del día favorece tareas analíticas.'
  },
  capacity:{
    dayMinutes:840,                       // ESTIMACIÓN DE DISEÑO: día de estudio de 14 h.
    personalMinutes:360,                  // ESTIMACIÓN DE DISEÑO: 6 h reservadas a vida personal.
    studyShare:0.6,                       // ESTIMACIÓN DE DISEÑO: 60 % del tiempo disponible es estudiable.
    minBase:60,maxBase:270,round:15,      // ESTIMACIÓN DE DISEÑO: topes y granularidad de la base.
    energy:[0.45,0.7,0.9,1,1.05],         // ESTIMACIÓN DE DISEÑO: multiplicadores por nivel de energía.
    sleep:[0.8,0.9,1,1,1],                // ESTIMACIÓN DE DISEÑO: multiplicador inmediato por opción de sueño.
    moodLow:0.9,                          // ESTIMACIÓN DE DISEÑO: ánimo muy bajo reduce la capacidad.
    floor:0.35,                           // ESTIMACIÓN DE DISEÑO: piso del factor diario.
    sleepHours:[4.5,5.5,6.5,7.5,8.5],     // ESTIMACIÓN DE DISEÑO: horas aproximadas de cada opción del check-in.
    targetSleep:7.5,                      // ESTIMACIÓN DE DISEÑO: referencia para calcular deuda, sin excedentes.
    debtWindow:5,                         // ESTIMACIÓN DE DISEÑO: check-ins previos considerados.
    debtStepHours:2,                      // ESTIMACIÓN DE DISEÑO: cada 2 h de deuda...
    debtPenalty:0.05,                     // ESTIMACIÓN DE DISEÑO: ... quitan 5 %.
    debtMax:0.25,                         // ESTIMACIÓN DE DISEÑO: tope de penalización por deuda.
    calibrationMinDays:14,                // ESTIMACIÓN DE DISEÑO: días mínimos para calibrar por energía.
    calibrationMaxWeight:0.6,             // ESTIMACIÓN DE DISEÑO: peso máximo de la calibración personal.
    calibrationSampleCap:40,              // ESTIMACIÓN DE DISEÑO: muestras por nivel para alcanzar ese peso.
    calibrationMinFactor:0.35,            // ESTIMACIÓN DE DISEÑO: piso del ajuste personal.
    calibrationMaxFactor:1.1,             // ESTIMACIÓN DE DISEÑO: techo del ajuste personal.
    historyDays:21,historyMinSamples:5,   // ESTIMACIÓN DE DISEÑO: historial usado para ajustar la base.
    historyPercentile:0.8,historyBoost:1.15,historyMix:0.3,historyMaxGain:1.1,
    soft:0.75                             // ESTIMACIÓN DE DISEÑO: modo suave opcional, −25 %.
  },
  plan:{
    retrievalTitle:'Recordar sin mirar: escribe lo que sabes y luego revisa',
    minRecoverySessions:2,                // ESTIMACIÓN DE DISEÑO: al menos dos recuperaciones separadas.
    gapRatioMin:0.2,gapRatioMax:0.4,      // ESTIMACIÓN DE DISEÑO: separación creciente según días restantes.
    minGapDays:1,                         // ESTIMACIÓN DE DISEÑO: las recuperaciones no comparten día.
    mockBeforeMin:2,mockBeforeMax:4,      // ESTIMACIÓN DE DISEÑO: ventana del simulacro antes de la evaluación.
    eveMaxMinutes:45,                     // ESTIMACIÓN DE DISEÑO: tope de la noche anterior.
    interleaveMinTopics:2,
    interleaveHint:'Mezcla ejercicios de distintos temas en vez de hacer todos del mismo tipo seguidos',
    chronotypeLabels:{manana:'mañana',tarde:'tarde',noche:'noche',no_se:''}
  },
  breaks:{
    longAfterKinds:['simulacro','ejercicios'],
    longAfterBlocks:2,                    // ESTIMACIÓN DE DISEÑO: tras dos focos del mismo tipo, sugerir pausa larga.
    longMinMinutes:10                     // Albulescu et al. (2022): recuperar de tareas exigentes puede necesitar más de 10 min.
  },
  breathing:{
    suspiro:{name:'Suspiro cíclico',desc:'Dos inhalaciones cortas por la nariz y una exhalación larga. Es la opción por defecto: simple y breve.',ph:[['Inhala por la nariz',2,1.15],['Inhala un poco más',1,1.25],['Exhala lento por la boca',6,1]]},
    s478Caveat:'Tiene menos evidencia formal que el suspiro: es opcional para dormir y puedes respirar normal si te incomoda.'
  }
};
