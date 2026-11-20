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
    text:'Gestiona tus ramos, carga tu syllabus, registra fechas y notas, y revisa tu mapa de calor.'
  },
  {
    icon:'🗓️',
    title:'Planificación',
    text:'Revisa tu plan de hoy adaptado a tu capacidad y organiza tu semana en el calendario con tus clases y tareas.'
  },
  {
    icon:'🌿',
    title:'Bienestar',
    text:'Haz tu check-in diario, usa la respiración guiada, toma pausas rápidas y encuentra opciones de apoyo cuando lo necesites.'
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
      'Elige una sección (Bienestar, Académico, Planificación, Social o Ajustes).',
      'Revisa los avisos o recordatorios que aparezcan en la parte superior.',
      'Usa esta pantalla para orientarte y decidir por dónde empezar hoy.'
    ]
  },
  hoy:{
    title:'Hoy',
    desc:'Muestra tu plan del día ajustado a tu capacidad, tu mínimo viable y el avance de tus micro-tareas.',
    steps:[
      'Revisa la capacidad del día, que puedes ajustar con el check-in en Bienestar.',
      'Marca las micro-tareas realizadas y registra estudio libre si corresponde.',
      'Revisa tu mínimo, tu capacidad y las sugerencias o pausas del día.'
    ]
  },
  semana:{
    title:'Semana',
    desc:'Calendario semanal con tu horario de clases, fechas importantes y tareas planificadas.',
    steps:[
      'Navega entre semanas con las flechas o vuelve a la semana actual con "Hoy".',
      'Revisa clases, fechas y la carga planificada en cada día.',
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
      'Si eliges una micro-tarea de hoy, al terminar el foco se suman esos minutos como estudio.',
      'Crea mazos, importa tarjetas desde texto y repasa solo lo que toca hoy con las 5 cajas Leitner.'
    ]
  },
  salud:{
    title:'Mapa de calor',
    desc:'Visualiza cómo has distribuido tu estudio por ramo y detecta posibles desequilibrios frente a próximas fechas.',
    steps:[
      'Revisa el nivel de atención de cada ramo en los últimos días.',
      'Atiende las alertas si un ramo tiene poca atención y una fecha cercana.',
      'Úsalo como guía para reequilibrar tu estudio, no como una nota.'
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
  respiracion:{
    title:'Respiración',
    desc:'Herramientas breves de respiración guiada y meditaciones con temporizador para hacer una pausa consciente.',
    steps:[
      'Comienza con el suspiro cíclico (2-1-6), que es la técnica visible por defecto; 4-7-8 está en "Más opciones" y tiene menos evidencia formal.',
      'Sigue las indicaciones del círculo y los tiempos en pantalla.',
      'Abre "Más opciones" para otras respiraciones o para iniciar una meditación breve.'
    ]
  },
  pausas:{
    title:'Pausas rápidas',
    desc:'Sugerencias simples para descansar, moverte y cuidar tu energía durante el estudio.',
    steps:[
      'Revisa las tarjetas con ideas de pausas breves.',
      'Usa las pausas sugeridas según tu día o tus evaluaciones.',
      'Toma descansos cortos para sostener tu concentración y bienestar.'
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
    desc:'Define y actualiza tu nombre y carrera para personalizar tu experiencia en la app.',
    steps:[
      'Escribe o modifica tu nombre.',
      'Actualiza tu carrera o programa.',
      'Guarda los cambios para verlos reflejados en la app.'
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
