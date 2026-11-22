/* U.A.R.V.I.S. · Lectura de syllabus (PDF/texto) con confirmación del usuario */
/* ===================== Lectura de syllabus (siempre con confirmación) ===================== */
const MONTHS={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12,ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,sept:9,oct:10,nov:11,dic:12};
function guessType(l){
  const s=norm(l);
  if(/\b(control|quiz|test|prueba corta)\b/.test(s))return{t:'control',found:true};
  if(/(certamen|examen|solemne|prueba|parcial|evaluacion|exposicion|disertacion)/.test(s))return{t:'evaluacion',found:true};
  if(/(entrega|informe|proyecto|trabajo|tarea|taller|laboratorio|\blab\b|presentacion|ensayo|avance)/.test(s))return{t:'entrega',found:true};
  return{t:'otro',found:false};
}
/* PUNTO DE EXTENSIÓN: aquí puedes reemplazar esta heurística por una llamada a un LLM
   (por ejemplo la API de Claude desde tu backend) que devuelva el mismo formato de lista. */
function detectEvents(text,courseId){
  const year=new Date().getFullYear(),yesterday=addDays(today(),-1),out=[],seen=new Set();
  text.split(/\r?\n/).forEach(raw=>{
    const line=raw.replace(/\s+/g,' ').trim();
    if(line.length<6)return;
    let m,d,mo,y,mt=null,note='';
    if((m=line.match(/(\d{1,2})\s*(?:-|–|al|a)\s*\d{1,2}\s+de\s+([a-záéíóú]+)(?:\s+(?:de|del)\s+(\d{4}))?/i))&&MONTHS[norm(m[2])]){
      mo=MONTHS[norm(m[2])];d=+m[1];y=m[3]?+m[3]:year;mt=m[0];note='Es un rango de fechas: tomé el día de inicio';
    }
    if(!mt&&(m=line.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+(?:de|del)\s+(\d{4}))?/i))){
      mo=MONTHS[norm(m[2])];
      if(mo){d=+m[1];y=m[3]?+m[3]:year;mt=m[0]}
    }
    if(!mt&&(m=line.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/))){
      d=+m[1];mo=+m[2];y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):year;mt=m[0];
    }
    if(!mt||!mo||mo>12||d<1||d>31)return;
    const dt=new Date(y,mo-1,d);
    if(dt.getMonth()!==mo-1)return;
    const type=guessType(line);let keep=type.found;
    if(!type.found)note=(note?note+'. ':'')+'No reconocí el tipo: revísalo';
    const date=fmt(dt);
    if(date<yesterday){note=(note?note+'. ':'')+'La fecha ya pasó';keep=false}
    const title=line.replace(mt,'').replace(/^[\s\-–—:;,.|•·*]+|[\s\-–—:;,.|•·*]+$/g,'').slice(0,90)||TYPE_LABEL[type.t];
    const k=date+title;if(seen.has(k))return;seen.add(k);
    out.push({courseId,title,date,type:type.t,keep,note});
  });
  return out.sort((a,b)=>a.date.localeCompare(b.date));
}
async function loadPdfJs(){
  if(window.pdfjsLib)return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='vendor/pdf.min.js';
    s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';res()};
    s.onerror=()=>rej(new Error('No se pudo cargar el lector de PDF'));
    document.head.appendChild(s);
  });
}
async function pdfText(file){
  await loadPdfJs();
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  let out='';
  for(let p=1;p<=pdf.numPages;p++){
    const tc=await (await pdf.getPage(p)).getTextContent();
    let lastY=null,line='';
    for(const it of tc.items){
      const y=Math.round(it.transform[5]);
      if(lastY!==null&&Math.abs(y-lastY)>2){out+=line+'\n';line=''}
      line+=it.str+' ';lastY=y;
    }
    out+=line+'\n';
  }
  return out;
}
async function onFile(inp){
  const f=inp.files[0];if(!f)return;
  try{sylText=/\.pdf$/i.test(f.name)?await pdfText(f):await f.text();toast('Archivo leído. Pulsa "Analizar syllabus".');render()}
  catch(e){toast('No se pudo leer el archivo: '+e.message)}
}
function analyze(){
  if(!sylCourse)return toast('Primero elige el ramo del syllabus.');
  if(!sylText.trim())return toast('Sube un archivo o pega el texto del syllabus.');
  if(typeof certamenRememberSyllabus==='function')certamenRememberSyllabus(sylCourse,sylText);
  pending=detectEvents(sylText,sylCourse);
  if(pending.length&&typeof metricsTrack==='function')metricsTrack('syllabus_importado');
  if(!pending.length)toast('No encontré fechas. Revisa el formato o agrégalas manualmente.');
  render();
}
function addPending(){
  let n=0;
  pending.filter(p=>p.keep).forEach(p=>{
    if(S.events.some(e=>e.courseId===p.courseId&&e.date===p.date&&e.title===p.title))return;
    S.events.push({id:uid(),courseId:p.courseId,title:p.title,date:p.date,type:p.type});n++;
  });
  pending=[];sylText='';replanAll();
  toast(`${n} fechas confirmadas y agregadas; planifiqué las sesiones.`);render();
}
function setPending(i,k,v){pending[i][k]=v}

async function analyzeWithArvis(){
  if(typeof isInstitutional!=='function'||!isInstitutional()||typeof ArvisIA==='undefined')return;
  if(!sylCourse)return toast('Primero elige el ramo del syllabus.');
  if(!sylText.trim())return toast('Sube un archivo o pega el texto del syllabus.');
  sylAi=null;sylAiLoading=true;render();
  try{
    const r=await ArvisIA.extractSyllabus(sylText,sylCourse);
    sylAiLoading=false;
    if(!r)return toast('Arvis solo está disponible en modo institucional.');
    sylAi=r;render();
    toast(`${r.fechas.length} fecha(s), ${r.ponderaciones.length} ponderación(es) y ${r.contenidos.length} contenido(s) para revisar.`);
  }catch(e){sylAiLoading=false;render();toast('No se pudo analizar el syllabus: '+e.message)}
}
function cancelSyllabusAi(){sylAi=null;sylAiLoading=false;render()}
function setSylAiField(block,i,k,v){
  const row=sylAi&&sylAi[block]&&sylAi[block][i];if(!row)return;
  row[k]=(k==='peso'||k==='valor')?parseNum(v):v;
}
async function addSyllabusAi(){
  if(!sylAi||!sylCourse)return;
  const c=course(sylCourse);if(!c)return;
  let nFechas=0,nNotas=0;
  sylAi.fechas.filter(p=>p.keep).forEach(p=>{
    if(!p.date||!p.title)return;
    if(S.events.some(e=>e.courseId===p.courseId&&e.date===p.date&&e.title===p.title))return;
    S.events.push({id:uid(),courseId:p.courseId,title:p.title,date:p.date,type:p.type||'otro'});nFechas++;
  });
  const vistas=new Set();
  for(const p of sylAi.ponderaciones.filter(x=>x.keep)){
    const nombre=String(p.nombre||'').trim().slice(0,80),peso=clamp(Math.round((Number(p.peso)||0)*10)/10,0,100);
    if(nombre.length<2||peso<=0)continue;
    const key=norm(nombre);if(vistas.has(key))continue;vistas.add(key);
    const g=(c.grades||[]).find(x=>norm(x.name)===key);
    if(g){
      if(g.score!=null||g.weight===peso)continue;
      const si=typeof askConfirm==='function'?await askConfirm({title:'Actualizar ponderación',
        text:`«${nombre}» ya existe en Notas sin nota registrada (${comma(g.weight)} %). ¿Actualizamos el peso a ${comma(peso)} %?`,
        okLabel:'Actualizar peso'}):true;
      if(si)g.weight=peso;
      continue;
    }
    c.grades.push({id:uid(),name:nombre,weight:peso});nNotas++;
  }
  const pass=sylAi.reglas.find(r=>r.keep&&r.campo==='passGrade'&&Number(r.valor)>=1&&Number(r.valor)<=7);
  if(pass)c.passGrade=Math.round(Number(pass.valor)*100)/100;
  const lineas=[...sylAi.reglas.filter(r=>r.keep).map(r=>`Regla: ${String(r.texto||'').trim()}`),
    ...sylAi.contenidos.filter(r=>r.keep).map(r=>`Contenido: ${String(r.texto||'').trim()}`)]
    .filter(x=>x.length>8);
  const previo=String(c.syllabusNotes||'').trim();
  const nuevo=lineas.filter(x=>!previo.includes(x));
  c.syllabusNotes=(previo?previo+'\n':'')+nuevo.join('\n');
  c.syllabusNotes=c.syllabusNotes.slice(0,2000);
  sylAi=null;sylAiLoading=false;sylText='';
  replanAll();
  arvisCelebrar(`Listo: sumé ${nFechas} fecha(s), ${nNotas} evaluación(es) y guardé las notas del syllabus.`,'syllabus');
  toast(`${nFechas} fecha(s) y ${nNotas} evaluación(es) agregadas; revisé el plan y guardé las notas del ramo.`);
  render();
}
