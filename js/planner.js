/* U.A.R.V.I.S. · Planificador de sesiones de estudio y detección de semanas críticas */
/* ===================== Planificador predictivo ===================== */
const BASE={evaluacion:360,entrega:240,control:90,otro:60};
const KIND_LABEL={nuevo:'Primera vez',recuperar:'Recuperar',ejercicios:'Ejercicios',simulacro:'Simulacro',repaso_ligero:'Repaso ligero'};
const KIND_TITLE={recuperar:'Recuperar a distancia',ejercicios:'Ejercicios mezclados',simulacro:'Simulacro tipo evaluación',repaso_ligero:'Repaso ligero'};
const SESSION_LENGTHS=[45,60,90],SESSION_MAX_MERGE=90;
const SLOT_DAY_START=8*60,SLOT_DAY_END=21*60+30,SLOT_MARGIN=15;
const SESSION_HINT={
  nuevo:'Primera pasada: lee y resume en 5 ideas clave',
  ejercicios:'Resuelve ejercicios sin mirar la solución; marca los que te costaron',
  recuperar:'Sin apuntes: escribe todo lo que recuerdas y luego compara',
  simulacro:'Simulacro con tiempo, como si fuera la evaluación',
  repaso_ligero:'Repaso suave de tus resúmenes y errores frecuentes. Duerme bien.'
};
const sessionMin=()=>SESSION_LENGTHS.indexOf(S.settings.sessionMin)>=0?S.settings.sessionMin:60;
const maxSessions=()=>Number.isInteger(S.settings.maxSessions)?clamp(S.settings.maxSessions,1,4):2;
const paceFactor=()=>Number.isFinite(S.settings.paceFactor)?clamp(S.settings.paceFactor,0.7,1.4):1;
const clockOf=m=>`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const chronoTag=kind=>{
  const ch=(S.settings&&S.settings.chronotype)||'no_se',label=EVIDENCE.plan.chronotypeLabels[ch]||'';
  if(!label)return '';
  if(['nuevo','ejercicios','simulacro'].indexOf(kind)>=0)return `Mejor en tu franja: ${label}`;
  if(['recuperar','repaso_ligero'].indexOf(kind)>=0)return 'cuando puedas';
  return '';
};
const taskKindTitle=(kind,ev)=>kind==='nuevo'?EVIDENCE.plan.retrievalTitle:`${KIND_TITLE[kind]||'Practicar'} · ${ev.title}`;
function needsInterleave(t){
  if(!t||(t.kind!=='ejercicios'&&!t.certamen))return false;
  const plan=t.certamen&&certPlans().find(p=>p.eventId===t.eventId);
  const topics=plan?plan.topics.map(x=>x.id):S.courses.map(c=>c.id);
  if(topics.length<EVIDENCE.plan.interleaveMinTopics)return false;
  return topics.every(id=>S.tasks.some(x=>x.done&&x.courseId===(plan?t.courseId:id)&&x.date<t.date&&(!plan||x.topicId===id)));
}
function taskSlots(ev,days,n,diff){
  const P=EVIDENCE.plan,eve=addDays(ev.date,-1);
  const beforeEve=days.filter(d=>d<eve),useDays=beforeEve.length?beforeEve:days;
  const first=useDays[0],left=first?diffDays(first,ev.date):0;
  const gap1=Math.max(P.minGapDays,Math.round(left*P.gapRatioMin)),gap2=Math.max(gap1+1,Math.round(left*P.gapRatioMax));
  const rec1=useDays.find(d=>diffDays(first,d)>=gap1)||null;
  const rec2=rec1&&useDays.find(d=>diffDays(first,d)>=gap2)||null;
  const mock=days.find(d=>{const l=diffDays(d,ev.date);return l>=P.mockBeforeMin&&l<=P.mockBeforeMax})||null;
  const exercise=useDays.find(d=>(!rec2||d>rec2)&&(!mock||d<mock))||null;
  const order=useDays.map(d=>{
    if(d===first)return {date:d,kind:'nuevo'};
    if(d===rec1||d===rec2)return {date:d,kind:'recuperar'};
    if(d===mock)return {date:d,kind:'simulacro'};
    return {date:d,kind:'ejercicios'};
  });
  const eveSlot=days.includes(eve)?{date:eve,kind:'repaso_ligero'}:null;
  const base=order.filter(x=>!eveSlot||x.date!==eve);
  const pool=base.length?base:[{date:days[0],kind:'repaso_ligero'}];
  const out=[],want=eveSlot?Math.max(0,n-1):n;
  while(out.length<want){
    const s=pool[out.length%pool.length];
    const pick=out.length<pool.length?s:(pool.find(x=>x.date!==s.date&&x.date!==eve)||s);
    const kind=pick.kind==='recuperar'&&out.length>=pool.length?'ejercicios':pick.kind;
    out.push({date:pick.date,kind:pick.date===eve?'repaso_ligero':kind});
  }
  if(eveSlot)out.push(eveSlot);
  if(!out.length)out.push(pool[0]);
  return out.slice(0,n);
}
function planNoTaskDates(){                             // feriados/recesos de la institución + "Hoy no puedo"
  const out=typeof institutionNoTaskDates==='function'?institutionNoTaskDates().slice():[];
  if(S.skipDay&&S.skipDay===today()&&out.indexOf(S.skipDay)<0)out.push(S.skipDay);
  return out;
}
const dayLoad=date=>S.tasks.filter(t=>t.date===date).reduce((a,t)=>a+t.minutes,0)+
                     S.sessions.filter(x=>x.date===date&&!x.taskId).reduce((a,x)=>a+x.minutes,0);
function splitMinutes(total,size){                      // bloques largos: sin restos sueltos menores a 20 min
  if(!(total>0))return[];
  const session=SESSION_LENGTHS.indexOf(size)>=0?size:sessionMin();
  if(total<=session)return [total];
  const full=Math.floor(total/session),rest=total-full*session;
  if(!rest)return Array(full).fill(session);
  if(rest<20){const out=Array(Math.max(0,full-1)).fill(session);out.push(session+rest);return out}
  const last=Math.max(30,rest),out=Array(Math.max(0,full-1)).fill(session);
  if(full)out.push(session-(last-rest));
  out.push(last);
  return out.filter(x=>x>0);
}
function importanceFor(ev){
  const c=course(ev.courseId),grades=c&&Array.isArray(c.grades)?c.grades:[];
  const name=norm(String(ev.title||'').trim());
  const found=grades.find(g=>norm(String(g.name||'').trim())===name&&Number.isFinite(+g.weight));
  const weight=found?clamp(0.6+(+found.weight)/50,0.6,1.6):1;
  const sum=typeof gradeSummary==='function'&&grades.length?gradeSummary(grades,c):null;
  const need=sum&&Number.isFinite(sum.need)?sum.need:null;
  let risk=1;
  if(need!=null&&need>5)risk=1.2;
  else if(sum&&((need!=null&&need<=1)||(need==null&&sum.avg!=null&&sum.avg>=sum.pass)))risk=0.8;
  return {weight:found?+found.weight:null,need,factor:Math.round(weight*risk*100)/100,risk};
}
function sessionWhy(ev,kind,imp,daysLeft){
  const parts=[];
  if(imp.weight!=null)parts.push(`«${ev.title}» pondera ${comma(String(imp.weight))}% en ${cname(ev.courseId)}`);
  if(imp.need!=null)parts.push(`necesitas ${Number(imp.need).toFixed(1).replace('.',',')} para aprobar`);
  if(daysLeft<=1)parts.push('la fecha está muy cerca');
  else parts.push(`quedan ${daysLeft} días antes de ${ev.title}`);
  if(imp.risk>1)parts.push('es una evaluación de riesgo');
  if(!parts.length)parts.push('conviene repartir el estudio antes de la fecha');
  return String(parts.join('. ')+'.').slice(0,240);
}
function feedbackFor(ev){
  const felt=S.tasks.filter(t=>t.done&&t.eventId===ev.id&&t.feeling).sort((a,b)=>a.date.localeCompare(b.date));
  const last=felt[felt.length-1],two=felt.slice(-2);
  return {extra:!!last&&last.feeling==='costo',
    skipKind:two.length===2&&two.every(t=>t.feeling==='bien')&&two[0].kind&&two[0].kind===two[1].kind?two[0].kind:null};
}
function learnPace(){
  const recent=S.tasks.filter(t=>t.done&&Number.isFinite(t.realMinutes)&&t.minutes>0)
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
  if(recent.length<3)return;
  const ratio=avg(recent.map(t=>t.realMinutes/t.minutes));
  if(ratio<0.7||ratio>1.3)S.settings.paceFactor=clamp(Math.round((1+(ratio-1)*0.5)*100)/100,0.7,1.4);
}
function classWindows(date){
  const dow=(parse(date).getDay()+6)%7;
  return S.classes.filter(k=>k.day===dow&&toMin(k.end)>toMin(k.start))
    .map(k=>({a:toMin(k.start),b:toMin(k.end)})).sort((a,b)=>a.a-b.a);
}
function busyWindows(date){                              // clases + sesiones ya ubicadas ese día (para no superponerlas)
  const ses=S.tasks.filter(t=>t.date===date&&t.slotStart&&t.slotEnd&&toMin(t.slotEnd)>toMin(t.slotStart))
    .map(t=>({a:toMin(t.slotStart),b:toMin(t.slotEnd)}));
  return classWindows(date).concat(ses).sort((a,b)=>a.a-b.a);
}
function freeWindows(date,minutes){
  let cursor=SLOT_DAY_START;const out=[];
  busyWindows(date).forEach(k=>{
    if(k.a-cursor>=minutes)out.push([cursor,k.a]);
    cursor=Math.max(cursor,k.b+SLOT_MARGIN);
  });
  if(SLOT_DAY_END-cursor>=minutes)out.push([cursor,SLOT_DAY_END]);
  return out;
}
function slotFor(date,minutes,kind){
  const wins=freeWindows(date,minutes);if(!wins.length)return null;
  const ch=S.settings.chronotype,classes=classWindows(date);
  const after=classes.length?Math.min(SLOT_DAY_END,classes[classes.length-1].b+SLOT_MARGIN):SLOT_DAY_START;
  let pick;
  if(ch==='manana')pick=wins.find(w=>w[0]<12*60);
  else if(ch==='tarde')pick=wins.find(w=>w[0]>=12*60&&w[0]<18*60);
  else if(ch==='noche')pick=wins.slice().reverse().find(w=>w[0]>=18*60);
  else pick=wins.find(w=>w[0]>=after);
  if(!pick)pick=wins[0];
  return {slotStart:clockOf(pick[0]),slotEnd:clockOf(pick[0]+minutes)};
}
function sessionState(date){
  const ts=S.tasks.filter(t=>t.date===date);
  return {count:ts.length,load:ts.reduce((a,t)=>a+t.minutes,0),courses:new Set(ts.map(t=>t.courseId))};
}
function dayBudget(date,eveDate,useFull){
  const cap=planCap(date),limit=date===eveDate?Math.min(cap,EVIDENCE.plan.eveMaxMinutes):cap;
  return useFull?Math.floor(limit):Math.floor(limit*0.8/5)*5;
}
function commitSession(b){
  const slot=slotFor(b.date,b.minutes,b.kind),chrono=chronoTag(b.kind);
  S.tasks.push({id:uid(),eventId:b.eventId,courseId:b.courseId,title:b.title,date:b.date,minutes:b.minutes,done:false,
    kind:b.kind,hint:String(b.hint||'').slice(0,160),why:String(b.why||'').slice(0,240),
    ...(Array.isArray(b.topicIds)&&b.topicIds.length?{topicIds:b.topicIds.slice(0,3)}:{}),
    ...(slot||{}),...(chrono?{chrono}:{}),...(b.certamen?{certamen:true,phase:b.phase||'',...(b.topicId?{topicId:b.topicId}:{})}:{})});
}
function allocateSessions(blocks,ctx){
  const placed=[],noTask=ctx.noTask||[],last=ctx.last||'9999',first=today();
  const state=d=>{
    const st=sessionState(d);
    placed.filter(p=>p.date===d).forEach(p=>{st.count++;st.load+=p.minutes;st.courses.add(p.courseId)});
    return st;
  };
  const options=b=>{
    const ds=new Set(ctx.days||[]);if(b.date)ds.add(b.date);ds.add(b.date);
    const list=[...ds].filter(d=>d>=first&&d<=last&&!noTask.includes(d));
    if(ctx.topics)return list.sort((a,c)=>Math.abs(diffDays(b.date,a))-Math.abs(diffDays(b.date,c))||c.localeCompare(a));   // temas: lo más cerca posible de la fecha ideal
    return list.sort((a,c)=>
      (a===b.date?-1:0)-(c===b.date?-1:0)||a.localeCompare(c));
  };
  const put=(b,useFull)=>{
    const budget=dayBudget(b.date,ctx.eveDate,useFull),st=state(b.date);
    if(st.count>=maxSessions()||st.load+b.minutes>budget)return false;
    if(st.courses.size>=2&&!st.courses.has(b.courseId))return false;
    if(ctx.topics&&Array.isArray(b.topicIds)&&b.kind!=='simulacro'&&b.kind!=='repaso_ligero'&&placed.some(p=>p.date===b.date&&p.eventId===b.eventId&&(p.topicIds||[]).some(id=>b.topicIds.includes(id))))return false;
    const merge=!ctx.topics&&placed.find(p=>p.date===b.date&&p.courseId===b.courseId&&p.minutes+b.minutes<=SESSION_MAX_MERGE);
    if(merge)merge.minutes+=b.minutes;
    else placed.push({...b});
    return true;
  };
  const remaining=[],ordered=blocks.slice().sort((a,b)=>
    (b.date===ctx.eveDate?1:0)-(a.date===ctx.eveDate?1:0));
  ordered.forEach(b=>{
    for(const d of options(b)){
      const trial={...b,date:d};
      if(put(trial,d===ctx.eveDate))return;
    }
    remaining.push(b);
  });
  let overflow=0;
  remaining.forEach(b=>{
    for(const d of options(b)){
      const trial={...b,date:d};
      if(put(trial,true))return;
    }
    overflow++;
  });
  placed.sort((a,b)=>a.date.localeCompare(b.date)).forEach(commitSession);
  return overflow;
}
function planEvent(ev){
  if(typeof topicPlanApplies==='function'&&topicPlanApplies(ev))return planEventTopics(ev);   // institucional: plan por temas (js/topics.js)
  const t0=today(),c=course(ev.courseId),diff=c?c.difficulty:3,imp=importanceFor(ev),eve=addDays(ev.date,-1);
  const total=Math.round(BASE[ev.type]*(0.7+0.15*diff)*imp.factor*paceFactor()/15)*15;
  const doneMin=S.tasks.filter(t=>t.eventId===ev.id&&(t.done||t.pinned)).reduce((a,t)=>a+t.minutes,0);
  const remaining=total-doneMin;if(remaining<10)return 0;
  const lead=Math.min(35,7+3*diff+(ev.early?7:0)),s0=addDays(ev.date,-lead),start=s0>t0?s0:t0;
  let end=addDays(ev.date,(diff>=4&&ev.type==='evaluacion')?-2:-1);  // día de respiro antes de evaluaciones difíciles
  if(end<start)end=addDays(ev.date,-1);
  if(end<start)return 0;
  const sinTarea=planNoTaskDates();
  const days=[];for(let d=start;d<=end;d=addDays(d,1))if(!sinTarea.includes(d))days.push(d);
  if(!days.length)return 0;
  const fb=feedbackFor(ev);
  let amounts=splitMinutes(remaining,sessionMin()),slots=taskSlots(ev,days,amounts.length,diff);
  if(fb.skipKind&&amounts.length>1){
    const at=slots.map((s,i)=>({s,i})).filter(x=>x.i<slots.length-1).reverse().find(x=>x.s.kind===fb.skipKind);
    if(at){amounts.splice(at.i,1);slots.splice(at.i,1)}
  }
  if(fb.extra){amounts.push(sessionMin());slots.push({date:slots.length?slots[slots.length-1].date:days[0],kind:'ejercicios'})}
  const blocks=amounts.map((m,i)=>{
    const s=slots[i]||{date:days[0],kind:'ejercicios'},onEve=s.date===eve,kind=onEve?'repaso_ligero':s.kind;
    return {date:s.date,minutes:onEve?Math.min(m,EVIDENCE.plan.eveMaxMinutes):m,kind,
      eventId:ev.id,courseId:ev.courseId,title:taskKindTitle(kind,ev),hint:SESSION_HINT[kind],
      why:sessionWhy(ev,kind,imp,Math.max(0,diffDays(s.date,ev.date)))};
  });
  return allocateSessions(blocks,{days,noTask:sinTarea,eveDate:eve,last:addDays(ev.date,-1)});
}
const eventPriority=(a,b)=>{
  const ia=importanceFor(a),ib=importanceFor(b);
  return a.date.localeCompare(b.date)||ib.factor-ia.factor||ib.risk-ia.risk||a.id.localeCompare(b.id);
};
function replanAll(){                                   // reprogramación sin culpa: lo pendiente se redistribuye solo
  inval();const t0=today();
  const stale=S.tasks.filter(t=>!t.done&&t.date<t0).length;
  if(stale>0)S.moved={date:t0,n:stale};
  const certKeep=S.tasks.filter(t=>t.certamen);
  S.tasks=S.tasks.filter(t=>t.done||(t.pinned&&t.date>=t0));      // las sesiones fijadas por el estudiante se respetan
  learnPace();
  if(S.skipDay&&S.skipDay!==t0)S.skipDay=null;
  if(typeof topicsSync==='function'){topicPlanWarnings={};topicsSync()}
  let over=0;
  S.events.filter(e=>e.date>=t0&&!certPlans().some(p=>p.eventId===e.id)).sort(eventPriority).forEach(e=>over+=planEvent(e));
  if(certPlans().length)buildCertamenTasks(t0,certKeep);
  S.lastPlan=t0;save();
  if(over)toast('Esos días quedaron muy cargados: repartí lo más parejo posible. Quizá conviene mover alguna fecha o pedir ayuda.');
}

/* ===================== Semanas críticas ===================== */
function institutionCriticalClusters(){
  const i=typeof currentInstitution==='function'?currentInstitution():null;if(!i)return [];
  const c=institutionCalendar(i),t0=today();
  return c.examWeeks.filter(w=>w.end>=t0).map((w,n)=>({start:w.start,end:w.end,fromInstitution:true,
    events:[{id:'inst-exam-'+n,title:w.label,type:'evaluacion',courseId:'',institution:true}]}));
}
function mergeCriticalClusters(groups){
  const sorted=groups.slice().sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)),out=[];
  sorted.forEach(g=>{
    const inst=g.fromInstitution===true||g.events.some(e=>e.institution),last=out[out.length-1];
    if(last&&diffDays(last.end,g.start)<=2){
      if(g.start<last.start)last.start=g.start;
      if(g.end>last.end)last.end=g.end;
      const seen=new Set(last.events.map(e=>e.id));
      g.events.forEach(e=>{if(!seen.has(e.id)){seen.add(e.id);last.events.push(e)}});
      if(inst)last.fromInstitution=true;
    }else out.push({start:g.start,end:g.end,events:g.events.slice(),fromInstitution:inst});
  });
  return out;
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
  return mergeCriticalClusters(out.concat(institutionCriticalClusters()));
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
    const inst=g.fromInstitution===true||g.events.some(e=>e.institution);
    const allEarly=real.length>0&&real.every(e=>e.early),ids=real.map(e=>e.id).join(',');
    const names=real.map(e=>`${esc(cname(e.courseId))} (${TYPE_LABEL[e.type].toLowerCase()})`).join(', ');
    const f=firstTaskDate(g.events);
    const low=S.consent&&S.consent.health&&recentLow();
    const fechas=real.length===1?'1 fecha importante':`${real.length} fechas importantes`;
    const detalle=!real.length
      ?`<b>Semana de certámenes de la UdeC: ${dshort(g.start)} – ${dshort(g.end)}.</b><br>
        El calendario institucional marca este período como exigente${f?`; tu preparación parte el ${dshort(f)}`:''}.`
      :`<b>Semana exigente a la vista: ${dshort(g.start)} – ${dshort(g.end)}</b><br>
        ${real.length===1?`Hay ${fechas} en este tramo`:`Se juntan ${fechas} en pocos días`}: ${names}.<br>
        ${inst?'Coincide con la semana de certámenes de la UdeC.<br>':''}
        ${allEarly?`Ya reservé margen extra${f?`: tu preparación parte el ${dshort(f)}`:''}. Nada más que hacer por ahora.`
        :'Conviene empezar antes: puedo adelantar el inicio de la preparación y repartirla en más días, con sesiones más livianas.'}`;
    return `<div class="banner go">${detalle}
      ${low?'<br>Además tus últimos días vienen pesados: cuida tus pausas y mira las opciones de apoyo.':''}
      <div class="row" style="margin-top:8px">${!real.length||allEarly?'':`<button class="btn" onclick="applyEarly('${ids}')">Reservar margen extra</button>`}
      ${low?`<button class="btn sec" onclick="go('apoyo')">Ver apoyo</button>`:''}</div></div>`;
  }).join('');
}

const CERT_PHASES={teoria:'Recordar sin mirar',ejercicios:'Ejercicios por tema',ensayo:'Ensayo cronometrado',errores:'Revisión de errores',repaso:'Repaso ligero de errores'};
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
  certDraft=null;replanAll();
  if(typeof metricsTrack==='function')metricsTrack('certamen_activado');
  render();
  toast('Modo certamen activo: reemplacé las sesiones sueltas por un plan por fases.');
}
function exitCertamen(eventId){
  S.certamen.plans=S.certamen.plans.filter(p=>p.eventId!==eventId);
  S.tasks=S.tasks.filter(t=>!(t.certamen&&t.eventId===eventId&&!t.done));
  replanAll();render();
  toast('Saliste del modo certamen: volviste a las sesiones normales.');
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
const CERT_KIND={teoria:'recuperar',ejercicios:'ejercicios',ensayo:'simulacro',errores:'repaso_ligero',repaso:'repaso_ligero'};
function buildCertamenTasks(t0,previous){
  S.tasks=S.tasks.filter(t=>!t.certamen||t.done||t.pinned);
  const done=new Set((previous||[]).filter(t=>t.certamen&&(t.done||t.pinned)).map(t=>t.eventId+'|'+(t.topicId||'')+'|'+t.phase));
  const plans=certPlans().filter(p=>p.date>t0&&S.events.some(e=>e.id===p.eventId));
  const blocks=[],firstTheory=new Set();
  plans.forEach(p=>{
    p.leftOut=[];
    const N=clamp(diffDays(t0,p.date),1,7),topics=[...p.topics].sort((a,b)=>(b.hard?1:0)-(a.hard?1:0));
    const offset=o=>clamp(Math.ceil(o*N/7),2,N);
    const put=(n,minutes,phase,topic,priority)=>{
      if(done.has(p.eventId+'|'+(topic?topic.id:'')+'|'+phase))return;
      const key=p.eventId+'|'+(topic?topic.id:''),first=phase==='teoria'&&!firstTheory.has(key);
      if(first)firstTheory.add(key);
      blocks.push({plan:p,date:addDays(p.date,-n),minutes,phase,topic,priority,
        kind:first?'nuevo':CERT_KIND[phase],title:`${CERT_PHASES[phase]} · ${topic?topic.name:p.title}`});
    };
    const size=sessionMin();
    if(N>=3)topics.forEach((t,i)=>put(offset(7-Math.min(i,2)),size,'teoria',t,(t.hard?50:30)+i));
    if(N>=2)topics.forEach((t,i)=>put(offset(4-Math.min(i,1)),size,'ejercicios',t,(t.hard?80:60)+i));
    put(N>=2?2:1,p.mockMin,'ensayo',null,100);
    put(N>=2?2:1,Math.min(30,size),'errores',null,90);
    const rev=topics.slice(0,3),eveParts=[[45],[20,25],[15,15,15]][rev.length-1]||[45];
    rev.forEach((t,i)=>put(1,eveParts[i],'repaso',t,(t.hard?70:40)+i));
    if(N<3)topics.forEach(t=>p.leftOut.push({label:`${CERT_PHASES.teoria} · ${t.name}`,minutes:size}));
    if(N<2)topics.forEach(t=>p.leftOut.push({label:`${CERT_PHASES.ejercicios} · ${t.name}`,minutes:size}));
  });
  const byDate={};
  blocks.forEach(b=>{(byDate[b.date]=byDate[b.date]||[]).push(b)});
  const dates=Object.keys(byDate).sort();
  const sinTarea=planNoTaskDates();
  const budgetFor=(date,b,useFull)=>{
    const cap=planCap(date),share=certShare(date,b.plan,plans);
    const limit=Math.max(0,Math.min(cap,Math.floor(cap*share/5)*5));
    const soft=Math.floor(limit*0.8/5)*5;
    return useFull?limit:Math.max(Math.min(15,limit),soft);
  };
  const roomFor=(date,b,useFull,minutes=b.minutes)=>{
    const budget=budgetFor(date,b,useFull),st=sessionState(date);
    return st.load+minutes<=budget&&st.count<maxSessions()&&(st.courses.size<2||st.courses.has(b.plan.courseId));
  };
  const place=(b,useFull)=>{
    const last=addDays(b.plan.date,-1),earliest=b.phase==='repaso'?last:t0;
    const candidates=[b.date];
    for(let d=earliest;d<=last;d=addDays(d,1))if(d!==b.date)candidates.push(d);
    candidates.sort((a,c)=>Math.abs(diffDays(b.date,a))-Math.abs(diffDays(b.date,c))||a.localeCompare(c));
    for(const d of candidates){
      if(sinTarea.includes(d)||d<earliest||d>last)continue;
      const budget=budgetFor(d,b,useFull);
      let minutes=b.minutes;
      if(budget<minutes&&b.phase!=='ensayo')minutes=Math.max(15,Math.floor(budget/5)*5);
      if(minutes<15||!roomFor(d,b,useFull,minutes))continue;
      const imp=importanceFor({id:b.plan.eventId,title:b.plan.title,courseId:b.plan.courseId});
      commitSession({...b,date:d,minutes,certamen:true,eventId:b.plan.eventId,courseId:b.plan.courseId,
        ...(b.topic?{topicId:b.topic.id}:{}),hint:SESSION_HINT[b.kind],
        why:`Por qué esta sesión: fase ${CERT_PHASES[b.phase].toLowerCase()} de «${b.plan.title}», el ${dshort(b.plan.date)}.`+
          (imp.need!=null?` Nota necesaria: ${Number(imp.need).toFixed(1).replace('.',',')}.`:'')});
      return true;
    }
    return false;
  };
  const first=b=>b.phase==='ensayo'||b.phase==='errores'||b.phase==='repaso'||(b.phase==='teoria'&&!!(b.topic&&b.topic.hard));
  const ordered=[];
  dates.forEach(date=>ordered.push(...byDate[date].filter(first).sort((a,b)=>b.priority-a.priority)));
  dates.forEach(date=>ordered.push(...byDate[date].filter(b=>!first(b)).sort((a,b)=>b.priority-a.priority)));
  const shareOf=b=>certShare(addDays(b.plan.date,-1),b.plan,plans),rank=b=>(first(b)?1:0);
  ordered.sort((a,b)=>shareOf(b)-shareOf(a)||rank(b)-rank(a)||b.priority-a.priority||a.date.localeCompare(b.date));
  const later=[];
  ordered.forEach(b=>{if(!place(b,false))later.push(b)});
  later.forEach(b=>{if(!place(b,true))b.plan.leftOut.push({label:b.title,minutes:b.minutes})});
  plans.forEach(p=>{
    const seen=new Set();
    p.leftOut=p.leftOut.filter(x=>{const k=x.label+'|'+x.minutes;if(seen.has(k))return false;seen.add(k);return true});
  });
}
