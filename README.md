# U.A.R.V.I.S.

Una app de organización académica que **se adapta a cómo te sientes**. Tu check-in diario (energía, ánimo y sueño) cambia el plan del día, y la carga académica activa pausas y apoyo cuando se necesitan. Pensada para estudiantes universitarios, con foco en evitar el agotamiento (burnout).

![Plan del día](docs/screenshots/01-hoy.png)

Sin servidor ni cuenta **por defecto**: es HTML, CSS y JavaScript puro. Tus datos se quedan en tu navegador. Amigos es una función opcional que puedes activar con tu propio Supabase.

## La idea

Una agenda más un diario ya existen. Lo distinto aquí es que los dos lados se alimentan entre sí:

`
 check-in diario ──▶ capacidad realista del día ──▶ plan adaptado (mínimo viable o plan normal)
        ▲                                                      │
        └──────── alertas y apoyo ◀── patrones ◀── carga académica (semanas críticas, evaluaciones)
`

## Qué hace

**Ciclo central**
- **Check-in de 20 segundos**: energía, ánimo y sueño en una escala simple.
- **Arvis**, una mascota que aparece en el inicio y en momentos clave con mensajes cortos; su cara sigue la energía de tu check-in. Puedes ocultarlo desde **Ajustes → Apariencia**.
- **Plan del día adaptativo**: con energía baja muestra solo el mínimo viable y mueve el resto a otros días, sin que reorganices nada.
- **Capacidad realista por día**: no es un número fijo; se calcula con tus horas de clase, tu historial y tu check-in (ver abajo).

**Organización**
- **Syllabus**: subes un PDF (o pegas el texto), la app extrae fechas y evaluaciones y **te pide confirmar** antes de agregarlas, porque la extracción automática se equivoca.
- **Horario desde calendario (.ics)**: en *Ramos* subes un .ics de hasta 2 MB. Lee VEVENT semanales (RRULE, BYDAY, UNTIL/COUNT), líneas plegadas y zonas horarias (TZID y UTC → hora local de Chile) sin librerías ni envío del archivo. Los bloques repetitivos se muestran para **confirmar**: puedes marcarlos, editar el nombre y asignarlos a un ramo existente o crear uno nuevo; los eventos sueltos se listan aparte como posibles evaluaciones y no se guardan.
- **Notas con meta clara**: por ramo calcula la nota necesaria en lo que queda, muestra la próxima evaluación por fecha y avisa con calma si la ponderación no suma 100 %. La aprobación (4,0 por defecto) y el redondeo del promedio a un decimal son configurables; acepta `5,5` y `5.5` y siempre muestra coma decimal.
- **Herramientas** (en Académico): Pomodoro y flashcards con repaso espaciado, sin rachas, puntos ni récords.
- **Micro-tareas** de 15 a 30 min, con más tiempo y más anticipación para los ramos que más te cuestan.
- **Modo certamen**: cuando faltan 7 días o menos para una prueba, certamen, examen o control, ofrece cambiar esas micro-tareas por un plan por fases (teoría, ejercicios, ensayo cronometrado y repaso ligero). No se activa solo: eliges los temas, marcas los que te cuestan y puedes salir cuando quieras. Si la energía está baja prioriza el ensayo y los temas difíciles, y dice con calma qué quedó fuera. Con dos evaluaciones cerca reparte la capacidad según cercanía y dificultad, como en las semanas críticas.
- **Semanas críticas**: avisa hasta 4 semanas antes cuando se juntan 3 evaluaciones, entregas o controles en 5 días, y propone empezar antes.
- **Reprogramación sin culpa**: lo que no alcanzas se redistribuye solo; no hay lista de "atrasadas" ni rojos.
- **Calendario semanal** con tu horario de clases, y exportación de fechas a .ics (Google Calendar, Outlook, Apple).

**Salud mental**
- **Pausas ligadas al calendario**: respiración antes y después de una prueba, la noche previa y dentro de bloques largos de estudio.
- **Respiración guiada** (suspiro cíclico 2-1-6 por defecto; 4-7-8 y caja en "Más opciones") y **meditaciones breves** con temporizador en "Más opciones".
- **Diario con patrones**: cruza tu ánimo y energía con la carga. Son coincidencias en tus datos, no causas ni diagnósticos.
- **Alertas tempranas amables**: varios días seguidos de ánimo bajo, poco sueño, energía baja, 7 días sin descanso o varios días al tope de tu capacidad.
- **Derivación a ayuda real**: líneas de crisis de Chile (*4141, Salud Responde 600 360 7777) y un campo para el servicio de apoyo de tu universidad.

## Cómo se calcula tu capacidad del día

| Paso | Regla |
|---|---|
| Base | (840 − minutos de clase − 360) × 0,6, entre 60 y 270 min (día de 14 h, 6 h de vida personal, 60 % estudiable) |
| Sueño reciente | Cada 2 h por debajo de 7,5 h en los últimos 5 check-ins resta 5 %, hasta −25 %; no se compensa con energía alta |
| Calibración | Con 14 o más días de check-in y plan, la base se ajusta por tu ritmo real (peso máximo 0,6, factor 0,35–1,1) |
| Historial | Con 5 o más días de estudio en las últimas 3 semanas, la base se mezcla (70/30) con el percentil 80 de tus días de estudio × 1,15, con tope de +10 % |
| Check-in | Energía × 0,45 / 0,7 / 0,9 / 1 / 1,05 · sueño × 0,8 / 0,9 / 1 / 1 / 1 · ánimo bajo × 0,9 · piso 0,35 |
| Modo suave | −25 % durante 3 días (opcional, ofrecido cuando hay señales de cansancio) |
| Resultado | Redondeado a 15 min, mínimo 30 |

Con energía baja (nivel 1 o 2, o factor menor a 0,65) el plan de hoy se limita al **mínimo viable** (por defecto 60 min × el factor del día). La app muestra este desglose en "¿Cómo se calculó mi capacidad de hoy?".

## Base en evidencia

La app usa estas ideas como guía, no como receta clínica:

- **Sueño y deuda reciente:** la privación de sueño acumulada y la vulnerabilidad individual afectan el rendimiento; por eso el check-in baja la capacidad tras varias noches cortas y no la sube aunque la energía declarada sea alta.
- **Recuperación activa y espaciado:** la primera sesión de una fecha pide recordar sin mirar, y las recuperaciones se reparten en días distintos. El intercalado se ofrece como pista cuando hay al menos dos temas y ya estudiaste cada uno, sin imponerlo.
- **Descansos y cronotipo:** las pausas breves apoyan el bienestar; tras dos focos seguidos de simulacro o ejercicios se sugiere una pausa larga de más de 10 min. El cronotipo solo etiqueta la franja preferida, sin asumir horas exactas.
- **Respiración:** el suspiro cíclico es la opción por defecto porque tiene evidencia experimental reciente; 4-7-8 queda disponible como opcional y se explica que cuenta con menos evidencia formal.

Los porcentajes, ventanas de días, horarios y etiquetas son **estimaciones de diseño** para que la app sea útil y comprensible; no son umbrales clínicos ni garantías de rendimiento. Esta app no es tratamiento ni diagnóstico.

### Referencias

- Albulescu, P., Macsinga, I., Rusu, A., Sulea, C., Bodnaru, A., & Tulbure, B. T. (2022). "Give me a break!" A systematic review and meta-analysis on the efficacy of micro-breaks for increasing well-being and performance. *PLOS ONE, 17*(8), e0272460. https://doi.org/10.1371/journal.pone.0272460
- Balban, M. Y., Neri, E., Kogon, M. M., Weed, L., Nouriani, B., Jo, B., Holl, G., Zeitzer, J. M., Spiegel, D., & Huberman, A. D. (2023). Brief structured respiration practices enhance mood and reduce physiological arousal. *Cell Reports Medicine, 4*(1), 100895. https://doi.org/10.1016/j.xcrm.2022.100895
- Brunmair, M., & Richter, T. (2019). Similarity matters: A meta-analysis of interleaved learning and its moderators. *Psychological Bulletin, 145*(11), 1029–1052. https://doi.org/10.1037/bul0000209
- Cepeda, N. V., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095–1102. https://doi.org/10.1111/j.1467-9280.2008.02209.x
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology. *Psychological Science in the Public Interest, 14*(1), 4–58. https://doi.org/10.1111/j.1756-8765.2013.01214.x
- May, C. P., Hasher, L., & Healey, K. (2023). For whom (and when) the time bell tolls: Chronotypes and the synchrony effect. *Perspectives on Psychological Science, 18*(6), 1520–1536. https://doi.org/10.1177/17456916231178553
- Rupp, T. L., Wesensten, N. J., & Balkin, T. J. (2012). Trait-like vulnerability to total and partial sleep loss. *Sleep, 35*(8), 1163–1172. https://doi.org/10.5665/sleep.2010. Corrección: *Sleep, 36*(6), 959 (2013).
- Van Dongen, H. P. A., Maislin, G., Mullington, J. M., & Dinges, D. F. (2003). The cumulative cost of additional wakefulness: Dose-response effects on neurobehavioral functions and sleep physiology from chronic sleep restriction and total sleep deprivation. *Sleep, 26*(2), 117–126. https://doi.org/10.1093/sleep/26.2.117

## Notas y herramientas de estudio

**Notas.** La nota necesaria se calcula como `(nota de aprobación − Σ nota · peso rendido) / Σ peso pendiente`, suponiendo la misma nota en todas las evaluaciones que faltan. Si el resultado es 1,0 o menos, el ramo ya está aprobado con lo rendido; si supera 7,0 se dice con tono amable y se sugiere revisar un examen de repetición. El peso pendiente es el que falta para completar 100 % y la próxima evaluación se toma de las fechas del ramo ordenadas por fecha. Si las ponderaciones no suman 100 %, aparece un aviso informativo con cuánto falta o sobra, sin errores rojos.

**Pomodoro.** 25 min de foco, 5 de descanso corto y 15 de largo cada 4 focos, todo configurable. Tiene iniciar, pausar, reiniciar y saltar fase, y muestra la fase y el contador (por ejemplo, "Foco · 1 de 4"). El tiempo se calcula con marcas de tiempo (`Date.now()`), así que no se desfasa en segundo plano y retoma donde iba al recargar. Opcionalmente eliges un ramo o una micro-tarea de hoy: al terminar un foco se suman esos minutos como estudio. Tras dos focos seguidos de simulacro o ejercicios sugiere, sin obligar, una pausa larga de más de 10 min, y en los descansos ofrece la respiración por defecto de Bienestar. El sonido suave es opcional (Web Audio, sin archivos) y las notificaciones solo aparecen si ya hay permiso: nunca se pide desde aquí. No hay rachas, puntos ni récords.

**Flashcards.** Mazos por ramo o sin ramo: crear, renombrar, borrar con confirmación y exportar en texto (una tarjeta por línea, frente y reverso separados por tabulación). La importación acepta ese mismo formato o ` ; ` como separador, así que sirve para pegar desde Excel/Sheets o una exportación de Anki en texto. Frente y reverso respetan saltos de línea, hasta 1000 caracteres por lado y 5000 tarjetas en total. La importación muestra una vista previa antes de confirmar. El modo estudio usa Leitner de 5 cajas (1, 2, 4, 8 y 16 días): muestra solo lo que toca hoy con un tope configurable (20 por defecto), frente → "Mostrar respuesta" → "La sabía" (sube una caja) o "No la sabía" (vuelve a la caja 1). Al final da un resumen neutro: cuántas repasaste y cuántas vuelven mañana, sin porcentajes de fracaso ni rojos.

**Preparación en modo certamen.** La oferta aparece en *Planificación → Plan del día* y en *Académico → Fechas*. Al activarla se reemplazan las micro-tareas sueltas de esa fecha por bloques con casillas de avance por tema (teoría, ejercicios y repaso). La teoría se llama "Recordar sin mirar: escribe lo que sabes y luego revisa"; las tareas muestran su tipo y la franja del cronotipo cuando aplica, y el intercalado aparece solo como pista cuando hay temas suficientes. El ensayo cronometrado dura lo que indiques —por defecto 90 min o la duración de la evaluación— y se revisan errores el mismo día; la noche anterior es solo repaso ligero de hasta 45 min y la pausa nocturna que ya existe en Bienestar. Si faltan menos de 7 días, el plan se comprime de forma proporcional sin fechas pasadas. Si hay mazos del ramo, el plan ofrece "Repasar flashcards de este ramo", y cada bloque tiene "Empezar con Pomodoro" asociado. El plan se guarda en el respaldo y se conserva al restaurar; salir del modo devuelve las micro-tareas normales.

## Probarla

1. Abre index.html en tu navegador. Todo funciona, salvo instalarla y usarla sin conexión.
2. Para la versión completa, sírvela desde localhost:
   `ash
   python3 -m http.server 8000
   # abre http://localhost:8000
   `
   Así se puede **instalar** (PWA), usar **sin conexión** y activar el **cifrado con contraseña**.
3. En **Ajustes → Datos de ejemplo** hay un botón **Cargar datos de ejemplo** para ver todo en acción.

Al abrir la app aparece **Inicio**, con acceso a las secciones **Bienestar, Académico, Planificación, Social y Ajustes**. Cada sección tiene subpestañas (en móvil, una barra inferior fija y chips con desplazamiento lateral) y la ruta se guarda en la URL (#/academico/notas), así que recargar o usar Atrás vuelve al mismo lugar. El modo visual **Calma** es el predeterminado para perfiles nuevos; el estilo **HUD** sigue disponible en **Ajustes → Apariencia**. Si cambias de tema, modo o estilo, tu elección se conserva.

Al crear el perfil por primera vez se muestra directamente **Inicio**: no hay introducción de 3 pasos ni indicador de progreso. Para explorar la app sin datos propios, el botón **Cargar datos de ejemplo** está en **Académico → Ramos**, en **Académico → Fechas** y en **Ajustes → Datos de ejemplo**. El consentimiento del check-in se pide igual, la primera vez que abres **Bienestar → Check-in**. Los respaldos antiguos que traían campos de la introducción se restauran normalmente: esos campos se ignoran.

## Publicarla en GitHub Pages

1. Crea un repositorio y sube todos los archivos de esta carpeta (index.html debe quedar en la raíz).
2. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**, rama main, carpeta / (root).
3. En uno o dos minutos tendrás un enlace https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/.

## Privacidad y datos

Los datos de ánimo, sueño y energía son **datos sensibles**, y se tratan así:

- Por defecto todo se guarda **solo en tu navegador** (almacenamiento local). La app no hace peticiones externas: el lector de PDF viene incluido y los .ics de horario se parsean en el navegador, sin subir el archivo.
- **Amigos es opcional** y usa tu propio proyecto de Supabase. Si inicias sesión, al servidor van **solo**: tu nombre visible, tu código de amigo, tus relaciones de amistad, las fechas de los ramos que marques explícitamente como compartidos y tus sesiones de estudio.
- Sin Supabase configurado puedes probar **Amigos → Probar con datos de ejemplo**: todo vive en memoria, no se hace ninguna petición de red y nada de ese ejemplo entra en tu respaldo o en el cifrado. Solo una fecha importada desde un amigo se agrega a tus fechas reales.
- El check-in, la energía, el ánimo, el sueño, el diario, las notas personales, las calificaciones, los mazos de flashcards, la configuración del Pomodoro y lo que lee Arvis **nunca se envían al servidor**, incluso si usas Amigos, las estadísticas o los comentarios. No existe tabla para ellos allí.
- **Estadísticas de uso anónimas: desactivadas por defecto.** En **Ajustes → Privacidad** puedes activar «Compartir estadísticas de uso anónimas para mejorar Uarvis». Se crea un ID aleatorio sin relación con tu cuenta de Amigos ni con tu correo. Como máximo una vez al día se envía un lote a `usage_events` con el nombre del evento (solo los diez permitidos), la sección cuando aplica, el día sin hora, tu universidad y carrera solo si las completaste, y la versión de la app. Al desactivarlas se borran el ID y la cola. Sin Supabase o sin red no se envía nada y no aparece ningún error.
- **Comentarios:** en **Ajustes → Privacidad** puedes enviar un mensaje (máximo 1000 caracteres) con tipo idea/problema/otro, día, versión y universidad/carrera si las completaste. Con Supabase se guarda en `feedback`; sin Supabase puedes copiarlo al portapapeles.
- Puedes eliminar tu cuenta y los datos del servidor desde **Amigos → Eliminar mi cuenta y mis datos del servidor**. Eso no toca tus datos locales, ni tus preferencias de estadísticas (que se borran desde Ajustes → Privacidad).
- El check-in y el diario piden **consentimiento explícito** la primera vez que abres el check-in, en **Bienestar**. Si dices "Ahora no", la app funciona igual como organizador y puedes activarlo después en Bienestar o en **Ajustes → Privacidad**, donde también puedes revocarlo y borrar tus registros.
- **Cifrado opcional con contraseña** (AES-256-GCM, clave derivada con PBKDF2 de 250 000 iteraciones). Si olvidas la contraseña no hay forma de recuperar los datos: descarga un respaldo antes.
- **Respaldo y restauración** en JSON (cifrado si activaste el cifrado). La restauración valida el archivo y copia solo campos conocidos. La sesión de Supabase **no** se incluye en el respaldo.
- La universidad del perfil es nueva y opcional: perfiles y respaldos antiguos se migran con `university: ''`, sin inventar ningún dato.
- Sin rachas, puntos ni comparaciones de minutos: no se gamifica el bienestar.

La **Ley 21.719** de protección de datos personales de Chile (vigente desde el 1 de diciembre de 2026) aplica a lo que se guarda en el servidor si activas Amigos, las estadísticas o los comentarios. Esto no es asesoría legal. La configuración está en docs/SUPABASE.md.

## Modo institucional (prototipo)

La app ofrece al iniciar una pantalla para elegir **Personal** o **Institucional**. Puedes cambiar de modo en **Ajustes → Cuenta** sin borrar ramos, notas, diario ni calificaciones: solo cambian la apariencia, los contactos precargados y el calendario institucional.

- **Personal:** todo sigue funcionando como antes; los datos quedan solo en este dispositivo.
- **Institucional:** prototipo sin backend real. La única institución es la **Universidad de Concepción**. El acceso se simula validando que el correo termine en `@udec.cl` (no se envía nada: aquí irá el SSO con Google o Microsoft vía Supabase) y luego un consentimiento único. El catálogo está en `js/institutions.js`: agregar otra universidad es agregar un objeto. La interfaz usa solo el nombre de la universidad en texto, sin logo, y marca **«Prototipo»** y los contactos de ejemplo como **«Dato de ejemplo»**. El paso «Tus datos» incluye el cronotipo opcional.
- Los contactos de apoyo y las fechas del calendario (inicio y fin de clases, certámenes, recesos y feriados) son **ejemplos relativos a hoy**, marcados con `TODO: completar con datos oficiales de la UdeC`. Las líneas nacionales \*4141 y Salud Responde se muestran siempre. «Quiero que me contacten» abre un `mailto:` solo con nombre y correo; no incluye datos de bienestar ni hace peticiones de red.
- La **importación de ramos, horario, fechas y notas es simulada**: `js/institution-data.js` genera un semestre de ejemplo de Ingeniería Civil con `origin:'udec-demo'` y una espera de 1–2 s; no hace peticiones de red, no pide claves del portal del estudiante y nunca toca datos de bienestar. Tras el consentimiento se muestran los pasos y una vista previa para confirmar (o «Ahora no»). Los ramos que ya tienes se marcan «Ya lo tienes» y se omiten por defecto. Cada ramo importado queda con «Syllabus pendiente» hasta que subas su syllabus; no se borra ni se sobrescribe nada. En **Ajustes → Cuenta** puedes volver a importar, quitar solo los datos con `origin:'udec-demo'`, y al desconectarte elegir si los conservas. **Hacerla real requiere un convenio con la universidad, SSO institucional y una API oficial** (el `TODO` en `fetchInstitutionData` marca dónde se conectaría). El estudiante solo sube los syllabus por su cuenta.
- En modo institucional, las semanas de certámenes cuentan como semanas críticas; los feriados y recesos no reciben micro-tareas, y los ramos nuevos parten con nota de aprobación 4,0 (editable por ramo).
- **Privacidad:** el check-in, la energía, el ánimo, el sueño, el diario, las notas personales y las calificaciones **nunca salen del dispositivo**, también en modo institucional. El prototipo no envía esos datos a la universidad ni a ningún servidor. En **Ajustes → Perfil**, la universidad se completa sola desde la cuenta institucional y no se puede editar; en modo Personal puedes elegir entre universidades chilenas, «Otra» o «Prefiero no decir». «Prefiero no decir» nunca se envía en las estadísticas ni en los comentarios.

## Aviso importante

Esta app es una guía de organización y autocuidado. **No es un dispositivo médico, no diagnostica ni reemplaza a un profesional de la salud.** Los umbrales de las alertas son heurísticos y no están validados clínicamente. Si estás pasando un mal momento, habla con alguien de confianza o con el servicio de apoyo de tu universidad. En Chile, la Línea de Prevención del Suicidio es el **\*4141** y Salud Responde el **600 360 7777**.

## Estructura

`
index.html            página principal
css/styles.css        estilos (Calma/HUD, claro/oscuro, acentos)
js/util.js            fechas y utilidades
js/ics.js             parser de horarios .ics (sin librerías)
js/crypto.js          cifrado opcional con contraseña
js/state.js           estado y persistencia local
js/evidence.js        fuentes, constantes y estimaciones de diseño
js/institutions.js    catálogo institucional y flujo simulado (prototipo, sin red)
js/institution-data.js importación simulada de ramos, horario, fechas y notas (sin red)
js/capacity.js        capacidad realista del día
js/planner.js         micro-tareas, semanas críticas y modo certamen
js/wellbeing.js       check-in, alertas, pausas, respiración, patrones
js/arvis.js           mascota Arvis: mensajes y estados según energía
js/tools.js           Pomodoro y flashcards (Herramientas)
js/syllabus.js        lectura de syllabus (PDF/texto)
js/actions.js         acciones, respaldo, .ics, datos de ejemplo
js/views.js           vistas de cada sección
js/app.js             navegación por hash, render y arranque
js/config.js          URL y anon key de Supabase (vacías por defecto)
js/social-mock.js     backend en memoria para el modo demo de Amigos
js/social.js          Amigos: REST directo o capa demo, OTP, amistades, sesiones y fechas (opcional)
js/metrics.js         estadísticas de uso anónimas y comentarios (opcionales, apagados por defecto)
supabase/schema.sql   tablas, RLS, helpers, RPCs y vista semanal (lo ejecutas tú en el SQL Editor)
sw.js, manifest.webmanifest, icons/, icons/arvis/   app instalable y sin conexión
vendor/               pdf.js (Apache 2.0)
tests/                pruebas automáticas en un navegador real
docs/SUPABASE.md      guía para configurar Amigos
docs/screenshots/     capturas del README
`

## Pruebas

Las pruebas abren la app en Chromium y recorren los flujos reales: navegación por secciones y URL (incluida Herramientas), modo Calma predeterminado para perfiles nuevos, migración de perfiles existentes a HUD, capacidad y plan, modo de energía baja, semanas críticas, reprogramación, alertas, consentimiento, calculadora de notas (caso normal, ya aprobado, meta alta, ponderaciones que no suman 100 %, redondeo 3,95 → 4,0, coma decimal y próxima evaluación), Pomodoro (retoma tras recargar y descanso largo después de 4 focos), flashcards (importación con tabulación y con ` ; `, avance de cajas y fechas Leitner), modo certamen (plan de 7 días, compresión a 3 días, energía baja con prioridad y aviso sin culpa, dos evaluaciones repartiendo capacidad y salida del modo), Arvis (energía 5 y 1, sin check-in con enlace a Bienestar, interruptor de Ajustes, celebración, foco, alerta, estados vacíos y avatar de ayuda), lectura de un PDF, respaldo y restauración (incluidos los campos nuevos y un archivo malicioso), importación y exportación de .ics (caso semanal, TZID/UTC, archivo malformado, límite de 2 MB y confirmación en la interfaz), ausencia de introducción (y respaldos antiguos con esos campos, que se ignoran), botón de ejemplo en Ramos y Syllabus, consentimiento en Bienestar, funcionamiento sin conexión, cifrado, Amigos (con Supabase simulado mediante page.route(), incluida una comprobación de que nunca se envían datos de bienestar), estadísticas anónimas y comentarios (lista blanca, un lote por día, sin claves de bienestar/notas, borrado del ID al desactivar, sin red, copia sin Supabase y universidad institucional), base en evidencia (tipos de micro-tarea, espaciado, deuda de sueño, calibración, sección de fuentes, respiración por defecto y pausa larga tras dos focos exigentes) y el modo demo sin red.

`ash
npm install
npx playwright install chromium
npm test
`

Para regenerar las capturas de docs/screenshots:

`ash
npx playwright install chromium
npm run screenshots
`

## Licencia

MIT (ver LICENSE). Incluye [pdf.js](https://github.com/mozilla/pdf.js) bajo licencia Apache 2.0.
