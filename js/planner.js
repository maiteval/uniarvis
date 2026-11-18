/* U.A.R.V.I.S. · Planificador de micro-tareas y detección de semanas críticas */
/* ===================== Planificador predictivo ===================== */
const BASE={evaluacion:360,entrega:240,control:90,otro:60};
const STAGES={
  evaluacion:['Repasar apuntes y conceptos clave','Ejercicios guiados','Simulacro tipo evaluación'],
  entrega:['Planificar y reunir material','Desarrollar avance','Revisar y pulir la entrega'],
  control:['Repaso rápido','Ejercicios tipo control'],
  otro:['Preparación']
};
const dayLoad=date=>S.tasks.filter(t=>t.date===date).reduce((a,t)=>a+t.minutes,0)+
                    S.sessions.filter(x=>x.date===date&&!x.taskId).reduce((a,x)=>a+x.minutes,0);
function splitMinutes(total,chunk){                     // bloques parejos de 15 a 30 min, sin restos de 5 o 10 min
  if(total<=0)return[];
  const n=Math.max(1,Math.min(Math.ceil(total/chunk),Math.floor(total/15)));
  const base=Math.floor(total/n/5)*5,extra=Math.round((total-base*n)/5);
  return Array.from({length:n},(_,i)=>base+(i<extra?5:0));
}
function planEvent(ev){
  const t0=today(),c=course(ev.courseId),diff=c?c.difficulty:3;
  const total=Math.round(BASE[ev.type]*(0.7+0.15*diff)/15)*15;           // más dificultad → más minutos
  const doneMin=S.tasks.filter(t=>t.eventId===ev.id&&t.done).reduce((a,t)=>a+t.minutes,0);
  let remaining=total-doneMin;if(remaining<10)return 0;
  const lead=Math.min(35,7+3*diff+(ev.early?7:0));                        // más dificultad → empieza antes
  const s0=addDays(ev.date,-lead),start=s0>t0?s0:t0;
  let end=addDays(ev.date,(diff>=4&&ev.type==='evaluacion')?-2:-1);        // día de respiro antes de evaluaciones difíciles
  if(end<start)end=addDays(ev.date,-1);
  if(end<start)return 0;
  const sinTarea=typeof institutionNoTaskDates==='function'?institutionNoTaskDates():[];
  const days=[];for(let d=start;d<=end;d=addDays(d,1))if(!sinTarea.includes(d))days.push(d);
  if(!days.length)return 0;
  const chunk=ev.type==='control'?15:(diff>=4?25:30);                      // micro-tareas de 15 a 30 min
  const picks=[];let overflow=0;
  const load=d=>dayLoad(d)+picks.filter(p=>p.date===d).reduce((a,p)=>a+p.minutes,0);
  for(const m of splitMinutes(remaining,chunk)){
    let cands=days.filter(d=>load(d)+m<=planCap(d));
    if(!cands.length){cands=days;overflow++}
    cands.sort((a,b)=>load(a)/planCap(a)-load(b)/planCap(b)||b.localeCompare(a));
    picks.push({date:cands[0],minutes:m});
  }
  picks.sort((a,b)=>a.date.localeCompare(b.date));
  const st=STAGES[ev.type];
  picks.forEach((p,i)=>{
    const stage=st[Math.min(st.length-1,Math.floor(i/picks.length*st.length))];
    S.tasks.push({id:uid(),eventId:ev.id,courseId:ev.courseId,title:`${stage} · ${ev.title}`,date:p.date,minutes:p.minutes,done:false});
  });
  return overflow;
}
function replanAll(){                                   // reprogramación sin culpa: lo pendiente se redistribuye solo
  inval();const t0=today();
  const stale=S.tasks.filter(t=>!t.done&&t.date<t0).length;
  if(stale>0)S.moved={date:t0,n:stale};
  const certKeep=S.tasks.filter(t=>t.certamen);
  S.tasks=S.tasks.filter(t=>t.done);
  let over=0;
  S.events.filter(e=>e.date>=t0&&!certPlans().some(p=>p.eventId===e.id)).sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>over+=planEvent(e));
  if(certPlans().length)buildCertamenTasks(t0,certKeep);
  S.lastPlan=t0;save();
  if(over)toast('Esos días quedaron muy cargados: repartí lo más parejo posible. Quizá conviene mover alguna fecha o pedir ayuda.');
}

/* ===================== Semanas críticas ===================== */
function institutionCriticalClusters(){
  const i=typeof currentInstitution==='function'?currentInstitution():null;if(!i)return [];
  const c=institutionCalendar(i),t0=today();
  return c.examWeeks.filter(w=>w.end>=t0).map((w,n)=>({start:w.start,end:w.end,
    events:[{id:'inst-exam-'+n,title:w.label,type:'evaluacion',courseId:'',institution:true}]}));
}
function criticalClusters(){
  const t0=today(),ev=S.events.filter(e=>e.type!=='otro'&&e.date>=t0).sort((a,b)=>a.date.localeCompare(b.date));
  const marked=new Set();
  ev.forEach(e=>{const win=ev.filter(x=>x.date>=e.date&&diffDays(e.date,x.date)<=4);if(win.length>=3)win.forEach(x=>marked.add(x.id))});
  const out=[];
  ev.filter(e=>marked.has(e.id)).forEach(e=>{
    const g=out[out.length-1];
    if(g&&diffDays(g.end,e.date)<=4){g.events.push(e);g.end=e.date}else out.push({start:e.date,end:e.date,events:[e]});
  });
  return out.concat(institutionCriticalClusters());
}
function applyEarly(ids){
  const set=ids.split(',');S.events.forEach(e=>{if(set.includes(e.id))e.early=true});
  replanAll();toast('Listo: reservé margen extra y adelanté el inicio de la preparación.');render();
}
function firstTaskDate(evs){
  const ids=evs.map(e=>e.id),ds=S.tasks.filter(t=>ids.includes(t.eventId)&&!t.done).map(t=>t.date).sort();
  return ds[0]||null;
}
function recentLow(){const r=S.wellbeing.diary.filter(e=>e.energy!=null).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  return r.length>=3&&(avg(r.map(e=>e.mood))<=2.5||avg(r.map(e=>e.energy))<=2.5)}
function criticalHtml(){
  const t0=today();
  return criticalClusters().filter(g=>diffDays(t0,g.start)<=28).map(g=>{
    const real=g.events.filter(e=>!e.institution);
    const allEarly=real.length>0&&real.every(e=>e.early),ids=real.map(e=>e.id).join(',');
    const names=g.events.map(e=>e.institution?esc(e.title):`${esc(cname(e.courseId))} (${TYPE_LABEL[e.type].toLowerCase()})`).join(', ');
    const f=firstTaskDate(g.events);
    const low=S.consent&&S.consent.health&&recentLow();
    return `<div class="banner go"><b>Semana exigente a la vista: ${dshort(g.start)} – ${dshort(g.end)}</b><br>
      Se juntan ${g.events.length} fechas importantes en pocos días: ${names}.<br>
      ${!real.length?`El calendario institucional marca este período como exigente${f?`; tu preparación parte el ${dshort(f)}`:''}.`
        :(allEarly?`Ya reservé margen extra${f?`: tu preparación parte el ${dshort(f)}`:''}. Nada más que hacer por ahora.`
        :'Conviene empezar antes: puedo adelantar el inicio de la preparación y repartirla en más días, con micro-tareas más livianas.')}
      ${low?'<br>Además tus últimos días vienen pesados: cuida tus pausas y mira las opciones de apoyo.':''}
      <div class="row" style="margin-top:8px">${!real.length||allEarly?'':`<button class="btn" onclick="applyEarly('${ids}')">Reservar margen extra</button>`}
      ${low?`<button class="btn sec" onclick="go('apoyo')">Ver apoyo</button>`:''}</div></div>`;
  }).join('');
}

const CERT_PHASES={teoria:'Repaso de teoría',ejercicios:'Ejercicios por tema',ensayo:'Ensayo cronometrado',errores:'Revisión de errores',repaso:'Repaso ligero de errores'};
let certDraft=null;
const certPlans=()=>S.certamen&&Array.isArray(S.certamen.plans)?S.certamen.plans:[];
const certIsExam=e=>e.type==='evaluacion'||e.type==='control'||(e.type==='otro'&&/(prueba|certamen|examen|control)/.test(norm(e.title)));
const certCandidates=()=>S.events.filter(e=>certIsExam(e)&&e.date>today()&&diffDays(today(),e.date)<=7&&!certPlans().some(p=>p.eventId===e.id)).sort((a,b)=>a.date.localeCompare(b.date));
function certamenRememberSyllabus(courseId,text){
  if(!S.certamen||!S.certamen.topicsByCourse)return;
  const out=[];
  String(text||'').split(/\r?\n/).forEach(raw=>{
    const line=raw.replace(/\s+/g,' ').trim();
    const m=line.match(/^(?:(?:tema|unidad|módulo|modulo|capítulo|capitulo|contenido)\s*[:.\-–—]?\s*|(\d+[.)])\s*)(.+)$/i);
    if(!m||!m[2])return;
    const name=m[2].trim();
    if(name.length<4||name.length>80||/\d{1,2}[\/\-]\d{1,2}|\d{1,2}\s+de\s+[a-z]/i.test(name))return;
    if(!out.some(x=>norm(x)===norm(name)))out.push(name);
  });
  S.certamen.topicsByCourse[courseId]=out.slice(0,20);
}
const certamenSuggestions=courseId=>((S.certamen&&S.certamen.topicsByCourse&&S.certamen.topicsByCourse[courseId])||[]).slice();
function openCertamen(eventId){
  const ev=S.events.find(e=>e.id===eventId);if(!ev||!certIsExam(ev))return;
  const topics=certamenSuggestions(ev.courseId);
  certDraft={eventId:eventId,mockMin:Number.isFinite(ev.mockMin)?clamp(ev.mockMin,30,240):90,
    topics:(topics.length?topics:['']).slice(0,8).map(name=>({id:uid(),name:String(name).slice(0,80),hard:false}))};
  render();
}
function certAddTopic(){if(certDraft)certDraft.topics.push({id:uid(),name:'',hard:false});render()}
function certRemoveTopic(id){if(certDraft)certDraft.topics=certDraft.topics.filter(t=>t.id!==id);render()}
function certSetTopic(id,k,v){const t=certDraft&&certDraft.topics.find(x=>x.id===id);if(t){if(k==='name')t.name=String(v).slice(0,80);else t.hard=!!v}if(k!=='name')render()}
function certSetMock(v){const n=parseInt(v,10);if(certDraft)certDraft.mockMin=Number.isInteger(n)?clamp(n,30,240):90;render()}
function certCancelDraft(){certDraft=null;render()}
function activateCertamen(){
  if(!certDraft)return;
  const ev=S.events.find(e=>e.id===certDraft.eventId);if(!ev)return;
  const topics=certDraft.topics.filter(t=>String(t.name||'').trim()).map(t=>({id:t.id,name:String(t.name).trim().slice(0,80),hard:!!t.hard}));
  if(!topics.length)return toast('Escribe al menos un tema que entre en la evaluación.');
  S.certamen.plans=S.certamen.plans.filter(p=>p.eventId!==ev.id);
  S.certamen.plans.push({eventId:ev.id,courseId:ev.courseId,title:ev.title,date:ev.date,mockMin:certDraft.mockMin||90,topics:topics,leftOut:[]});
  certDraft=null;replanAll();render();
  toast('Modo certamen activo: reemplacé las micro-tareas sueltas por un plan por fases.');
}
function exitCertamen(eventId){
  S.certamen.plans=S.certamen.plans.filter(p=>p.eventId!==eventId);
  S.tasks=S.tasks.filter(t=>!(t.certamen&&t.eventId===eventId&&!t.done));
  replanAll();render();
  toast('Saliste del modo certamen: volviste a las micro-tareas normales.');
}
function certShare(date,plan,plans){
  const ev=S.events.find(e=>e.id===plan.eventId);if(!ev)return 1;
  const mates=plans.map(p=>S.events.find(e=>e.id===p.eventId)).filter(e=>e&&e.date>=today()&&
    (mondayOf(e.date)===mondayOf(ev.date)||diffDays(e.date,ev.date)<=4));
  if(mates.length<2)return 1;
  const weight=e=>{const c=course(e.courseId),d=c?c.difficulty:3;return d+(7-clamp(diffDays(today(),e.date),0,7))*0.5};
  const total=mates.reduce((a,e)=>a+weight(e),0);
  return total?weight(ev)/total:1;
}
function buildCertamenTasks(t0,previous){
  S.tasks=S.tasks.filter(t=>!t.certamen||t.done);
  const done=new Set((previous||[]).filter(t=>t.certamen&&t.done).map(t=>t.eventId+'|'+(t.topicId||'')+'|'+t.phase));
  const plans=certPlans().filter(p=>p.date>t0&&S.events.some(e=>e.id===p.eventId));
  const blocks=[];
  plans.forEach(p=>{
    p.leftOut=[];
    const N=clamp(diffDays(t0,p.date),1,7),topics=[...p.topics].sort((a,b)=>(b.hard?1:0)-(a.hard?1:0));
    const offset=o=>clamp(Math.ceil(o*N/7),2,N);
    const put=(n,minutes,phase,topic,priority)=>{
      if(done.has(p.eventId+'|'+(topic?topic.id:'')+'|'+phase))return;
      blocks.push({plan:p,date:addDays(p.date,-n),minutes,phase,topic,priority,
        title:`${CERT_PHASES[phase]} · ${topic?topic.name:p.title}`});
    };
    if(N>=3)topics.forEach((t,i)=>put(offset(7-Math.min(i,2)),25,'teoria',t,(t.hard?50:30)+i));
    if(N>=2)topics.forEach((t,i)=>put(offset(4-Math.min(i,1)),25,'ejercicios',t,(t.hard?80:60)+i));
    put(N>=2?2:1,p.mockMin,'ensayo',null,100);
    put(N>=2?2:1,15,'errores',null,90);
    const rev=topics.slice(0,Math.min(3,Math.floor(45/15)));
    const each=Math.floor(45/rev.length/5)*5,extra=Math.round((45-each*rev.length)/5);
    rev.forEach((t,i)=>put(1,each+(i<extra?5:0),'repaso',t,(t.hard?70:40)+i));
    if(N<3)topics.forEach(t=>p.leftOut.push({label:`${CERT_PHASES.teoria} · ${t.name}`,minutes:25}));
    if(N<2)topics.forEach(t=>p.leftOut.push({label:`${CERT_PHASES.ejercicios} · ${t.name}`,minutes:25}));
  });
  const byDate={};
  blocks.forEach(b=>{(byDate[b.date]=byDate[b.date]||[]).push(b)});
  const dates=Object.keys(byDate).sort();
  const roomFor=(date,b)=>{
    const cap=planCap(date),share=certShare(date,b.plan,plans);
    const limit=Math.max(15,Math.min(cap,Math.floor(cap*share/15)*15));
    return {limit,fit:Math.min(b.minutes,Math.floor(Math.max(0,limit-dayLoad(date))/5)*5)};
  };
  const sinTarea=typeof institutionNoTaskDates==='function'?institutionNoTaskDates():[];
  const place=b=>{
    let target=b.date;
    while(sinTarea.includes(target)&&target<b.plan.date)target=addDays(target,1);   // recesos y feriados: sin micro-tareas
    if(sinTarea.includes(target))return;
    if(b.phase==='ensayo'&&roomFor(target,b).fit<b.minutes){
      const last=addDays(b.plan.date,-1);
      for(let d=addDays(target,1);d<=last;d=addDays(d,1))if(roomFor(d,b).fit>=b.minutes){target=d;break}
    }
    const {fit}=roomFor(target,b);
    if(fit<15||(b.phase==='ensayo'&&fit<b.minutes)){b.plan.leftOut.push({label:b.title,minutes:b.minutes});return}
    S.tasks.push({id:uid(),eventId:b.plan.eventId,courseId:b.plan.courseId,title:b.title,date:target,minutes:fit,done:false,
      certamen:true,phase:b.phase,topicId:b.topic?b.topic.id:''});
  };
  const first=b=>b.phase==='ensayo'||b.phase==='errores';
  dates.forEach(date=>byDate[date].filter(first).sort((a,b)=>b.priority-a.priority).forEach(place));
  dates.forEach(date=>byDate[date].filter(b=>!first(b)).sort((a,b)=>b.priority-a.priority).forEach(place));
  plans.forEach(p=>{
    const seen=new Set();
    p.leftOut=p.leftOut.filter(x=>{const k=x.label+'|'+x.minutes;if(seen.has(k))return false;seen.add(k);return true});
  });
}
