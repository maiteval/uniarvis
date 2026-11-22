/* U.A.R.V.I.S. · Experiencia de sesiones: próxima sesión, "¿Cómo te fue?" al terminar el pomodoro,
   mover sesiones a mano (quedan fijas: la replanificación las respeta) y exportar sesiones al calendario. */

let taskMoveId=null;                       // sesión con el formulario "Mover" abierto
let sessionDoneId=null;                    // sesión recién terminada que espera "¿Cómo te fue?"

const pendingToday=()=>S.tasks.filter(t=>t.date===today()&&!t.done)
  .sort((a,b)=>String(a.slotStart||'99:99').localeCompare(String(b.slotStart||'99:99'))||evDate(a).localeCompare(evDate(b)));
function nextSessionTask(){
  const hoy=pendingToday();if(hoy.length)return {task:hoy[0],today:true};
  const nxt=S.tasks.filter(t=>!t.done&&t.date>today()).sort((a,b)=>a.date.localeCompare(b.date)||String(a.slotStart||'').localeCompare(String(b.slotStart||'')))[0];
  return nxt?{task:nxt,today:false}:null;
}
const slotTxt=t=>t.slotStart&&t.slotEnd?`${t.slotStart}–${t.slotEnd}`:'Cuando puedas';
const pomodoroMinutesFor=id=>S.sessions.filter(s=>s.taskId===id&&s.date===today()).reduce((a,s)=>a+s.minutes,0);

/* ---------- "¿Cómo te fue?" (un solo componente para Hoy, la tarjeta de sesión y el pomodoro) ---------- */
function sessionFeedbackHtml(t,opts){
  const o=opts||{},fid=o.fid||'feel';
  const refresh="if(typeof focusActive==='function'&&focusActive())focusRender()";
  return `<div class="feedback-box" role="group" aria-label="¿Cómo te fue en ${esc(t.title)}?" id="${o.id||'fb-'+t.id}">
    <p class="feedback-q"><b>¿Cómo te fue?</b> ${o.subtitle?`<span class="mute">${esc(o.subtitle)}</span>`:''}</p>
    <div class="feedback-opts">${[['bien','Bien','😊'],['medio','Más o menos','😐'],['costo','Me costó','😮‍💨']].map(([v,l,e])=>
      `<button type="button" class="feel-btn ${t.feeling===v?'on':''}" aria-pressed="${t.feeling===v}" data-focus-id="${fid}-${t.id}-${v}" onclick="setTaskFeeling('${t.id}','${v}');${refresh}"><span aria-hidden="true">${e}</span> ${l}</button>`).join('')}</div>
    <label class="mute feedback-real">¿Cuánto estudiaste realmente? <input type="number" min="1" max="600" step="5" value="${Number(t.realMinutes)||t.minutes}" onchange="setTaskReal('${t.id}',this.value)"> min</label>
    <button type="button" class="lnk" data-focus-id="${fid}-done-${t.id}" onclick="closeSessionFeedback();${refresh}">Listo</button></div>`;
}
function closeSessionFeedback(){sessionDoneId=null;if(typeof taskFeedbackId!=='undefined')taskFeedbackId=null;render()}

/* ---------- Tarjeta principal de Hoy ---------- */
function nextSessionHtml(){
  const fbId=sessionDoneId||(typeof taskFeedbackId!=='undefined'?taskFeedbackId:null);
  const fbTask=fbId&&S.tasks.find(t=>t.id===fbId&&t.done);
  if(fbTask)return `<section class="card hero-session done" aria-labelledby="hero-title">
    ${typeof arvis==='function'?arvis('celebrando','¡Sesión terminada! Cuéntame cómo te fue para ajustar lo que viene.',{pequeno:true}):''}
    <h2 id="hero-title">${esc(fbTask.title)}</h2>${sessionFeedbackHtml(fbTask,{id:'hero-feedback'})}</section>`;
  const n=nextSessionTask();
  if(!n)return '';
  const t=n.task,locked=doneToday()>=capFor(today());
  const kind=t.kind?`<span class="tag">${esc(KIND_LABEL[t.kind]||t.kind)}</span>`:'';
  const when=n.today?`Hoy · ${slotTxt(t)}`:`${DAYS[(parse(t.date).getDay()+6)%7]} ${dshort(t.date)} · ${slotTxt(t)}`;
  const mover=taskMoveId===t.id&&!n.today?moveFormHtml(t):'';      // si es de hoy, el formulario se abre en su fila del plan
  const acciones=n.today
    ?`<button class="btn big" data-focus-id="hero-start" onclick="startTaskPomodoro('${t.id}')" ${locked?'disabled':''}>▶ Empezar</button>
      <button class="btn sec" data-focus-id="hero-done" onclick="toggleTask('${t.id}')" ${locked?'disabled':''}>Marcar como hecha</button>
      <button class="btn sec" data-focus-id="hero-move" onclick="openMoveTask('${t.id}');setTimeout(()=>{const f=document.getElementById('mv-date-${t.id}');if(f){f.scrollIntoView({block:'center'});f.focus()}},60)">Mover</button>`
    :`<button class="btn sec" data-focus-id="hero-pull" onclick="pullNext()" ${locked?'disabled':''}>Adelantar a hoy</button>
      <button class="btn sec" data-focus-id="hero-move" onclick="openMoveTask('${t.id}')">Mover</button>`;
  return `<section class="card hero-session" aria-labelledby="hero-title">
    <div class="hero-top"><span class="hero-label">${n.today?'Tu próxima sesión':'No quedan sesiones hoy · la siguiente es'}</span>
      ${typeof topicsOn==='function'&&topicsOn()&&(t.topicIds||[]).length&&typeof aiDemoTag==='function'?aiDemoTag():''}</div>
    <div class="hero-body">
      ${typeof arvisOn==='function'&&arvisOn()?`<img class="hero-arvis" src="icons/arvis/arvis-${n.today?'estudiando':'normal'}.svg" alt="">`:''}
      <div class="hero-main">
        <h2 id="hero-title">${esc(t.title)}</h2>
        <p class="hero-meta"><span aria-hidden="true" class="dot" style="background:${ccolor(t.courseId)}"></span>${esc(cname(t.courseId))} · ${esc(when)} · ${t.minutes} min ${kind}${t.pinned?' <span class="tag">Fijada por ti</span>':''}</p>
        ${t.hint?`<p class="hero-hint">${esc(t.hint)}</p>`:''}
        ${t.why?`<details><summary>Por qué esta sesión</summary><p class="mute">${esc(t.why)}</p></details>`:''}
      </div></div>
    <div class="hero-actions">${acciones}</div>${mover}</section>`;
}

/* ---------- Progreso del día (reemplaza las cajas de 25 min) ---------- */
function dayProgressHtml(cap,min,done){
  const pct=v=>cap>0?clamp(Math.round(v/cap*100),0,100):0;
  return `<div class="day-progress"><div class="day-bar" role="progressbar" aria-label="Estudio de hoy" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${Math.min(done,cap)}" aria-valuetext="${done} de ${cap} minutos; mínimo ${min}">
      <span class="day-fill" style="width:${pct(done)}%"></span><span class="day-min" style="left:${pct(min)}%" aria-hidden="true"></span></div>
    <div class="day-legend mute"><span>${done} min hechos</span><span>Mínimo ${min} min</span><span>Capacidad ${cap} min</span></div></div>`;
}

/* ---------- Mover una sesión (queda fija) ---------- */
function openMoveTask(id){taskMoveId=taskMoveId===id?null:id;render()}
function moveLimit(t){
  const ev=S.events.find(e=>e.id===t.eventId);
  return ev?addDays(ev.date,-1):addDays(today(),60);
}
function moveFormHtml(t){
  const max=moveLimit(t);
  return `<div class="move-form" role="group" aria-label="Mover ${esc(t.title)}">
    <label>Día <input id="mv-date-${t.id}" type="date" min="${today()}" max="${max}" value="${t.date<today()?today():t.date}"></label>
    <label>Hora de inicio <input id="mv-time-${t.id}" type="time" step="300" value="${t.slotStart||''}"></label>
    <button class="btn" data-focus-id="mv-save-${t.id}" onclick="saveMoveTask('${t.id}')">Guardar</button>
    <button class="btn sec" onclick="openMoveTask('${t.id}')">Cancelar</button>
    ${t.pinned?`<button class="lnk" onclick="unpinTask('${t.id}')">Dejar que Arvis la ubique</button>`:''}
    <p class="mute" style="flex-basis:100%;margin:0">La sesión queda fija donde la pongas: al reorganizar, Arvis no la mueve.</p></div>`;
}
function saveMoveTask(id,date,time){
  const t=S.tasks.find(x=>x.id===id&&!x.done);if(!t)return;
  const d=date!=null?date:(($('#mv-date-'+id)||{}).value||''),h=time!=null?time:(($('#mv-time-'+id)||{}).value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d<today())return toast('Elige un día de hoy en adelante.');
  if(d>moveLimit(t))return toast('Ese día ya es la evaluación o después: elige uno antes.');
  if(h&&!/^\d{2}:\d{2}$/.test(h))return toast('Revisa la hora.');
  if(h&&toMin(h)+t.minutes>24*60)return toast('La sesión terminaría después de medianoche.');
  undoable('Sesión movida. Quedó fija en ese horario.',()=>{
    t.date=d;t.pinned=true;
    if(h){t.slotStart=h;t.slotEnd=clockOf(toMin(h)+t.minutes)}else{delete t.slotStart;delete t.slotEnd}
    taskMoveId=null;
  },replanAll);
  announce(`Sesión movida al ${dshort(d)}${h?' a las '+h:''}.`);
}
function unpinTask(id){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  undoable('Listo: Arvis volverá a ubicar esa sesión.',()=>{delete t.pinned;taskMoveId=null},replanAll);
}

/* ---------- Pomodoro → sesión terminada ---------- */
function pomodoroSessionCheck(p){                      // se llama al terminar cada foco
  if(!p||!p.target||p.target.indexOf('task:')!==0)return;
  const t=S.tasks.find(x=>x.id===p.target.slice(5)&&!x.done);if(!t)return;
  const hecho=pomodoroMinutesFor(t.id);
  if(hecho>=t.minutes*0.8)completeSessionFromPomodoro(t,hecho);
}
function completeSessionFromPomodoro(t,minutes){
  const cobertura=typeof topicsOn==='function'&&topicsOn()&&typeof coverageMap==='function'?coverageMap():null;
  t.done=true;t.date=today();t.realMinutes=clamp(Math.round(minutes||pomodoroMinutesFor(t.id)||t.minutes),1,1440);
  if(!S.sessions.some(s=>s.taskId===t.id))S.sessions.push({id:uid(),date:today(),courseId:t.courseId,minutes:t.realMinutes,taskId:t.id});
  sessionDoneId=t.id;
  if(typeof arvisCelebrar==='function')arvisCelebrar('¡Terminaste la sesión! ¿Cómo te fue?','pomodoro');
  announce(`Terminaste ${t.title}. Cuéntame cómo te fue.`);
  if(cobertura)topicsCelebrate(cobertura);
}
function finishSessionNow(id){                         // "Terminé la sesión" desde el pomodoro
  const t=S.tasks.find(x=>x.id===id&&!x.done);if(!t)return;
  completeSessionFromPomodoro(t,pomodoroMinutesFor(t.id)||t.minutes);
  save();render();
  if(typeof focusActive==='function'&&focusActive())focusRender();
}
function pomFocusSessionHtml(){                        // cabecera de la sesión dentro del pomodoro a pantalla completa
  const fb=sessionDoneId&&S.tasks.find(t=>t.id===sessionDoneId&&t.done);
  if(fb)return `<div class="focus-session done"><p class="hero-label">Sesión terminada</p><h3>${esc(fb.title)}</h3>${sessionFeedbackHtml(fb,{id:'focus-feedback',fid:'ffeel',subtitle:`${fb.realMinutes||fb.minutes} min de estudio`})}</div>`;
  const p=pomCfg();if(!p.target||p.target.indexOf('task:')!==0)return '';
  const t=S.tasks.find(x=>x.id===p.target.slice(5)&&!x.done);if(!t)return '';
  const hecho=pomodoroMinutesFor(t.id);
  return `<div class="focus-session"><p class="hero-label">Sesión en curso · ${hecho} de ${t.minutes} min</p><h3>${esc(t.title)}</h3>
    ${t.hint?`<p class="mute">${esc(t.hint)}</p>`:''}
    <button class="btn sec sm" data-focus-id="focus-finish-session" onclick="finishSessionNow('${t.id}')">Terminé la sesión</button></div>`;
}
function pomodoroSessionHtml(){
  const p=pomCfg();
  const fb=sessionDoneId&&S.tasks.find(t=>t.id===sessionDoneId&&t.done);
  if(fb)return `<div class="card session-link done" id="pom-session-feedback"><h3 style="margin-top:0">Terminaste «${esc(fb.title)}»</h3>${sessionFeedbackHtml(fb,{id:'pom-feedback',subtitle:`${fb.realMinutes||fb.minutes} min de estudio`})}</div>`;
  if(!p.target||p.target.indexOf('task:')!==0)return '';
  const t=S.tasks.find(x=>x.id===p.target.slice(5)&&!x.done);if(!t)return '';
  const hecho=pomodoroMinutesFor(t.id),pct=clamp(Math.round(hecho/t.minutes*100),0,100);
  return `<div class="card session-link" id="pom-session"><div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start">
      <div><span class="hero-label">Sesión en curso</span><h3 style="margin:2px 0">${esc(t.title)}</h3>
      ${t.hint?`<p class="mute" style="margin:0">${esc(t.hint)}</p>`:''}</div></div>
    <div class="day-bar" role="progressbar" aria-label="Avance de la sesión" aria-valuemin="0" aria-valuemax="${t.minutes}" aria-valuenow="${Math.min(hecho,t.minutes)}" aria-valuetext="${hecho} de ${t.minutes} minutos"><span class="day-fill" style="width:${pct}%"></span></div>
    <div class="row" style="justify-content:space-between;margin-top:6px"><span class="mute">${hecho} de ${t.minutes} min</span>
      <button class="btn sec" data-focus-id="pom-finish-session" onclick="finishSessionNow('${t.id}')">Terminé la sesión</button></div></div>`;
}

/* ---------- Exportar sesiones al calendario ---------- */
function buildSessionsICS(){
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'),dt=d=>d.replace(/-/g,''),hm=h=>h.replace(':','')+'00';
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//U.A.R.V.I.S.//ES','CALSCALE:GREGORIAN','X-WR-CALNAME:Sesiones de estudio'];
  S.tasks.filter(t=>!t.done&&t.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{
    L.push('BEGIN:VEVENT',`UID:ses-${t.id}@entrenador-academico`,`DTSTAMP:${stamp}`);
    if(t.slotStart&&t.slotEnd)L.push(`DTSTART:${dt(t.date)}T${hm(t.slotStart)}`,`DTEND:${dt(t.date)}T${hm(t.slotEnd)}`);
    else L.push(`DTSTART;VALUE=DATE:${dt(t.date)}`,`DTEND;VALUE=DATE:${dt(addDays(t.date,1))}`);
    L.push(icsFold('SUMMARY:'+icsEsc(`Estudio · ${t.title}`)));
    if(t.hint)L.push(icsFold('DESCRIPTION:'+icsEsc(`${t.minutes} min. ${t.hint}`)));
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n')+'\r\n';
}
function exportSessionsICS(){
  if(!S.tasks.some(t=>!t.done&&t.date>=today()))return toast('Aún no hay sesiones planificadas para exportar.');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([buildSessionsICS()],{type:'text/calendar'}));
  a.download='sesiones-de-estudio.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('Listo: importa las sesiones en tu calendario. Si Arvis reorganiza, vuelve a exportarlas.');
}

/* ---------- Anuncios para lector de pantalla ---------- */
function announce(msg){
  let el=document.getElementById('sr-announce');
  if(!el){el=document.createElement('div');el.id='sr-announce';el.className='sr-only';el.setAttribute('role','status');el.setAttribute('aria-live','polite');document.body.appendChild(el)}
  el.textContent='';setTimeout(()=>{el.textContent=String(msg||'')},50);
}
function semanaMoveHtml(){
  const t=taskMoveId&&S.tasks.find(x=>x.id===taskMoveId&&!x.done);if(!t)return '';
  return `<div class="move-panel" id="move-panel"><p style="margin:0 0 6px"><b>Mover:</b> ${esc(t.title)} <span class="mute">· ${t.minutes} min · ${dshort(t.date)} ${esc(slotTxt(t))}</span></p>${moveFormHtml(t)}</div>`;
}
