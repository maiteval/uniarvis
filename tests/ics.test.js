// Uso: node tests/ics.test.js <ruta-al-html> <carpeta-temporal>
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');

(async()=>{
  const file=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1100,height:900}});
  const res=[],errs=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  await p.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await p.goto('file://'+file);

  const semanal=`BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:algebra@ejemplo\r
DTSTART:20260302T081000\r
DTEND:20260302T094000\r
SUMMARY:Álgebra Lineal aplicada con \r
  ejercicios de laboratorio\r
LOCATION:Sala 101\r
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:charla@ejemplo\r
DTSTART:20260305T110000\r
DTEND:20260305T120000\r
SUMMARY:Charla de orientación\r
END:VEVENT\r
END:VCALENDAR\r
`;
  const zonas=`BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
UID:santiago@ejemplo\r
DTSTART;TZID=America/Santiago:20260706T143000\r
DTEND;TZID=America/Santiago:20260706T160000\r
SUMMARY:Física\r
RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260720T235900\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:utc@ejemplo\r
DTSTART:20260706T180000Z\r
DTEND:20260706T193000Z\r
SUMMARY:UTC en invierno\r
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:ny@ejemplo\r
DTSTART;TZID=America/New_York:20260105T090000\r
DTEND;TZID=America/New_York:20260105T103000\r
SUMMARY:Invitado desde Nueva York\r
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2\r
END:VEVENT\r
END:VCALENDAR\r
`;
  const malformado='esto no es un calendario\nBEGIN:VEVENT\nDTSTART:fecha-rara\nSUMMARY:roto\nEND:VEVENT';

  // Parser: caso semanal con línea plegada y evento suelto
  const r1=await p.evaluate(s=>parseICS(s),semanal);
  const b1=r1.blocks[0]||{};
  ok('ICS semanal: agrupa un bloque por día y hora',r1.blocks.length===1&&b1.day===0&&b1.start==='08:10'&&b1.end==='09:40'&&b1.count===4,JSON.stringify(r1.blocks));
  ok('ICS semanal: lee SUMMARY plegado y LOCATION',b1.name==='Álgebra Lineal aplicada con ejercicios de laboratorio'&&b1.location==='Sala 101',JSON.stringify(b1));
  ok('ICS semanal: evento sin RRULE queda como posible evaluación',r1.evaluations.length===1&&r1.evaluations[0].title==='Charla de orientación'&&r1.evaluations[0].date==='2026-03-05',JSON.stringify(r1.evaluations));

  // Parser: TZID y UTC convertidos a hora local de Chile
  const r2=await p.evaluate(s=>parseICS(s),zonas);
  const porNombre=n=>r2.blocks.find(x=>x.name===n)||{};
  ok('ICS TZID: America/Santiago conserva la hora local',porNombre('Física').start==='14:30'&&porNombre('Física').end==='16:00',JSON.stringify(r2.blocks));
  ok('ICS TZID: otra zona se convierte a Chile',porNombre('Invitado desde Nueva York').start==='11:00',JSON.stringify(r2.blocks));
  ok('ICS Z: UTC se convierte a Chile (invierno)',porNombre('UTC en invierno').start==='14:00'&&porNombre('UTC en invierno').end==='15:30',JSON.stringify(r2.blocks));

  // Parser: malformado no lanza y no guarda nada
  const r3=await p.evaluate(s=>{try{return parseICS(s)}catch(e){return{error:e.message}}},malformado);
  ok('ICS malformado: no lanza excepciones',!r3.error&&Array.isArray(r3.blocks)&&Array.isArray(r3.evaluations),JSON.stringify(r3));
  ok('ICS malformado: no propone bloques',r3.blocks.length===0&&r3.warnings.length>0,JSON.stringify(r3.warnings));

  // Confirmación en la interfaz: no se guarda nada sin el botón
  const uiIcs=`BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
UID:m1@ejemplo\r
DTSTART:20260302T081000\r
DTEND:20260302T094000\r
SUMMARY:Matemáticas\r
RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=3\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:m2@ejemplo\r
DTSTART:20260304T101500\r
DTEND:20260304T114500\r
SUMMARY:Física\r
RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=3\r
END:VEVENT\r
END:VCALENDAR\r
`;
  const icsPath=path.join(tmp,'horario.ics');fs.writeFileSync(icsPath,uiIcs,'utf8');
  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Ana',career:'Medicina'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[]}];save();go('ramos');
  });
  ok('alta manual: aparece "Importar desde calendario (.ics)"',(await p.textContent('#app')).includes('Importar desde calendario (.ics)'));
  await p.setInputFiles('input[onchange="onICSFile(this)"]',icsPath);
  await p.waitForSelector('#ics-confirm');
  ok('ICS en interfaz: pide confirmación y no guarda todavía',await p.evaluate(()=>icsPending.length===2&&S.classes.length===0&&S.courses.length===1));
  await p.fill('#ics-name-0','Álgebra confirmada');
  await p.dispatchEvent('#ics-name-0','change');
  await p.selectOption('select[data-focus-id="ics-course-0"]','c1');
  await p.fill('#ics-name-1','Física aplicada');
  await p.dispatchEvent('#ics-name-1','change');
  await p.selectOption('select[data-focus-id="ics-course-1"]','new');
  await p.click('text=Confirmar y agregar al horario');
  const guardado=await p.evaluate(()=>({classes:S.classes.length,courses:S.courses.map(c=>c.name),names:S.classes.map(k=>cname(k.courseId)),pending:icsPending}));
  ok('ICS en interfaz: guarda solo lo confirmado, edita nombres y crea ramos',guardado.classes===2&&guardado.courses.length===2&&guardado.courses[1]==='Física aplicada'&&guardado.pending===null,JSON.stringify(guardado));

  const malPath=path.join(tmp,'malo.ics');fs.writeFileSync(malPath,malformado,'utf8');
  await p.setInputFiles('input[onchange="onICSFile(this)"]',malPath);
  await p.waitForTimeout(100);
  ok('ICS malformado en interfaz: no muestra confirmación',await p.locator('#ics-confirm').count()===0&&await p.evaluate(()=>S.classes.length===2));
  const bigPath=path.join(tmp,'grande.ics');fs.writeFileSync(bigPath,'BEGIN:VCALENDAR\n'+'X-PAD:'+'a'.repeat(2*1024*1024)+'\nEND:VCALENDAR\n','utf8');
  await p.setInputFiles('input[onchange="onICSFile(this)"]',bigPath);
  await p.waitForTimeout(100);
  const toastBig=await p.textContent('#toast');
  ok('ICS > 2 MB se rechaza sin guardar',toastBig.includes('pesa más de 2 MB')&&await p.evaluate(()=>S.classes.length===2),toastBig);

  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(r=>r.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
