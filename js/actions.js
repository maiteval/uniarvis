/* U.A.R.V.I.S. · Acciones del usuario, privacidad y datos de ejemplo */
/* ===================== Acciones ===================== */
function undoable(msg,mutate,after){
  const snap=JSON.stringify(S);
  mutate();if(after)after();
  save();render();
  toast(msg,()=>{S=JSON.parse(snap);save();loadDraft();render();toast('Acción deshecha.')});
}
function go(t,fromRoute){
  stopBreath(true);stopMed(true);
  const r=typeof routeFor==='function'?routeFor(t):{section:'inicio',tab:'inicio'};
  section=r.section;tab=r.tab;
  if(!fromRoute&&typeof hashFor==='function'){
    const h=hashFor(r);
    try{if(h&&location.hash!==h)history.pushState(null,'',h)}catch(e){}
  }
  render();
  if(typeof metricsTrack==='function'){
    metricsTrack('seccion_vista',t);
    if(t==='notas')metricsTrack('notas_calculadas');
  }
  if(tab==='amigos'&&typeof socialOpenTab==='function')socialOpenTab();
}
function goBreath(k){stopBreath(true);stopMed(true);bsel=k;go('respiracion');startBreath()}
function goMed(id){stopBreath(true);stopMed(true);go('respiracion');startMed(id)}
let taskFeedbackId=null;
function toggleTask(id){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  if(!t.done){
    if(doneToday()>=capFor(today()))return toast('Hoy ya completaste tu capacidad. Descansar también es parte del plan.');
    t.done=true;t.date=today();
    taskFeedbackId=id;
    S.sessions.push({id:uid(),date:today(),courseId:t.courseId,minutes:t.minutes,taskId:t.id});
    if(typeof arvisCelebrar==='function')arvisCelebrar();
  }else{
    t.done=false;delete t.feeling;delete t.realMinutes;
    if(taskFeedbackId===id)taskFeedbackId=null;
    S.sessions=S.sessions.filter(x=>x.taskId!==t.id)
  }
  save();
  if(doneToday()>=capFor(today()))replanAll();
  render();
}
function setTaskFeeling(id,feeling){
  const t=S.tasks.find(x=>x.id===id);if(!t||!t.done||['bien','medio','costo'].indexOf(feeling)<0)return;
  t.feeling=feeling;
  if(typeof topicFeedback==='function'&&topicFeedback(t,feeling)){replanAll();render();return}
  save();render();
}
function setTaskReal(id,value){
  const t=S.tasks.find(x=>x.id===id);if(!t||!t.done)return;
  const n=parseInt(value,10);
  if(Number.isInteger(n)&&n>=1)t.realMinutes=Math.min(n,1440);else delete t.realMinutes;
  save();
}
function closeTaskFeedback(){taskFeedbackId=null;render()}
function startTaskPomodoro(id){
  const t=S.tasks.find(x=>x.id===id&&!x.done);if(!t)return;
  if(t.date>today()){
    if(dayLoad(today())+t.minutes>capFor(today()))return toast('Hoy no cabe esa sesión: se priorizó lo que ya está en tu plan.');
    t.date=today();save();
  }
  if(typeof pomSetTarget!=='function')return;
  pomSetTarget('task:'+t.id);go('herramientas');
  if(typeof pomStart==='function')pomStart();
}
function pullNext(){
  const t0=today(),nxt=S.tasks.filter(t=>!t.done&&t.date>t0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!nxt)return;
  if(dayLoad(t0)+nxt.minutes>capFor(t0))return toast('Eso superaría tu capacidad de hoy.');
  nxt.date=t0;save();render();
}
function logFree(){
  const c=$('#fc').value,m=parseInt($('#fm').value,10);
  if(!c||!(m>0))return toast('Elige un ramo y los minutos.');
  if(doneToday()>=capFor(today()))return toast('Hoy ya completaste tu capacidad. Descansar también es parte del plan.');
  S.sessions.push({id:uid(),date:today(),courseId:c,minutes:m});
  if(typeof arvisCelebrar==='function')arvisCelebrar();save();
  if(doneToday()>=capFor(today()))replanAll();
  render();
}
function setMin(){
  const mi=parseInt($('#smin').value,10);
  if(!(mi>=15)||mi>240)return toast('Pon un mínimo entre 15 y 240 minutos.');
  S.settings.min=mi;replanAll();toast('Mínimo actualizado.');render();
}
function setTheme(id){
  if(!themeOk(id))return;
  S.settings.theme=id;S.settings.themeTouched=true;save();render();
}
function setMode(id){
  if(!modeOk(id))return;
  S.settings.mode=id;save();render();
}
function setShare(id,on){const c=course(id);if(!c)return;c.share=!!on;save();render()}
function registrationUniversity(){
  const el=$('#reg-university'),v=String((el&&el.value)||'').trim().slice(0,80);
  return !v||universityOk(v)?v:'';
}
function fieldChronotype(id){
  const el=$(id),v=String((el&&el.value)||'');
  return chronotypeOk(v)?v:'no_se';
}
function registerProfile(){
  const n=($('#reg-name')||{}).value||'',c=($('#reg-career')||{}).value||'';
  const name=String(n).trim(),career=String(c).trim();
  if(!name||!career)return toast('Ingresa tu nombre y carrera.');
  S.profile={name:name.slice(0,60),career:career.slice(0,80),university:registrationUniversity(),nickname:''};
  S.settings.chronotype=fieldChronotype('#reg-chronotype');
  toast(`Bienvenido/a, ${displayName()}.`);
  finishPersonalMode();
}
function profileUniversityField(fallback){
  if(typeof isInstitutional==='function'&&isInstitutional()){
    const i=currentInstitution();
    return i?i.name:(String(fallback||'').slice(0,80));
  }
  const el=$('#pf-university'),v=String((el&&el.value)||'').trim().slice(0,80);
  return universityOk(v)?v:'';
}
function saveProfile(){
  const n=($('#pf-name')||{}).value||'',c=($('#pf-career')||{}).value||'';
  const name=String(n).trim(),career=String(c).trim();
  if(!name||!career)return toast('Ingresa tu nombre y carrera.');
  const nickname=String(($('#pf-nickname')||{}).value||'').trim().slice(0,40);
  S.profile={name:name.slice(0,60),career:career.slice(0,80),university:profileUniversityField(S.profile&&S.profile.university),nickname};
  S.settings.chronotype=fieldChronotype('#pf-chronotype');
  const sesEl=$('#pf-session-min'),maxEl=$('#pf-max-sessions');
  const sv=parseInt((sesEl&&sesEl.value)||'',10),mv=parseInt((maxEl&&maxEl.value)||'',10);
  const session=[45,60,90].indexOf(sv)>=0?sv:60,maxSes=Number.isInteger(mv)&&mv>=1&&mv<=4?mv:2;
  const changed=session!==S.settings.sessionMin||maxSes!==S.settings.maxSessions;
  S.settings.sessionMin=session;S.settings.maxSessions=maxSes;
  if(changed)replanAll();else save();
  toast('Perfil actualizado.');render();
}
function addCourse(){
  const n=$('#cn').value.trim();if(!n)return;
  S.courses.push({id:uid(),name:n,difficulty:parseInt($('#cd').value,10),color:COLORS[S.courses.length%COLORS.length],grades:[],passGrade:institutionPassGrade(),roundFinal:true});
  save();render();
}
function setDiff(id,v){course(id).difficulty=+v;replanAll();render()}
function addGrade(cid){
  const c=course(cid);if(!c)return;
  const name=(($('#gn-'+cid)||{}).value||'').trim(),score=parseNum(($('#gs-'+cid)||{}).value),weight=parseNum(($('#gw-'+cid)||{}).value);
  if(!name)return toast('Ingresa el nombre de la evaluación.');
  if(!isFinite(score))return toast('Ingresa una nota válida (por ejemplo 5,5 o 5.5).');
  if(!isFinite(weight)||weight<0||weight>100)return toast('Ingresa una ponderación entre 0 y 100%.');
  if(!Array.isArray(c.grades))c.grades=[];
  c.grades.push({id:uid(),name:name.slice(0,80),score:Math.round(score*100)/100,weight:Math.round(weight*100)/100});
  if(typeof metricsTrack==='function')metricsTrack('notas_calculadas');
  save();render();
}
function delGrade(cid,gid){const c=course(cid);if(!c)return;undoable('Nota eliminada.',()=>{c.grades=(c.grades||[]).filter(g=>g.id!==gid)})}
function setGrade(cid,gid,field,val){
  const c=course(cid);if(!c)return;const g=(c.grades||[]).find(x=>x.id===gid);if(!g)return;
  if(field==='name')g.name=String(val).trim().slice(0,80);
  else if(field==='score'){const n=parseNum(val);if(isFinite(n))g.score=Math.round(n*100)/100}
  else if(field==='weight'){const n=parseNum(val);if(isFinite(n)&&n>=0&&n<=100)g.weight=Math.round(n*100)/100}
  if(typeof metricsTrack==='function')metricsTrack('notas_calculadas');
  save();render();
}
function setGradeOption(cid,field,val){
  const c=course(cid);if(!c)return;
  if(field==='passGrade'){const n=parseNum(val);if(!isFinite(n)||n<1||n>7)return toast('La nota de aprobación debe estar entre 1,0 y 7,0.');c.passGrade=Math.round(n*100)/100}
  else if(field==='roundFinal')c.roundFinal=!!val;
  if(typeof metricsTrack==='function')metricsTrack('notas_calculadas');
  save();render();
}
function delCourse(id){
  undoable('Ramo eliminado.',()=>{
    S.courses=S.courses.filter(c=>c.id!==id);
    ['classes','events','tasks','sessions'].forEach(k=>S[k]=S[k].filter(x=>x.courseId!==id));
    if(Array.isArray(S.topics))S.topics=S.topics.filter(t=>t.courseId!==id);
  });
}
function addClass(){
  const c=$('#kc').value,d=+$('#kd').value,a=$('#ka').value,b=$('#kb').value;
  if(!c||!a||!b||toMin(b)<=toMin(a))return toast('Revisa ramo y horas.');
  S.classes.push({id:uid(),courseId:c,day:d,start:a,end:b});save();replanAll();render();
}
function delClass(id){undoable('Clase eliminada.',()=>{S.classes=S.classes.filter(x=>x.id!==id)},replanAll)}
function addEvent(){
  const c=$('#ec').value,t=$('#et').value.trim(),d=$('#ed').value,ty=$('#ey').value;
  if(!c||!t||!d)return toast('Completa ramo, título y fecha.');
  S.events.push({id:uid(),courseId:c,title:t,date:d,type:ty});replanAll();render();
}
function delEvent(id){undoable('Fecha eliminada.',()=>{S.events=S.events.filter(e=>e.id!==id);S.tasks=S.tasks.filter(t=>t.eventId!==id||t.done)},()=>replanAll())}

/* ===================== Privacidad y datos ===================== */
async function wipe(){
  if(!await askConfirm({title:'Borrar todos los datos',text:'Se borrarán todos tus datos de este navegador y se desactivará el cifrado, si lo usabas. Esta acción no se puede deshacer.',okLabel:'Borrar todo',danger:true,requireWord:'BORRAR'}))return;
  await dropKey();S=fresh();save();loadDraft();render();toast('Todos los datos de este navegador fueron borrados.');
}
async function deleteHealth(){
  if(!await askConfirm({title:'Borrar datos de bienestar',text:'Se borrarán tus check-ins y tu diario de este navegador. Tu plan seguirá funcionando.',okLabel:'Borrar',danger:true}))return;
  S.wellbeing.diary=[];S.adapt=null;S.soft=null;S.dismissed={};save();loadDraft();replanAll();toast('Tus datos de bienestar fueron borrados.');render();
}
async function exportData(){
  S.lastBackup=today();S.backupSnooze=null;save();
  let body,name;
  if(KEYOBJ){await writeQ;body=localStorage.getItem(KEY);name='entrenador-academico-respaldo-cifrado.json'}   // ya está cifrado
  else{body=JSON.stringify(S,null,2);name='entrenador-academico-respaldo.json'}
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast(KEYOBJ?'Respaldo cifrado descargado. Para restaurarlo necesitarás tu contraseña.':'Respaldo descargado SIN cifrar: guárdalo en un lugar seguro.');render();
}
/* --- Recordatorio de respaldo (los datos viven solo en este navegador) --- */
function backupDue(){
  if(!S.courses.length)return false;
  if(diffDays(S.lastBackup||S.createdAt,today())<14)return false;
  return !S.backupSnooze||S.backupSnooze<=today();
}
function snoozeBackup(){S.backupSnooze=addDays(today(),7);save();render()}
function backupHtml(){
  if(!backupDue())return '';
  const n=diffDays(S.lastBackup||S.createdAt,today());
  return `<div class="banner info">Tus datos viven solo en este navegador: si se borran, se pierden. ${S.lastBackup?`Hace ${n} días que no guardas un respaldo.`:'Aún no has guardado ningún respaldo.'}
    <div class="row" style="margin-top:8px"><button class="btn sec" onclick="exportData()">Descargar respaldo</button>
    <button class="btn sec" onclick="snoozeBackup()">Recordármelo en una semana</button></div></div>`;
}

/* --- Restaurar respaldo: se valida todo y solo se copian campos conocidos (un archivo ajeno no puede inyectar HTML) --- */
const RX={id:/^[\w-]{1,40}$/,date:/^\d{4}-\d{2}-\d{2}$/,time:/^\d{2}:\d{2}$/,color:/^#[0-9a-fA-F]{6}$/};
function validState(j){
  if(!j||typeof j!=='object'||Array.isArray(j))return 'no es un respaldo';
  const str=(v,n)=>typeof v==='string'&&v.length<=n,int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b,num=(v,a,b)=>typeof v==='number'&&v>=a&&v<=b;
  for(const k of ['courses','classes','events','tasks','sessions'])if(!Array.isArray(j[k]))return 'falta '+k;
  for(const c of j.courses){
    if(!(c&&RX.id.test(c.id)&&str(c.name,120)&&int(c.difficulty,1,5)&&RX.color.test(c.color)))return 'ramos';
    if(c.share!==undefined&&typeof c.share!=='boolean')return 'ramos';
    if(c.passGrade!==undefined&&!num(c.passGrade,1,7))return 'notas';
    if(c.roundFinal!==undefined&&typeof c.roundFinal!=='boolean')return 'notas';
    if(c.origin!==undefined&&c.origin!=='udec-demo')return 'ramos';
    if(c.syllabusNotes!==undefined&&!str(c.syllabusNotes,2000))return 'ramos';
    if(c.grades!==undefined){
      if(!Array.isArray(c.grades))return 'notas';
      for(const g of c.grades)if(!(g&&RX.id.test(g.id)&&str(g.name,80)&&(g.score===undefined||g.score===null||num(g.score,-100,100))&&num(g.weight,0,100)))return 'notas';
    }
  }
  for(const k of j.classes){
    if(!(k&&RX.id.test(k.id)&&RX.id.test(k.courseId)&&int(k.day,0,6)&&RX.time.test(k.start)&&RX.time.test(k.end)))return 'horario';
    if(k.origin!==undefined&&k.origin!=='udec-demo')return 'horario';
  }
  for(const e of j.events){
    if(!(e&&RX.id.test(e.id)&&RX.id.test(e.courseId)&&str(e.title,200)&&RX.date.test(e.date)&&Object.prototype.hasOwnProperty.call(TYPE_LABEL,e.type)))return 'fechas';
    if(e.src!==undefined&&!(e.src&&typeof e.src==='object'&&!Array.isArray(e.src)&&RX.id.test(e.src.owner)&&RX.id.test(e.src.id)))return 'fechas';
    if(e.origin!==undefined&&e.origin!=='udec-demo')return 'fechas';
    if(e.topicIds!==undefined&&!(Array.isArray(e.topicIds)&&e.topicIds.length<=60&&e.topicIds.every(id=>RX.id.test(id))))return 'fechas';
    if(e.topicsManual!==undefined&&typeof e.topicsManual!=='boolean')return 'fechas';
  }
  if(j.topics!==undefined){
    if(!Array.isArray(j.topics)||j.topics.length>2000)return 'temas';
    for(const t of j.topics)if(!validTopic(t))return 'temas';
  }
  if(j.skipDay!==undefined&&j.skipDay!==null&&!(typeof j.skipDay==='string'&&RX.date.test(j.skipDay)))return 'fechas';
  for(const t of j.tasks){
    if(!(t&&RX.id.test(t.id)&&RX.id.test(t.eventId)&&RX.id.test(t.courseId)&&str(t.title,300)&&RX.date.test(t.date)&&num(t.minutes,1,600)&&typeof t.done==='boolean'))return 'tareas';
    if(t.kind!==undefined&&!str(t.kind,40))return 'tareas';
    if(t.chrono!==undefined&&!str(t.chrono,120))return 'tareas';
    if(t.certamen!==undefined&&typeof t.certamen!=='boolean')return 'tareas';
    if(t.phase!==undefined&&!str(t.phase,40))return 'tareas';
    if(t.topicId!==undefined&&!RX.id.test(t.topicId))return 'tareas';
    if(t.slotStart!==undefined&&!RX.time.test(t.slotStart))return 'tareas';
    if(t.slotEnd!==undefined&&!RX.time.test(t.slotEnd))return 'tareas';
    if(t.hint!==undefined&&!str(t.hint,160))return 'tareas';
    if(t.why!==undefined&&!str(t.why,240))return 'tareas';
    if(t.feeling!==undefined&&['bien','medio','costo'].indexOf(t.feeling)<0)return 'tareas';
    if(t.realMinutes!==undefined&&!num(t.realMinutes,1,1440))return 'tareas';
    if(t.topicIds!==undefined&&!(Array.isArray(t.topicIds)&&t.topicIds.length<=3&&t.topicIds.every(id=>RX.id.test(id))))return 'tareas';
    if(t.topicFb!==undefined&&['bien','medio','costo'].indexOf(t.topicFb)<0)return 'tareas';
  }
  for(const s of j.sessions)if(!(s&&RX.id.test(s.id)&&RX.id.test(s.courseId)&&RX.date.test(s.date)&&num(s.minutes,1,1440)&&(s.taskId===undefined||RX.id.test(s.taskId))&&(s.socialId===undefined||RX.id.test(s.socialId))))return 'sesiones';
  if(j.profile!==undefined){
    if(!j.profile||typeof j.profile!=='object'||Array.isArray(j.profile))return 'perfil';
    if(j.profile.name!==undefined&&!str(j.profile.name,60))return 'perfil';
    if(j.profile.career!==undefined&&!str(j.profile.career,80))return 'perfil';
    if(j.profile.university!==undefined&&!str(j.profile.university,80))return 'perfil';
    if(j.profile.nickname!==undefined&&!str(j.profile.nickname,40))return 'perfil';
  }
  if(j.settings!==undefined){
    if(!j.settings||typeof j.settings!=='object'||Array.isArray(j.settings))return 'ajustes';
    if(j.settings.arvis!==undefined&&typeof j.settings.arvis!=='boolean')return 'ajustes';
    if(j.settings.themeTouched!==undefined&&typeof j.settings.themeTouched!=='boolean')return 'ajustes';
    if(j.settings.chronotype!==undefined&&!chronotypeOk(j.settings.chronotype))return 'ajustes';
    if(j.settings.sessionMin!==undefined&&[45,60,90].indexOf(j.settings.sessionMin)<0)return 'ajustes';
    if(j.settings.maxSessions!==undefined&&!int(j.settings.maxSessions,1,4))return 'ajustes';
    if(j.settings.paceFactor!==undefined&&!num(j.settings.paceFactor,0.7,1.4))return 'ajustes';
  }
  if(j.account!==undefined){
    if(!j.account||typeof j.account!=='object'||Array.isArray(j.account))return 'cuenta';
    if(j.account.type!==undefined&&j.account.type!==null&&j.account.type!=='personal'&&j.account.type!=='institucional')return 'cuenta';
    if(j.account.auth!==undefined&&j.account.auth!==null&&!validAuth(j.account.auth))return 'cuenta';
    if(j.account.studentId!==undefined&&!str(j.account.studentId,40))return 'cuenta';
    if(j.account.password!==undefined||j.account.code!==undefined)return 'cuenta';
  }
  const dia=j.wellbeing&&j.wellbeing.diary;
  if(dia!==undefined){
    if(!Array.isArray(dia))return 'diario';
    for(const e of dia)if(!(e&&RX.date.test(e.date)&&[e.mood,e.energy,e.sleep].every(v=>v==null||int(v,1,5))&&(e.tags===undefined||(Array.isArray(e.tags)&&e.tags.every(t=>str(t,40))))&&(e.note===undefined||str(e.note,5000))))return 'diario';
  }
  if(j.tools!==undefined&&!validTools(j.tools))return 'herramientas';
  if(j.weeklySummary!==undefined){
    if(!j.weeklySummary||typeof j.weeklySummary!=='object'||Array.isArray(j.weeklySummary))return 'resumen semanal';
    if(j.weeklySummary.dismissedWeek!==undefined&&j.weeklySummary.dismissedWeek!==null&&!(typeof j.weeklySummary.dismissedWeek==='string'&&RX.date.test(j.weeklySummary.dismissedWeek)))return 'resumen semanal';
  }
  if(j.certamen!==undefined){
    if(!j.certamen||typeof j.certamen!=='object'||Array.isArray(j.certamen)||!Array.isArray(j.certamen.plans))return 'modo certamen';
    for(const p of j.certamen.plans){
      if(!(p&&RX.id.test(p.eventId)&&RX.id.test(p.courseId)&&str(p.title,200)&&RX.date.test(p.date)&&int(p.mockMin,30,240)&&Array.isArray(p.topics)))return 'modo certamen';
      for(const t of p.topics)if(!(t&&RX.id.test(t.id)&&str(t.name,80)&&typeof t.hard==='boolean'))return 'modo certamen';
      if(p.leftOut!==undefined&&(!Array.isArray(p.leftOut)||p.leftOut.some(x=>!(x&&str(x.label,300)&&int(x.minutes,0,600)))))return 'modo certamen';
    }
    if(j.certamen.topicsByCourse!==undefined){
      const m=j.certamen.topicsByCourse;
      if(!m||typeof m!=='object'||Array.isArray(m))return 'modo certamen';
      for(const k of Object.keys(m))if(!RX.id.test(k)||!Array.isArray(m[k])||m[k].some(x=>!str(x,80)))return 'modo certamen';
    }
  }
  return null;
}
function cleanState(j){
  const c=fresh();
  c.classes=j.classes.map(k=>({...k}));
  c.tasks=j.tasks.map(t=>{
    const o={id:t.id,eventId:t.eventId,courseId:t.courseId,title:String(t.title||'').slice(0,300),date:t.date,minutes:+t.minutes,done:t.done===true};
    if(typeof t.kind==='string')o.kind=t.kind.slice(0,40);
    if(typeof t.chrono==='string')o.chrono=t.chrono.slice(0,120);
    if(t.certamen===true)o.certamen=true;
    if(typeof t.phase==='string')o.phase=t.phase.slice(0,40);
    if(RX.id.test(t.topicId||''))o.topicId=t.topicId;
    ['slotStart','slotEnd'].forEach(k=>{if(RX.time.test(t[k]||''))o[k]=t[k]});
    if(typeof t.hint==='string')o.hint=t.hint.slice(0,160);
    if(typeof t.why==='string')o.why=t.why.slice(0,240);
    if(['bien','medio','costo'].indexOf(t.feeling)>=0)o.feeling=t.feeling;
    if(Number.isFinite(t.realMinutes))o.realMinutes=clamp(Math.round(t.realMinutes),1,1440);
    if(Array.isArray(t.topicIds)&&t.topicIds.length)o.topicIds=t.topicIds.filter(id=>RX.id.test(id)).slice(0,3);
    if(['bien','medio','costo'].indexOf(t.topicFb)>=0)o.topicFb=t.topicFb;
    return o;
  });
  c.events=j.events.map(e=>{const o={id:e.id,courseId:e.courseId,title:String(e.title||'').slice(0,200),date:e.date,type:e.type};if(e.early)o.early=true;if(e.src)o.src={owner:String(e.src.owner).slice(0,40),id:String(e.src.id).slice(0,40)};if(e.origin==='udec-demo')o.origin=e.origin;if(Array.isArray(e.topicIds))o.topicIds=e.topicIds.filter(id=>RX.id.test(id)).slice(0,60);if(e.topicsManual===true)o.topicsManual=true;return o});
  c.sessions=j.sessions.map(s=>{const o={id:s.id,date:s.date,courseId:s.courseId,minutes:+s.minutes};if(s.taskId)o.taskId=s.taskId;if(s.socialId)o.socialId=s.socialId;return o});
  c.courses=(j.courses||[]).map(x=>({id:x.id,name:x.name,difficulty:x.difficulty,color:x.color,share:x.share===true,
    passGrade:Number.isFinite(x.passGrade)?x.passGrade:4,roundFinal:x.roundFinal!==false,
    syllabusNotes:typeof x.syllabusNotes==='string'?x.syllabusNotes.slice(0,2000):'',
    ...(x.origin==='udec-demo'?{origin:x.origin,code:x.code,section:x.section}:{}),
    grades:(x.grades||[]).map(g=>({id:g.id,name:String(g.name||'').slice(0,80),...(g.score!=null?{score:+g.score}:{}),weight:+g.weight}))}));
  const ss=j.settings&&typeof j.settings==='object'?j.settings:{};
  c.settings={min:int15(ss.min)?ss.min:60,sessionMin:[45,60,90].indexOf(ss.sessionMin)>=0?ss.sessionMin:60,
    maxSessions:Number.isInteger(ss.maxSessions)&&ss.maxSessions>=1&&ss.maxSessions<=4?ss.maxSessions:2,
    paceFactor:Number.isFinite(ss.paceFactor)?clamp(ss.paceFactor,0.7,1.4):1,
    theme:themeOk(ss.theme)?ss.theme:'cian',themeTouched:ss.themeTouched===true,mode:modeOk(ss.mode)?ss.mode:'light',style:styleOk(ss.style)?ss.style:'calma',arvis:ss.arvis!==false,chronotype:chronotypeOk(ss.chronotype)?ss.chronotype:'no_se'};
  const a=j.account&&typeof j.account==='object'&&!Array.isArray(j.account)?j.account:null;
  const known=a&&(a.type==='personal'||a.type==='institucional');
  const knownInst=known&&a.type==='institucional'&&institutionById(a.institutionId);
  c.account={type:known&&(a.type==='personal'||knownInst)?a.type:'personal',
    institutionId:knownInst?a.institutionId:'',email:a&&typeof a.email==='string'?a.email.slice(0,120):'',
    linkedAt:a&&RX.date.test(a.linkedAt||'')?a.linkedAt:null,
    auth:knownInst?cleanAuth(a&&a.auth):null,
    studentId:knownInst&&a&&typeof a.studentId==='string'?a.studentId.slice(0,40):''};
  c.institutionConsentAt=RX.date.test(j.institutionConsentAt||'')?j.institutionConsentAt:null;
  c.topics=cleanTopics(j.topics);
  c.skipDay=null;
  c.weeklySummary={dismissedWeek:j.weeklySummary&&RX.date.test(j.weeklySummary.dismissedWeek||'')?j.weeklySummary.dismissedWeek:null};
  c.tools=cleanTools(j.tools);
  c.wellbeing={diary:((j.wellbeing&&j.wellbeing.diary)||[]).map(e=>({date:e.date,mood:e.mood??null,energy:e.energy??null,sleep:e.sleep??null,tags:e.tags||[],note:e.note||'',ts:Number(e.ts)||0}))};
  c.support={name:String((j.support&&j.support.name)||'').slice(0,120),contact:String((j.support&&j.support.contact)||'').slice(0,300)};
  c.consent=j.consent&&typeof j.consent.health==='boolean'?{health:j.consent.health,at:today()}:null;
  c.lastBackup=typeof j.lastBackup==='string'&&RX.date.test(j.lastBackup)?j.lastBackup:null;
  if(j.profile&&typeof j.profile==='object'){
    c.profile={name:String(j.profile.name||'').slice(0,60),career:String(j.profile.career||'').slice(0,80),university:String(j.profile.university||'').slice(0,80),nickname:String(j.profile.nickname||'').slice(0,40)};
    if(c.account.type==='institucional'&&knownInst&&institutionById(c.account.institutionId))
      c.profile.university=institutionById(c.account.institutionId).name;
  }
  c.certamen={plans:[],topicsByCourse:{}};
  const cp=j.certamen&&j.certamen;
  if(cp&&Array.isArray(cp.plans))c.certamen.plans=cp.plans.filter(p=>p&&j.events.some(e=>e.id===p.eventId)).map(p=>({
    eventId:p.eventId,courseId:p.courseId,title:String(p.title||'').slice(0,200),date:p.date,
    mockMin:Number.isInteger(p.mockMin)&&p.mockMin>=30&&p.mockMin<=240?p.mockMin:90,
    topics:(p.topics||[]).map(t=>({id:RX.id.test(t.id)?t.id:uid(),name:String(t.name||'').slice(0,80),hard:t.hard===true})),
    leftOut:(p.leftOut||[]).filter(x=>x&&typeof x.label==='string').map(x=>({label:x.label.slice(0,300),minutes:Number.isInteger(x.minutes)&&x.minutes>=0&&x.minutes<=600?x.minutes:0}))
  }));
  if(cp&&cp.topicsByCourse&&typeof cp.topicsByCourse==='object')Object.keys(cp.topicsByCourse).forEach(k=>{
    if(RX.id.test(k))c.certamen.topicsByCourse[k]=cp.topicsByCourse[k].slice(0,20).map(x=>String(x||'').slice(0,80));
  });
  return c;
}
const int15=v=>Number.isInteger(v)&&v>=15&&v<=240;
async function importData(inp){
  const f=inp.files[0];if(!f)return;
  try{
    const j=JSON.parse(await f.text());
    if(j&&j.enc){                                  // respaldo cifrado: se instala tal cual y la app pedirá la contraseña
      if(!validBlob(j))throw new Error('archivo cifrado dañado');
      if(!await askConfirm({title:'Restaurar respaldo cifrado',text:'Se reemplazarán los datos actuales y la app te pedirá la contraseña con la que se cifró.',okLabel:'Restaurar'})){inp.value='';return}
      await dropKey();localStorage.setItem(KEY,JSON.stringify(j));location.reload();return;
    }
    const err=validState(j);
    if(err)throw new Error(err);
    if(!await askConfirm({title:'Restaurar respaldo',text:'Esto reemplazará todos los datos actuales de este navegador por los del respaldo.',okLabel:'Restaurar'})){inp.value='';return}
    S=cleanState(j);instSessionClear();save();loadDraft();replanAll();toast('Respaldo restaurado.');render();
  }catch(e){toast('Ese archivo no parece un respaldo válido de esta app ('+e.message+').')}
  inp.value='';
}

/* --- Exportar fechas importantes a tu calendario (.ics) --- */
function icsFold(line){const cs=Array.from(line),out=[];while(cs.length>60)out.push(cs.splice(0,60).join(''));out.push(cs.join(''));return out.join('\r\n ')}
const icsEsc=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
function buildICS(){
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'),dt=d=>d.replace(/-/g,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//U.A.R.V.I.S.//ES','CALSCALE:GREGORIAN'];
  S.events.forEach(e=>L.push('BEGIN:VEVENT',`UID:${e.id}@entrenador-academico`,`DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dt(e.date)}`,`DTEND;VALUE=DATE:${dt(addDays(e.date,1))}`,
    icsFold('SUMMARY:'+icsEsc(`${TYPE_LABEL[e.type]} · ${cname(e.courseId)} · ${e.title}`)),'END:VEVENT'));
  L.push('END:VCALENDAR');
  return L.join('\r\n')+'\r\n';
}
function exportICS(){
  if(!S.events.length)return toast('Aún no hay fechas para exportar.');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([buildICS()],{type:'text/calendar'}));
  a.download='fechas-importantes.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('Listo: importa el archivo en Google Calendar, Outlook o Apple Calendar.');
}

/* --- Importar horario desde .ics: se lee en el navegador y no se guarda sin confirmación --- */
async function onICSFile(inp){
  const f=inp&&inp.files&&inp.files[0];if(!f)return;
  inp.value='';
  icsPending=null;icsEvaluations=[];
  if(f.size>ICS_MAX_BYTES){icsNotice='El archivo .ics pesa más de 2 MB. No se guardó nada.';render();toast(icsNotice);return}
  try{
    const r=parseICS(await f.text());
    icsNotice=r.warnings[0]||'';icsEvaluations=r.evaluations||[];
    if(!r.blocks.length){
      render();
      toast(r.evaluations.length?'No encontré clases semanales: los eventos sueltos se muestran como posibles evaluaciones.':'No encontré horarios semanales en ese archivo.');
      return;
    }
    icsPending=r.blocks.map(b=>({name:String(b.name).slice(0,80),day:b.day,start:b.start,end:b.end,count:b.count,location:b.location||'',keep:true,
      courseId:S.courses.length?S.courses[0].id:'new'}));
    render();
    toast(`${icsPending.length} bloque(s) semanales detectados. Revísalos antes de confirmar.`);
  }catch(e){icsNotice='No pude leer ese archivo .ics.';render();toast(icsNotice)}
}
function setICSBlock(i,k,v){if(icsPending&&icsPending[i])icsPending[i][k]=v}
function cancelICS(){icsPending=null;icsNotice='';icsEvaluations=[];render()}
function confirmICS(){
  if(!icsPending)return;
  let added=0,created=0;
  icsPending.forEach(b=>{
    if(!b.keep)return;
    let cid=b.courseId;
    if(!cid||cid==='new'||!course(cid)){
      const name=String(b.name||'').trim().slice(0,80);if(!name)return;
      cid=uid();S.courses.push({id:cid,name:name,difficulty:3,color:COLORS[S.courses.length%COLORS.length],grades:[],passGrade:institutionPassGrade(),roundFinal:true});created++;
    }
    if(S.classes.some(k=>k.courseId===cid&&k.day===b.day&&k.start===b.start&&k.end===b.end))return;
    S.classes.push({id:uid(),courseId:cid,day:b.day,start:b.start,end:b.end});added++;
  });
  icsPending=null;icsNotice='';icsEvaluations=[];
  if(added||created){
    if(typeof metricsTrack==='function')metricsTrack('ics_importado');
    save();replanAll();toast(`${added} clase(s) agregadas${created?` y ${created} ramo(s) creados`:''}.`);
  }
  render();
}

function fillUdeC(){S.support={name:'DISE UdeC · Bienestar Estudiantil',contact:'bienestar@udec.cl · dise.udec.cl'};save();toast('Guardado. Verifica horarios y cómo pedir hora en el sitio oficial.');render()}
function saveSupport(){S.support={name:$('#sn').value.trim().slice(0,120),contact:$('#sc').value.trim().slice(0,300)};save();toast('Guardado en este navegador.');render()}

async function loadDemo(){
  if(S.courses.length&&!await askConfirm({title:'Cargar datos de ejemplo',text:'Esto reemplazará tus datos actuales por los del ejemplo.',okLabel:'Cargar'}))return;
  const perfil=S.profile,cuenta=S.account,consentAt=S.institutionConsentAt;
  S=fresh();inval();const t=today();
  if(perfil&&perfil.name)S.profile=perfil;
  if(cuenta)S.account=cuenta;
  if(consentAt)S.institutionConsentAt=consentAt;
  S.consent={health:true,at:t};                    // el ejemplo activa el check-in para poder probarlo
  const C0=(n,d,i)=>({id:uid(),name:n,difficulty:d,color:COLORS[i],grades:[],passGrade:institutionPassGrade(),roundFinal:true});
  const cs=[C0('Cálculo III',5,0),C0('Termodinámica',4,1),C0('Estadística',3,2),C0('Economía',2,3)];
  S.courses=cs;
  [[0,0,'08:10','09:40'],[0,2,'08:10','09:40'],[1,1,'10:15','11:45'],[1,3,'10:15','11:45'],[2,0,'14:30','16:00'],[2,3,'14:30','16:00'],[3,4,'08:10','09:40']]
    .forEach(([ci_,d,a,b])=>S.classes.push({id:uid(),courseId:cs[ci_].id,day:d,start:a,end:b}));
  [[0,6,'Certamen 2','evaluacion'],[1,9,'Certamen 1','evaluacion'],[2,8,'Entrega informe de laboratorio','entrega'],[3,12,'Control 2','control'],[0,22,'Certamen 3','evaluacion'],[2,24,'Examen','evaluacion']]
    .forEach(([ci_,off,ti,ty])=>S.events.push({id:uid(),courseId:cs[ci_].id,title:ti,date:addDays(t,off),type:ty}));
  const mon=mondayOf(t);                           // fechas pasadas para que el diario pueda mostrar patrones
  [[0,-6,'Certamen 1','evaluacion'],[1,-5,'Control 1','control'],[2,-3,'Entrega 1','entrega'],[3,-12,'Control 1','control'],
   [0,-20,'Certamen 0','evaluacion'],[1,-19,'Informe previo','entrega'],[2,-18,'Control 1','control'],[3,-25,'Control 0','control']]
    .forEach(([ci_,off,ti,ty])=>S.events.push({id:uid(),courseId:cs[ci_].id,title:ti,date:addDays(mon,off),type:ty}));
  const factor=[0.9,0.35,1,1.1];                   // Termodinámica con poca atención, para ver la carga por semana
  for(let k=1;k<=20;k++)cs.forEach((c,i)=>{
    if(Math.random()<0.7)S.sessions.push({id:uid(),date:addDays(t,-k),courseId:c.id,minutes:Math.round((20+Math.random()*50)*factor[i])});
  });
  const r=()=>Math.random()-0.5;
  for(let k=1;k<=24;k++){
    if(Math.random()<0.15)continue;
    const d=addDays(t,-k),wl=S.events.filter(e=>e.type!=='otro'&&mondayOf(e.date)===mondayOf(d)).length,heavy=wl>=3;
    S.wellbeing.diary.push({date:d,mood:clamp(Math.round(3.9-(heavy?1.3:0)+r()*1.2),1,5),energy:clamp(Math.round(3.8-(heavy?1:0)+r()*1.2),1,5),
      sleep:clamp(Math.round(3.6-(heavy?1:0)+r()*1.2),1,5),tags:[],note:'',ts:Date.now()});
  }
  loadDraft();replanAll();toast('Datos de ejemplo cargados. Activé el check-in solo para el ejemplo; puedes revocarlo en Ajustes → Privacidad.');render();
}
function setStyle(id){
  if(!styleOk(id))return;
  S.settings.style=id;save();render();
}
function setArvis(on){
  S.settings.arvis=!!on;save();render();
}
function openCourseFlashcards(courseId){
  const F=(S.tools&&S.tools.flashcards)||freshFlashcards();
  const d=F.decks.find(x=>x.courseId===courseId);
  if(!d)return toast('Ese ramo aún no tiene mazos de flashcards.');
  setActiveFlashcardDeck(d.id);go('herramientas');
}
function startCertPomodoro(eventId,taskId){
  const t=S.tasks.find(x=>x.id===taskId&&x.certamen&&x.eventId===eventId&&!x.done);if(!t)return;
  if(t.date>today()){
    if(dayLoad(today())+t.minutes>capFor(today()))return toast('Hoy no cabe ese bloque: se priorizó lo que ya está en tu plan.');
    t.date=today();save();
  }
  pomSetTarget('task:'+t.id);go('herramientas');pomStart();
}
