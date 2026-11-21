/* U.A.R.V.I.S. · Planificación por temas (solo modalidad institucional · IA SIMULADA)
   - Lee los contenidos del syllabus (course.syllabusNotes, líneas "Contenido: …") y arma un mapa de temas por evaluación.
   - El estudiante marca cuánto domina cada tema; las sesiones dicen QUÉ tema estudiar, no solo cuánto tiempo.
   - Cada tema se repasa en días distintos (recuperación espaciada) y cerca de la fecha se intercalan temas y hay un simulacro.
   - Todo se calcula en el dispositivo, sin red.
   TODO (versión con licencia): ArvisIA.buildTopicMap y ArvisIA.planStudy se reemplazan por un modelo de lenguaje vía
   Supabase Edge Function, enviando solo temas, fechas, pesos y dominio (nunca datos de bienestar). */

const TOPIC_MAX_PER_COURSE=60,TOPIC_NAME_MAX=120,TOPIC_HISTORY_MAX=20;
const TOPIC_MASTERY_LABEL=['No lo he visto','Más o menos','Lo domino'];
const TOPIC_MASTERY_FACTOR=[1.5,1.0,0.4];
let topicPlanWarnings={};                  // eventId → aviso cuando no alcanzan las horas (se recalcula en cada replanificación)
let topicEditEvent=null;                   // evaluación con el formulario "escribir temas" abierto

const topicsOn=()=>typeof isInstitutional==='function'&&isInstitutional();
const topicList=()=>Array.isArray(S.topics)?S.topics:(S.topics=[]);
const topicById=id=>topicList().find(t=>t.id===id)||null;
const courseTopics=cid=>topicList().filter(t=>t.courseId===cid);
const topicIsExam=e=>!!e&&(e.type==='evaluacion'||e.type==='control'||(e.type==='otro'&&/(prueba|certamen|examen|control)/.test(norm(e.title))));
const topicIsFinal=e=>/\b(examen|final)\b/.test(norm(e.title||''));
const topicNames=ids=>(ids||[]).map(topicById).filter(Boolean).map(t=>t.name);
const topicJoin=names=>names.length<=1?(names[0]||''):names.slice(0,-1).join(', ')+' y '+names[names.length-1];

/* ---------- Lectura de temas desde el syllabus ---------- */
const ROMAN={i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9,x:10};
const toUnitNum=s=>{s=norm(String(s||'')).trim();if(/^\d{1,2}$/.test(s))return +s;return ROMAN[s]||null};
function parseTopicLine(raw){
  let line=String(raw||'').replace(/\s+/g,' ').trim().replace(/^contenido\s*:\s*/i,'').replace(/^[-•*·]\s*/,'');
  if(line.length<3)return [];
  let unit=null,week=null;
  const m=line.match(/^(semana|unidad|m[oó]dulo|tema|cap[ií]tulo)\s*([0-9]{1,2}|[ivx]{1,4})\b\s*(?:[:.–—-]\s*)?(.*)$/i);
  let rest=line;
  if(m){
    const kind=norm(m[1]),n=toUnitNum(m[2]);
    if(kind==='semana')week=n;else unit=n;
    rest=m[3]||'';
    const m2=rest.match(/^(?:\(?\s*semana\s*(\d{1,2})\s*\)?\s*[:.–—-]?\s*)(.*)$/i);
    if(m2){week=+m2[1];rest=m2[2]||''}
    if(!rest.trim())rest=`${m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase()} ${m[2]}`;
  }
  const wk=rest.match(/\(\s*semanas?\s*(\d{1,2})(?:\s*[-–a]\s*\d{1,2})?\s*\)/i);
  if(wk){week=week||+wk[1];rest=rest.replace(wk[0],'').trim()}
  if(/\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+de\s+[a-z]/i.test(rest)&&!m)return [];   // líneas con fechas no son temas
  const parts=rest.split(/\s*[;,]\s*|\s+y\s+(?=[A-ZÁÉÍÓÚÑ])/).map(x=>x.trim()).filter(x=>x.length>=3);
  const names=parts.length>=2&&parts.every(x=>x.length<=60)?parts:[rest.trim()];
  return names.filter(n=>n.length>=3).map(n=>({name:(n.charAt(0).toUpperCase()+n.slice(1)).replace(/[.\s]+$/,'').slice(0,TOPIC_NAME_MAX),unit,week}));
}
function syllabusTopicLines(c){
  const lines=String(c.syllabusNotes||'').split(/\r?\n/).filter(l=>/^contenido\s*:/i.test(l.trim()));
  if(lines.length)return lines;
  const sug=typeof certamenSuggestions==='function'?certamenSuggestions(c.id):[];
  return sug.map(x=>'Contenido: '+x);
}
function addTopic(courseId,data,source){
  const list=courseTopics(courseId),key=norm(data.name);
  const found=list.find(t=>norm(t.name)===key);
  if(found){if(found.unit==null&&data.unit!=null)found.unit=data.unit;if(found.week==null&&data.week!=null)found.week=data.week;return found}
  if(list.length>=TOPIC_MAX_PER_COURSE)return null;
  const t={id:uid(),courseId,name:String(data.name).slice(0,TOPIC_NAME_MAX),unit:data.unit??null,week:data.week??null,
    mastery:0,lastStudied:null,history:[],source:source||'syllabus'};
  topicList().push(t);return t;
}
function syncCourseTopics(c){
  syllabusTopicLines(c).forEach(l=>parseTopicLine(l).forEach(d=>addTopic(c.id,d,'syllabus')));
}

/* ---------- Asignación de temas a evaluaciones ---------- */
function semesterWeek(date){
  const inst=typeof currentInstitution==='function'?currentInstitution():null;
  const cal=inst&&typeof institutionCalendar==='function'?institutionCalendar(inst):null;
  if(!cal||!cal.classesStart)return null;
  return Math.floor(diffDays(cal.classesStart,date)/7)+1;
}
function unitsFromText(title){
  const t=norm(title||''),out=new Set();
  const m=t.match(/\b(?:unidad(?:es)?|u)\s*([0-9ivx]{1,4}(?:\s*(?:,|y|-|–|a|al)\s*(?:u\s*)?[0-9ivx]{1,4})*)/);
  if(!m)return out;
  const tokens=m[1].split(/\s*(,|y|-|–|al|a)\s*/).filter(Boolean);
  let prev=null,range=false;
  tokens.forEach(tok=>{
    if(/^(-|–|a|al)$/.test(tok)){range=true;return}
    if(tok===','||tok==='y'){range=false;return}
    const n=toUnitNum(tok.replace(/^u/,''));if(!n)return;
    if(range&&prev!=null){for(let i=prev+1;i<=n&&i-prev<=12;i++)out.add(i)}else out.add(n);
    prev=n;range=false;
  });
  return out;
}
function assignCourseTopics(c){
  const topics=courseTopics(c.id),exams=S.events.filter(e=>e.courseId===c.id&&topicIsExam(e)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!exams.length)return;
  const auto=exams.filter(e=>!e.topicsManual);
  if(!topics.length){auto.forEach(e=>{e.topicIds=[]});return}
  const partial=exams.filter(e=>!topicIsFinal(e));
  const assigned=new Map(auto.map(e=>[e.id,[]]));
  const used=new Set();
  auto.forEach(e=>{                                            // 1) el título dice qué unidades entran
    if(topicIsFinal(e)){assigned.set(e.id,topics.map(t=>t.id));return}
    const units=unitsFromText(e.title);
    if(units.size){topics.filter(t=>t.unit!=null&&units.has(t.unit)).forEach(t=>{assigned.get(e.id).push(t.id);used.add(t.id)})}
  });
  const free=auto.filter(e=>!topicIsFinal(e)&&!unitsFromText(e.title).size);
  if(free.length){
    const weeks=new Map(partial.map(e=>[e.id,semesterWeek(e.date)]));
    const rest=topics.filter(t=>!used.has(t.id));
    const withWeek=rest.filter(t=>t.week!=null),noWeek=rest.filter(t=>t.week==null);
    withWeek.forEach(t=>{                                       // 2) por semana: la primera evaluación que llega después del tema
      const target=partial.find(e=>weeks.get(e.id)!=null&&weeks.get(e.id)>=t.week)||partial[partial.length-1];
      if(target&&assigned.has(target.id))assigned.get(target.id).push(t.id);
    });
    if(noWeek.length){                                          // 3) sin semana: por unidad u orden de aparición, repartido parejo
      const units=[...new Set(noWeek.map(t=>t.unit==null?999:t.unit))].sort((a,b)=>a-b);
      const groups=units.map(u=>noWeek.filter(t=>(t.unit==null?999:t.unit)===u));
      const ordered=groups.length>1?groups:[noWeek];
      const flat=ordered.length===1?noWeek.map(t=>[t]):ordered;
      const n=free.length;
      flat.forEach((g,i)=>{const e=free[Math.min(n-1,Math.floor(i*n/flat.length))];g.forEach(t=>assigned.get(e.id).push(t.id))});
    }
  }
  auto.forEach(e=>{e.topicIds=[...new Set(assigned.get(e.id)||[])].slice(0,TOPIC_MAX_PER_COURSE)});
}
function topicsSync(){
  if(!topicsOn())return {courses:0,topics:0};
  const ids=new Set(topicList().map(t=>t.id));
  S.courses.forEach(c=>{syncCourseTopics(c);assignCourseTopics(c)});
  S.events.forEach(e=>{if(Array.isArray(e.topicIds))e.topicIds=e.topicIds.filter(id=>topicById(id))});
  return {courses:S.courses.length,topics:topicList().length,nuevos:topicList().filter(t=>!ids.has(t.id)).length};
}
const eventTopics=ev=>(ev&&Array.isArray(ev.topicIds)?ev.topicIds:[]).map(topicById).filter(Boolean);

/* ---------- Plan por temas ---------- */
const topicPlanApplies=ev=>topicsOn()&&topicIsExam(ev)&&eventTopics(ev).length>0;
const round5=m=>Math.max(15,Math.round(m/5)*5);
function topicHint(kind,names,n){
  const a=`«${topicJoin(names)}»`;
  const h={
    nuevo:`Primera pasada de ${a}: lee la materia, resume en 5 ideas clave y anota tus dudas.`,
    recuperar:`Sin apuntes: escribe todo lo que recuerdas de ${a} y luego compara con tus resúmenes.`,
    ejercicios:`Resuelve ejercicios mezclando ${a} sin mirar la solución; marca los que te costaron.`,
    simulacro:`Ensayo con tiempo que cubra los ${n} temas, como si fuera la evaluación. Corrige al final.`,
    repaso_ligero:`Repaso suave de ${a}: resúmenes y errores frecuentes. Duerme bien.`
  };
  return (h[kind]||h.ejercicios).slice(0,160);
}
function topicWhy(ev,kind,topics,imp){
  const weak=topics.filter(t=>t.mastery===0),mid=topics.filter(t=>t.mastery===1);
  let s='';
  if(kind==='simulacro')s=`El simulacro junta todo el temario de «${ev.title}» antes de la fecha`;
  else if(weak.length)s=`${weak.length>1?'Los marcaste':'Lo marcaste'} como «No lo he visto» y ${weak.length>1?'entran':'entra'} en «${ev.title}»`;
  else if(mid.length)s=`${topicJoin(mid.map(t=>'«'+t.name+'»'))} ${mid.length>1?'están':'está'} «más o menos» y ${mid.length>1?'entran':'entra'} en «${ev.title}»`;
  else s=`Repasar a distancia mantiene fresco lo que ya dominas para «${ev.title}»`;
  if(imp.weight!=null)s+=`, que vale ${comma(String(imp.weight))} %`;
  s+='.';
  if(imp.need!=null&&imp.need>1)s+=` Necesitas ~${Number(imp.need).toFixed(1).replace('.',',')} para aprobar.`;
  return s.slice(0,240);
}
function topicTitle(ev,kind,names){
  const cn=cname(ev.courseId);
  if(kind==='simulacro')return `${cn} · Simulacro de todo el temario`;
  if(kind==='nuevo'&&names.length===1)return `${cn} · ${names[0]} (primera vez)`;
  const label={nuevo:'Primera vez',recuperar:'Repaso',ejercicios:'Ejercicios',repaso_ligero:'Repaso ligero'}[kind]||'Repaso';
  return `${cn} · ${label}: ${names.join(' + ')}`.slice(0,300);
}
function planEventTopics(ev){
  const t0=today(),c=course(ev.courseId),diff=c?c.difficulty:3,imp=importanceFor(ev),eve=addDays(ev.date,-1);
  const topics=eventTopics(ev).slice().sort((a,b)=>a.mastery-b.mastery||(a.unit??99)-(b.unit??99)||(a.week??99)-(b.week??99));
  const M=topics.length,size=sessionMin();
  const perTopic=30+(clamp(diff,1,5)-1)*7.5;
  const lead=Math.min(42,7+3*diff+Math.ceil(M*1.5)+(ev.early?7:0));
  const s0=addDays(ev.date,-lead),start=s0>t0?s0:t0;
  if(ev.date<=t0)return 0;
  const noTask=planNoTaskDates();
  const days=[];for(let d=start;d<=eve;d=addDays(d,1))if(!noTask.includes(d))days.push(d);
  if(!days.length)return 0;
  const isBig=ev.type==='evaluacion'||topicIsFinal(ev);
  const mockDay=isBig?(days.filter(d=>{const l=diffDays(d,ev.date);return l>=2&&l<=4})[0]||null):null;
  const study=days.filter(d=>d!==eve&&d!==mockDay);
  const pool=study.length?study:days;
  const doneBy=new Map();                                         // lo ya estudiado de cada tema para esta evaluación
  S.tasks.filter(x=>x.done&&x.eventId===ev.id&&Array.isArray(x.topicIds)).forEach(x=>x.topicIds.forEach(id=>doneBy.set(id,(doneBy.get(id)||0)+1)));
  // Pasadas por tema según dominio: siempre al menos 2 en días distintos
  const chunks=[];let totalMin=0;
  topics.forEach((tp,i)=>{
    const budget=perTopic*TOPIC_MASTERY_FACTOR[tp.mastery]*paceFactor()*imp.factor;
    const passes=tp.mastery===0?[['nuevo',0.5],['recuperar',0.25],['ejercicios',0.25]]:
      tp.mastery===1?[['ejercicios',0.5],['recuperar',0.5]]:[['recuperar',0.5],['recuperar',0.5]];
    const already=doneBy.get(tp.id)||0;
    passes.slice(Math.min(already,passes.length-2)).forEach(([kind,share],k)=>{
      const m=round5(budget*share);totalMin+=m;
      chunks.push({topic:tp,kind,minutes:m,pass:k,order:i});
    });
  });
  // Rondas: 1) primera pasada, 2) recuperación a distancia, 3) ejercicios intercalados cerca de la fecha.
  // Cada ronda se empaqueta en sesiones de verdad (1 a 3 temas, cerca de la duración elegida), no en bloques sueltos.
  const room=days.reduce((a,d)=>a+Math.max(0,dayBudget(d,eve,false)-sessionState(d).load),0);
  delete topicPlanWarnings[ev.id];
  let plan=chunks;
  if(totalMin>room&&room>0){                                     // no alcanza: priorizar temas sin ver y avisar
    const keep=[];let acc=0;
    plan.slice().sort((a,b)=>a.topic.mastery-b.topic.mastery||a.pass-b.pass).forEach(ch=>{
      if(acc+ch.minutes<=room||ch.pass<2){keep.push(ch);acc+=ch.minutes}
    });
    plan=keep;
    const prio=topics.filter(t=>t.mastery===0).slice(0,2).map(t=>t.name);
    topicPlanWarnings[ev.id]=`No alcanzan las horas para todos los temas de ${cname(ev.courseId)}: te propongo priorizar ${topicJoin(prio.length?prio:topics.slice(0,2).map(t=>t.name))}.`;
  }
  const maxPack=Math.min(SESSION_MAX_MERGE,size+15);
  const packRound=list=>{
    const out=[];let cur=null;
    list.sort((a,b)=>a.order-b.order).forEach(ch=>{
      const cabe=cur&&(cur.minutes+ch.minutes<=maxPack||(cur.minutes<45&&cur.minutes+ch.minutes<=SESSION_MAX_MERGE));   // evita sesiones cortas sueltas
      if(!cur||cur.topicIds.length>=3||cur.topicIds.includes(ch.topic.id)||!cabe){
        if(cur)out.push(cur);cur={minutes:0,topicIds:[],kinds:[]};
      }
      cur.minutes+=ch.minutes;cur.topicIds.push(ch.topic.id);cur.kinds.push(ch.kind);
    });
    if(cur)out.push(cur);
    if(out.length>1&&out[out.length-1].minutes<30){                // sin restos cortos: se suma a la sesión anterior si cabe
      const last=out.pop(),prev=out[out.length-1];
      if(prev.topicIds.length+last.topicIds.length<=3&&prev.minutes+last.minutes<=SESSION_MAX_MERGE&&!last.topicIds.some(id=>prev.topicIds.includes(id))){
        prev.minutes+=last.minutes;prev.topicIds.push(...last.topicIds);prev.kinds.push(...last.kinds);
      }else out.push(last);
    }
    return out;
  };
  const rounds=[0,1,2].map(k=>packRound(plan.filter(ch=>ch.pass===k))).filter(r=>r.length);
  const L=pool.length,R=rounds.length,blocks=[];
  const spans=R===1?[[0,1]]:R===2?[[0,0.5],[0.5,1]]:[[0,0.45],[0.45,0.75],[0.75,1]];
  rounds.forEach((round,r)=>{
    const [fa,fb]=spans[r],lo=Math.min(L-1,Math.floor(fa*L)),hi=Math.max(lo,Math.min(L-1,Math.ceil(fb*L)-1));
    round.forEach((ses,i)=>{
      const idx=lo+Math.floor(i*(hi-lo+1)/round.length);
      blocks.push({...ses,date:pool[Math.min(L-1,idx)]});
    });
  });
  if(mockDay&&M)blocks.push({date:mockDay,minutes:Math.min(90,Math.max(size,ev.type==='control'?45:60)),topicIds:topics.slice(0,3).map(t=>t.id),kinds:['simulacro'],all:true});
  if(days.includes(eve)&&M)blocks.push({date:eve,minutes:Math.min(45,EVIDENCE.plan.eveMaxMinutes),topicIds:topics.slice(0,3).map(t=>t.id),kinds:['repaso_ligero']});
  const KIND_PRIORITY=['simulacro','repaso_ligero','nuevo','ejercicios','recuperar'];
  const sessions=blocks.map(b=>{
    const kind=KIND_PRIORITY.find(k=>b.kinds.includes(k))||'recuperar';
    const ts=b.topicIds.map(topicById).filter(Boolean),names=ts.map(t=>t.name);
    return {date:b.date,minutes:Math.min(SESSION_MAX_MERGE,round5(b.minutes)),kind,eventId:ev.id,courseId:ev.courseId,topicIds:b.topicIds.slice(0,3),
      title:topicTitle(ev,kind,names),hint:topicHint(kind,names,M),why:topicWhy(ev,kind,ts,imp)};
  });
  return allocateSessions(sessions,{days,noTask,eveDate:eve,last:eve,topics:true});
}

/* ---------- Cobertura y semana ---------- */
function topicCoverage(ev){
  const ts=eventTopics(ev),total=ts.length;
  if(!total)return {covered:0,total:0,pct:0};
  const studied=new Set();
  S.tasks.filter(x=>x.done&&Array.isArray(x.topicIds)).forEach(x=>x.topicIds.forEach(id=>studied.add(id)));
  const covered=ts.filter(t=>studied.has(t.id)||t.mastery===2).length;
  return {covered,total,pct:Math.round(covered/total*100)};
}
function weekPlanSync(){
  if(!topicsOn())return null;
  const t0=today(),end=addDays(t0,6);
  const tasks=S.tasks.filter(x=>!x.done&&x.date>=t0&&x.date<=end);
  const porRamo={};
  tasks.forEach(x=>{
    const r=porRamo[x.courseId]=porRamo[x.courseId]||{min:0,nuevos:[],repasos:[]};
    r.min+=x.minutes;
    topicNames(x.topicIds).forEach(n=>{
      const arr=x.kind==='nuevo'?r.nuevos:r.repasos;
      if(!arr.includes(n)&&!(x.kind!=='nuevo'&&r.nuevos.includes(n)))arr.push(n);
    });
  });
  const metas=Object.entries(porRamo).sort((a,b)=>b[1].min-a[1].min).map(([cid,r])=>{
    const partes=[];
    if(r.nuevos.length)partes.push(`ver ${topicJoin(r.nuevos.slice(0,3))}`);
    if(r.repasos.length)partes.push(`repasar ${topicJoin(r.repasos.slice(0,3))}`);
    if(!partes.length)partes.push('avanzar con las sesiones planificadas');
    return {courseId:cid,ramo:cname(cid),horas:Math.round(r.min/6)/10,texto:`${cname(cid)}: ${partes.join(' y ')}`};
  });
  const dias=[...Array(7)].map((_,i)=>{const d=addDays(t0,i);return {fecha:d,min:tasks.filter(x=>x.date===d).reduce((a,x)=>a+x.minutes,0)}});
  const pesados=dias.filter(d=>d.min>0).sort((a,b)=>b.min-a.min).slice(0,2).filter(d=>d.min>=90);
  const cobertura=S.events.filter(e=>topicIsExam(e)&&e.date>=t0&&diffDays(t0,e.date)<=21&&eventTopics(e).length)
    .sort((a,b)=>a.date.localeCompare(b.date)).map(e=>({eventId:e.id,titulo:e.title,ramo:cname(e.courseId),...topicCoverage(e)}));
  const sinTemas=S.events.filter(e=>topicIsExam(e)&&e.date>=t0&&diffDays(t0,e.date)<=21&&!eventTopics(e).length).map(e=>e.id);
  return {metas,pesados,cobertura,avisos:Object.values(topicPlanWarnings),sinTemas};
}

/* ---------- Acciones del estudiante ---------- */
function setTopicMastery(id,m){
  const t=topicById(id);if(!t||[0,1,2].indexOf(+m)<0)return;
  t.mastery=+m;replanAll();render();
}
function openTopicEditor(eventId){topicEditEvent=eventId;render()}
function closeTopicEditor(){topicEditEvent=null;render()}
function saveEventTopics(eventId,text){
  const ev=S.events.find(e=>e.id===eventId);if(!ev)return;
  const lines=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>=3).slice(0,TOPIC_MAX_PER_COURSE);
  if(!lines.length)return toast('Escribe al menos un tema (uno por línea).');
  const ids=[];
  lines.forEach(l=>parseTopicLine(l).forEach(d=>{const t=addTopic(ev.courseId,d,'manual');if(t&&!ids.includes(t.id))ids.push(t.id)}));
  ev.topicIds=ids;ev.topicsManual=true;topicEditEvent=null;
  replanAll();render();
  toast(`${ids.length} tema(s) guardados: armé el plan por temas para «${ev.title}».`);
}
function resetEventTopics(eventId){
  const ev=S.events.find(e=>e.id===eventId);if(!ev)return;
  delete ev.topicsManual;replanAll();render();
}
function topicFeedback(task,feeling){
  if(!topicsOn()||!task||!Array.isArray(task.topicIds)||!task.topicIds.length)return false;
  task.topicIds.map(topicById).filter(Boolean).forEach(t=>{
    t.history=(t.history||[]).filter(h=>h.taskId!==task.id);
    t.history.push({date:task.date,feeling,taskId:task.id});
    if(t.history.length>TOPIC_HISTORY_MAX)t.history=t.history.slice(-TOPIC_HISTORY_MAX);
    t.lastStudied=task.date;
    if(task.topicFb!==feeling){
      if(feeling==='bien')t.mastery=Math.min(2,t.mastery+1);
      else if(feeling==='costo')t.mastery=t.mastery===2?1:0;
    }
  });
  task.topicFb=feeling;
  return true;
}
function skipToday(){
  const t0=today(),pend=S.tasks.filter(x=>x.date===t0&&!x.done);
  if(!pend.length)return toast('Hoy no quedan sesiones pendientes.');
  const run=()=>undoable(`Moví ${pend.length} sesión(es) de hoy a los próximos días.`,()=>{S.skipDay=t0},replanAll);
  if(typeof askConfirm!=='function')return run();
  askConfirm({title:'Hoy no puedo',text:`Arvis va a reacomodar ${pend.length} sesión(es) de hoy en los próximos días. No se pierde nada y lo puedes deshacer.`,okLabel:'Reacomodar'})
    .then(ok=>{if(ok)run()});
}

/* ---------- Vistas ---------- */
function topicsMasteryRow(t,ev){
  return `<div class="topic-row"><span class="topic-name">${esc(t.name)}${t.unit!=null?` <span class="mute">· U${t.unit}</span>`:''}</span>
    <span class="topic-mastery" role="group" aria-label="Dominio de ${esc(t.name)}">${TOPIC_MASTERY_LABEL.map((l,i)=>
      `<button type="button" class="chip-btn ${t.mastery===i?'on':''}" aria-pressed="${t.mastery===i}" data-focus-id="tm-${ev.id}-${t.id}-${i}" onclick="setTopicMastery('${t.id}',${i})">${l}</button>`).join('')}</span></div>`;
}
function topicsEventHtml(ev){
  const ts=eventTopics(ev),cov=topicCoverage(ev),editing=topicEditEvent===ev.id;
  const editor=`<div class="topic-editor"><label class="mute" for="te-${ev.id}">Temas que entran (uno por línea)</label>
    <textarea id="te-${ev.id}" rows="4" placeholder="Primera ley&#10;Entalpía&#10;Ciclos de potencia">${esc(ts.map(t=>t.name).join('\n'))}</textarea>
    <div class="row" style="margin-top:6px"><button class="btn" data-focus-id="te-save-${ev.id}" onclick="saveEventTopics('${ev.id}',document.getElementById('te-${ev.id}').value)">Guardar temas</button>
    ${ts.length?`<button class="btn sec" onclick="closeTopicEditor()">Cancelar</button>`:''}</div></div>`;
  const head=`<div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start">
    <div><b>${esc(ev.title)}</b> · ${esc(cname(ev.courseId))} · ${dshort(ev.date)}</div>
    ${ts.length?`<span class="tag topic-cov" title="Temas con al menos una sesión hecha o que ya dominas">Temario cubierto: ${cov.covered} de ${cov.total}</span>`:''}</div>`;
  if(!ts.length)return `<div class="topic-event" id="topics-${ev.id}">${head}
    <div class="banner info topic-missing">Para planificar por temas, sube el syllabus o escribe los temas.
      <button class="lnk" onclick="go('syllabus')">Ir a Syllabus</button></div>${editor}</div>`;
  return `<div class="topic-event" id="topics-${ev.id}">${head}
    <div class="topic-bar" aria-hidden="true"><span style="width:${cov.pct}%"></span></div>
    <p class="mute" style="margin:6px 0">¿Cuánto dominas cada tema? Arvis le da más tiempo a lo que no has visto.</p>
    ${ts.map(t=>topicsMasteryRow(t,ev)).join('')}
    ${topicPlanWarnings[ev.id]?`<div class="banner soft" style="margin-top:8px">${esc(topicPlanWarnings[ev.id])}</div>`:''}
    <div class="row" style="margin-top:6px">${editing?'':`<button class="lnk" onclick="openTopicEditor('${ev.id}')">Editar temas</button>`}
      ${ev.topicsManual?`<button class="lnk" onclick="resetEventTopics('${ev.id}')">Usar los temas del syllabus</button>`:''}</div>
    ${editing?editor:''}</div>`;
}
function topicsCardHtml(){
  if(!topicsOn())return '';
  const t0=today(),evs=S.events.filter(e=>topicIsExam(e)&&e.date>=t0).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  if(!evs.length)return '';
  return `<div class="card" id="topics-card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
    <div><h2 style="margin:0">Temario por evaluación</h2><span class="mute">Arvis arma tus sesiones según los temas que entran y cuánto los dominas</span></div>
    ${typeof aiDemoTag==='function'?aiDemoTag():''}</div>${evs.map(topicsEventHtml).join('')}</div>`;
}
function weekPlanHtml(){
  const w=weekPlanSync();if(!w)return '';
  if(!w.metas.length&&!w.cobertura.length&&!w.sinTemas.length)return '';
  return `<div class="week-plan" id="week-plan"><h3 style="margin:10px 0 4px">Plan de la semana</h3>
    ${w.metas.length?`<ul>${w.metas.map(m=>`<li>${esc(m.texto)} <span class="mute">· ~${comma(String(m.horas))} h</span></li>`).join('')}</ul>`:'<p class="mute">Esta semana no hay sesiones por temas planificadas.</p>'}
    ${w.pesados.length?`<p class="mute" style="margin:4px 0">Días más pesados: ${w.pesados.map(d=>`${DAYS[(parse(d.fecha).getDay()+6)%7]} ${parse(d.fecha).getDate()} (${d.min} min)`).join(', ')}.</p>`:''}
    ${w.cobertura.length?`<p style="margin:6px 0 2px"><b>Temario cubierto</b></p><ul>${w.cobertura.map(c=>`<li>${esc(c.titulo)} · ${esc(c.ramo)}: ${c.covered} de ${c.total} temas</li>`).join('')}</ul>`:''}
    ${w.avisos.map(a=>`<div class="banner soft">${esc(a)}</div>`).join('')}
    ${w.sinTemas.length?`<div class="banner info">Hay ${w.sinTemas.length} evaluación(es) sin temas: escríbelos o sube el syllabus para planificar por temas. <button class="lnk" onclick="go('syllabus')">Ver temario</button></div>`:''}</div>`;
}

/* ---------- Chat (lo usa ArvisIA.chat antes de sus reglas generales) ---------- */
function topicsChatReply(raw){
  if(!topicsOn())return null;
  const t=norm(String(raw||''));
  const findCourse=()=>{let best=null,score=0;S.courses.forEach(c=>{const n=norm(c.name);let sc=t.includes(n)?100:0;
    n.split(/[^a-z0-9]+/).filter(w=>w.length>=4).forEach(w=>{if(new RegExp('\\b'+w.slice(0,Math.max(4,Math.min(w.length,5)))).test(t))sc+=w.length});
    if(sc>score){score=sc;best=c}});return best};
  if(/\b(replanifica|reorganiza|rearma)\b.*\bsemana\b|\bsemana\b.*\b(replanifica|reorganiza)\b/.test(t))
    return {texto:'Puedo rearmar tu semana por temas: priorizo lo que no has visto y lo que vale más. ¿Lo hago?',propuesta:{label:'Replanificar mi semana',kind:'replan'},estado:'normal'};
  const temaMatch=t.match(/\bya (?:domino|me se|entiendo|manejo)\s+(?:el |la |los |las )?(.+?)[.!?]*$/);
  if(temaMatch){
    const q=temaMatch[1].trim();
    const tp=topicList().filter(x=>norm(x.name).includes(q)||q.includes(norm(x.name)))[0];
    if(!tp)return {texto:`No encontré «${q}» entre tus temas. Puedes revisarlos en Académico → Syllabus.`,acciones:[{label:'Ir a Syllabus',go:'syllabus'}]};
    setTopicMastery(tp.id,2);
    return {texto:`¡Bien! Marqué «${tp.name}» (${cname(tp.courseId)}) como «Lo domino» y le di menos tiempo en tu plan.`,estado:'celebrando',acciones:[{label:'Ir a Hoy',go:'hoy'}]};
  }
  const askTemas=/\b(que|cuales)\b.*\btemas?\b|\btemario\b|\bque entra\b/.test(t);
  const askFalta=/\bcuanto (me )?falta\b|\bcomo voy\b.*\btemario\b|\bcobertura\b/.test(t);
  if(askTemas||askFalta){
    const c=findCourse();
    let evs=S.events.filter(e=>topicIsExam(e)&&e.date>=today()&&(!c||e.courseId===c.id)).sort((a,b)=>a.date.localeCompare(b.date));
    const num=t.match(/\b(certamen|control|prueba|examen)\s*(\d)/);
    if(num){const rx=new RegExp('\\b'+num[1]+'\\s*'+num[2]+'\\b'),hit=e=>rx.test(norm(e.title));evs=evs.filter(hit).concat(evs.filter(e=>!hit(e)))}
    const ev=evs[0];
    if(!ev)return {texto:c?`No veo evaluaciones próximas de ${c.name}.`:'No veo evaluaciones próximas.',acciones:[{label:'Ir a Syllabus',go:'syllabus'}]};
    const ts=eventTopics(ev);
    if(!ts.length)return {texto:`Aún no sé qué temas entran en «${ev.title}» de ${cname(ev.courseId)}. Sube el syllabus o escríbelos y armo el plan.`,acciones:[{label:'Escribir temas',go:'syllabus'}]};
    const cov=topicCoverage(ev);
    if(askFalta)return {texto:`En «${ev.title}» de ${cname(ev.courseId)} llevas ${cov.covered} de ${cov.total} temas (${cov.pct} %).${cov.covered<cov.total?' Te faltan:':''}`,
      lista:ts.filter(x=>x.mastery<2&&!S.tasks.some(k=>k.done&&(k.topicIds||[]).includes(x.id))).slice(0,8).map(x=>`${x.name} · ${TOPIC_MASTERY_LABEL[x.mastery]}`),
      acciones:[{label:'Ver temario',go:'syllabus'}],estado:cov.pct>=70?'celebrando':'normal'};
    return {texto:`En «${ev.title}» de ${cname(ev.courseId)} (${dshort(ev.date)}) entran ${ts.length} temas:`,
      lista:ts.slice(0,10).map(x=>`${x.name} · ${TOPIC_MASTERY_LABEL[x.mastery]}`),acciones:[{label:'Ver temario',go:'syllabus'}]};
  }
  return null;
}
