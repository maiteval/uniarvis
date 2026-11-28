/* Textos del tour de bienvenida y ayuda contextual (editar aquí sin tocar componentes) */
const TOUR_SEEN_KEY='entrenador-academico-tour-seen-v1';

const TOUR_STEPS=[
  {
    icon:'👋',
    title:'Bienvenido a Uarvis',
    text:'Uarvis te ayuda a organizar tu semestre según tu energía y tu carga real, para que avances sin sobrecargarte.'
  },
  {
    icon:'📚',
    title:'Académico',
    text:'Gestiona tus ramos, carga tu syllabus y registra fechas y notas.'
  },
  {
    icon:'⏱️',
    title:'Herramientas',
    text:'Estudia con Pomodoro, repasa con flashcards y juega Arvis pregunta con tus diapositivas.'
  },
  {
    icon:'🗓️',
    title:'Planificación',
    text:'Revisa tu plan de hoy adaptado a tu capacidad y organiza tu semana en el calendario con tus clases y tareas.'
  },
  {
    icon:'🌿',
    title:'Bienestar',
    text:'Haz tu check-in diario y encuentra opciones de apoyo cuando lo necesites.'
  },
  {
    icon:'🤝',
    title:'Social',
    text:'Conecta con compañeros: agrega amigos para coordinar sesiones de estudio, crear sesiones y compartir fechas importantes.'
  },
  {
    icon:'⚙️',
    title:'Ajustes',
    text:'Personaliza tu perfil y la apariencia, gestiona tu privacidad y datos, y vuelve a ver este tutorial cuando quieras.'
  }
];

const AYUDA={
  inicio:{
    title:'Inicio',
    desc:'Punto de entrada para acceder rápidamente a las secciones principales de Uarvis y ver avisos importantes.',
    steps:[
      'Elige una sección (Bienestar, Académico, Herramientas, Planificación, Social o Ajustes).',
      'Revisa los avisos o recordatorios que aparezcan en la parte superior.',
      'Usa esta pantalla para orientarte y decidir por dónde empezar hoy.'
    ]
  },
  hoy:{
    title:'Hoy',
    desc:'Muestra tus sesiones de estudio del día, ajustadas a tu capacidad, tu mínimo viable y tu horario de clases.',
    steps:[
      'Revisa la capacidad del día, que puedes ajustar con el check-in en Bienestar.',
      'Cada sesión trae una instrucción concreta, una franja sugerida y el motivo por el que aparece; la hora es solo una sugerencia.',
      'Marca las sesiones realizadas, cuéntanos cómo te fue y registra estudio libre si corresponde.'
    ]
  },
  pregunta:{
    title:'Arvis pregunta',
    desc:'Una trivia armada con el texto de tus diapositivas (.pptx o PDF). El archivo se lee en tu dispositivo y no se sube a ningún servidor.',
    steps:[
      'Elige la presentación, el ramo (opcional) y cuántas preguntas quieres.',
      'Pulsa «Crear trivia»: cada pregunta tiene tiempo límite y suma puntos extra por rapidez y por racha.',
      'Al final revisa las que fallaste y pásalas a tus flashcards para repasarlas con repaso espaciado.'
    ]
  },
  horario:{
    title:'Mi horario',
    desc:'Tus actividades fuera de la universidad: deporte, trabajo, horas médicas u otras. El plan no pone sesiones de estudio en esos horarios.',
    steps:[
      'Elige el tipo de actividad y, si quieres, un nombre (en Salud no se guarda detalle).',
      'Indica si se repite todas las semanas (marca los días) o si es una sola fecha.',
      'Define el horario y agrégala: Hoy y Semana la mostrarán y el plan se ajusta solo.'
    ]
  },
  semana:{
    title:'Semana',
    desc:'Calendario semanal con tu horario de clases, fechas importantes y tus sesiones de estudio planificadas.',
    steps:[
      'Navega entre semanas con las flechas o vuelve a la semana actual con "Hoy".',
      'Revisa clases, fechas y la carga planificada en cada día; cada sesión muestra su franja sugerida.',
      'Identifica tramos exigentes para anticiparte y organizar mejor tu estudio.'
    ]
  },
  ramos:{
    title:'Ramos',
    desc:'Administra tus ramos, su dificultad y tu horario de clases para calcular una capacidad realista.',
    steps:[
      'Agrega un ramo con su nombre y dificultad.',
      'Registra tus clases indicando día y horario.',
      'Ajusta o elimina ramos y clases cuando cambie tu semestre.'
    ]
  },
  syllabus:{
    title:'Fechas',
    desc:'Extrae y registra fechas importantes desde un syllabus, y administra evaluaciones, entregas o controles.',
    steps:[
      'Selecciona el ramo y sube un archivo o pega el texto del syllabus.',
      'Analiza, revisa y confirma las fechas detectadas antes de agregarlas.',
      'Agrega fechas manualmente o exporta tu calendario cuando lo necesites.'
    ]
  },
  notas:{
    title:'Notas',
    desc:'Registra tus evaluaciones por ramo con nota y ponderación para ver tu promedio ponderado.',
    steps:[
      'Agrega una evaluación indicando nombre, nota y porcentaje.',
      'Edita los valores si cambian y elimina evaluaciones que no correspondan.',
      'Revisa el promedio actual y el porcentaje ponderado por ramo.'
    ]
  },
  herramientas:{
    title:'Herramientas',
    desc:'Pomodoro con fases configurables y flashcards con repaso espaciado para estudiar sin perder el hilo.',
    steps:[
      'Inicia un foco de 25 minutos (o ajusta los tiempos) y pausa, reinicia o salta de fase cuando lo necesites.',
      'Si eliges una sesión de hoy, al terminar el foco se suman esos minutos como estudio.',
      'Crea mazos, importa tarjetas desde texto y repasa solo lo que toca hoy con las 5 cajas Leitner.'
    ]
  },
  checkin:{
    title:'Check-in',
    desc:'Registra tu energía, ánimo y sueño para ajustar tu plan y ver patrones de bienestar en el tiempo.',
    steps:[
      'Marca tu energía, ánimo y sueño del día (y etiquetas o nota si quieres).',
      'Guarda el check-in para que la app ajuste tu capacidad y plan.',
      'Revisa patrones e historial para entender cómo te has sentido.'
    ]
  },
  apoyo:{
    title:'Apoyo',
    desc:'Información y accesos para buscar apoyo en tu universidad y líneas de ayuda disponibles.',
    steps:[
      'Guarda el contacto del servicio de apoyo de tu universidad si lo tienes.',
      'Revisa las líneas de ayuda y opciones de orientación disponibles.',
      'Recuerda que la app es una guía y no reemplaza a un profesional.'
    ]
  },
  amigos:{
    title:'Amigos',
    desc:'Coordina estudio con otras personas: agrega amigos, crea sesiones y comparte o importa fechas.',
    steps:[
      'Inicia sesión o prueba el modo demo para conocer la función.',
      'Comparte tu código o ingresa el de otra persona para agregar amigos.',
      'Crea sesiones de estudio y elige qué fechas de tus ramos compartir.'
    ]
  },
  perfil:{
    title:'Perfil',
    desc:'Define tu nombre y carrera, tu cronotipo y la duración de tus sesiones de estudio.',
    steps:[
      'Escribe o modifica tu nombre y tu carrera o programa.',
      'Elige tu franja de concentración y la duración de tus sesiones (45, 60 o 90 minutos).',
      'Guarda los cambios para que el plan se reorganice con tu preferencia.'
    ]
  },
  tema:{
    title:'Apariencia',
    desc:'Cambia el color y el modo (claro u oscuro) de la aplicación según tu preferencia.',
    steps:[
      'Elige un color de acento para la interfaz.',
      'Selecciona el modo claro u oscuro.',
      'Revisa la vista previa; tus cambios se guardan automáticamente.'
    ]
  },
  privacidad:{
    title:'Privacidad',
    desc:'Controla tus datos locales, el consentimiento del check-in, respaldos, cifrado y borrado de información.',
    steps:[
      'Revisa cómo se guardan tus datos y el estado de tu consentimiento.',
      'Descarga o restaura un respaldo cuando lo necesites.',
      'Gestiona el cifrado, revoca permisos o borra datos si corresponde.'
    ]
  },
  ejemplos:{
    title:'Datos de ejemplo',
    desc:'Carga datos ficticios para explorar cómo funciona Uarvis sin usar tu información personal.',
    steps:[
      'Lee la descripción de qué datos se cargarán.',
      'Presiona "Cargar datos de ejemplo" para probar la app.',
      'Recuerda que esto reemplaza tus datos actuales (puedes respaldar antes).'
    ]
  }
};
