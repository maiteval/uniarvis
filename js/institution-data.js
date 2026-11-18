/* U.A.R.V.I.S. · Importación simulada de datos institucionales (sin red) */
/* Forma documentada de fetchInstitutionData(institutionId, email):
   Devuelve { courses, classes, events }, todos con origin:'udec-demo'.
   courses: [{ id, name, code, section, color, difficulty, grades:[{ id, name, score, weight }], passGrade, roundFinal, origin }]
   classes: [{ id, courseId, day (0=Lun…4=Vie), start:'HH:MM', end:'HH:MM', origin, kind }]
   events:  [{ id, courseId, title, date:'YYYY-MM-DD', type, origin, kind }]
   Las notas (escala 1–7) van dentro de courses[].grades. Solo los eventos con fecha <= hoy llevan nota;
   los pendientes guardan su ponderación con score ausente. En cuatro ramos las ponderaciones suman 100%;
   Termodinámica deja un 20% libre para mostrar la nota necesaria. */
async function fetchInstitutionData(institutionId, email) {
  if ((typeof institutionById === 'function' && !institutionById(institutionId)) || !/^[^@\s]+@udec\.cl$/i.test(String(email || '').trim())) return null;
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.floor(Math.random() * 1001)));
  // TODO: con convenio, aquí se llama a la API oficial de la universidad con la sesión del SSO institucional. Nunca pedir ni guardar la clave del portal del estudiante.
  const t = today(), origin = 'udec-demo';
  const courseNames = ['Cálculo Numérico', 'Mecánica', 'Termodinámica', 'Ecuaciones Diferenciales', 'Inglés Técnico'];
  const courses = courseNames.map((name, i) => ({
    id: `udec-c${i + 1}`, name, code: ['MAT-201', 'FIS-210', 'FIS-305', 'MAT-310', 'ING-120'][i],
    section: `${['01', '02', '01', '03', '04'][i]}-${['2026-1', '2026-1', '2026-2', '2026-1', '2026-2'][i].replace('2026-', '2026/')}`,
    color: COLORS[i], difficulty: [5, 5, 4, 5, 2][i], grades: [], passGrade: 4, roundFinal: true, origin
  }));
  const classes = [];
  const addClass = (ci, day, start, end, kind) => classes.push({ id: `udec-k${classes.length + 1}`, courseId: courses[ci].id, day, start, end, origin, kind });
  [[0, 0, '08:10', '09:40', 'catedra'], [0, 2, '08:10', '09:40', 'catedra'], [0, 4, '11:30', '12:35', 'ayudantia'],
   [1, 0, '10:15', '11:45', 'catedra'], [1, 1, '14:30', '16:00', 'laboratorio'], [1, 3, '10:15', '11:45', 'catedra'],
   [2, 1, '08:10', '09:40', 'catedra'], [2, 3, '08:10', '09:40', 'catedra'], [2, 4, '14:30', '16:00', 'laboratorio'],
   [3, 0, '14:30', '16:00', 'catedra'], [3, 2, '14:30', '16:00', 'catedra'], [3, 4, '08:10', '09:20', 'ayudantia'],
   [4, 1, '11:30', '12:35', 'catedra'], [4, 3, '11:30', '12:35', 'catedra'], [4, 4, '10:15', '11:15', 'ayudantia']
  ].forEach(args => addClass(...args));

  const weights = [[20, 20, 15, 20, 25], [20, 15, 15, 10, 10, 30], [20, 20, 20, 10, 10], [15, 15, 15, 30, 10, 15], [20, 20, 40, 20]];
  const events = [], addEvent = (ci, offset, title, type, kind, score) => {
    const date = addDays(t, offset), id = `udec-e${events.length + 1}`;
    events.push({ id, courseId: courses[ci].id, title, date, type, origin, kind });
    courses[ci].grades.push({ id: `udec-g${ci + 1}-${events.length}`, name: title,
      ...(score != null ? { score } : {}), weight: weights[ci][courses[ci].grades.length] });
  };
  [[0, -35, 'Certamen 1', 'evaluacion', 'certamen', 6.4], [0, -21, 'Control 1', 'control', 'control', 6.0],
   [0, -7, 'Tarea 1', 'entrega', 'tarea', 6.2], [0, 5, 'Certamen 2', 'evaluacion', 'certamen', null],
   [0, 42, 'Certamen 3', 'evaluacion', 'certamen', null],
   [1, -28, 'Certamen 1', 'evaluacion', 'certamen', 4.2], [1, -14, 'Laboratorio 1', 'entrega', 'laboratorio', 4.0],
   [1, 4, 'Certamen 2', 'evaluacion', 'certamen', null], [1, 6, 'Control 2', 'control', 'control', null],
   [1, 8, 'Tarea 2', 'entrega', 'tarea', null], [1, 49, 'Certamen 3', 'evaluacion', 'certamen', null],
   [2, -30, 'Test 1', 'control', 'test', 5.8], [2, -16, 'Control 1', 'control', 'control', 6.0],
   [2, -2, 'Informe de laboratorio', 'entrega', 'laboratorio', 6.0],    [2, 3, 'Certamen 1', 'evaluacion', 'certamen', null],
   [2, 56, 'Certamen 2', 'evaluacion', 'certamen', null],
   [3, -33, 'Certamen 1', 'evaluacion', 'certamen', 3.2], [3, -19, 'Control 1', 'control', 'control', 3.0],
   [3, -5, 'Tarea 1', 'entrega', 'tarea', 3.4], [3, 25, 'Certamen 2', 'evaluacion', 'certamen', null], [3, 28, 'Control 2', 'control', 'control', null],
   [3, 63, 'Certamen 3', 'evaluacion', 'certamen', null],
   [4, -26, 'Test 1', 'control', 'test', 6.5], [4, -12, 'Tarea 1', 'entrega', 'tarea', 6.7],
   [4, 34, 'Test 2', 'control', 'test', null], [4, 70, 'Certamen 1', 'evaluacion', 'certamen', null]
  ].forEach(args => addEvent(...args));
  courses.forEach(c => { c.grades.sort((a, b) => a.name.localeCompare(b.name)); });
  return { courses, classes, events };
}
