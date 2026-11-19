const CHAT_MAX_MSGS=60,CHAT_MAX_LEN=400;
let chatOpen=false,chatMsgs=[],chatProposals={},chatBusy=false,chatWasAvailable=false;

function chatAvailable(){
  if(typeof LOCKED!=='undefined'&&LOCKED)return false;
  if(typeof isInstitutional!=='function'||!isInstitutional())return false;
  if(!S||!S.profile||!S.profile.name)return false;
  if(typeof InstitutionalFlow!=='undefined'&&InstitutionalFlow.get())return false;
  if(typeof instImport!=='undefined'&&instImport)return false;
  return true;
}

const CHAT_MONTHS={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
const CHAT_WEEKDAYS={lunes:0,martes:1,miercoles:2,jueves:3,viernes:4,sabado:5,domingo:6};
const chatCap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

function chatBuildDate(d,mo,y){
  if(!(mo>=1&&mo<=12&&d>=1&&d<=31))return null;
  const t0=today(),cy=+t0.slice(0,4);
  const year=y?(+y<100?2000+(+y):+y):cy;
  let s=`${year}-${pad(mo)}-${pad(d)}`;
  if(fmt(parse(s))!==s)return null;
  if(!y&&s<t0)return `${year+1}-${pad(mo)}-${pad(d)}`;
  return s;
}
function chatParseDate(t){
  const t0=today();
  if(/\bpasado manana\b/.test(t))return addDays(t0,2);
  if(/\bmanana\b/.test(t))return addDays(t0,1);
  if(/\bhoy\b/.test(t))return t0;
  let m=t.match(/\ben (\d{1,2}) dias?\b/);
  if(m)return addDays(t0,+m[1]);
  m=t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if(m)return chatBuildDate(+m[1],+m[2],m[3]);
  m=t.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?\b/);
  if(m)return chatBuildDate(+m[1],CHAT_MONTHS[m[2]],m[3]);
  m=t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if(m){
    const dow=(parse(t0).getDay()+6)%7,target=CHAT_WEEKDAYS[m[1]];
    let d=(target-dow+7)%7;if(d===0)d=7;
    if(/\b(proximo|siguiente|subsiguiente)\b/.test(t)&&/semana que viene|la otra semana/.test(t))d+=7;
    return addDays(t0,d);
  }
  return null;
}
function chatFindCourse(t){
  let best=null,score=0;
  (S.courses||[]).forEach(c=>{
    const n=norm(c.name);
    let sc=t.includes(n)?100:0;
    const words=n.split(/[^a-z0-9]+/).filter(w=>w.length>=4);
    words.forEach(w=>{if(new RegExp('\\b'+w).test(t))sc+=w.length});
    if(!sc)t.split(/[^a-z0-9]+/).filter(w=>w.length>=4).forEach(w=>{if(words.some(x=>x.startsWith(w)))sc+=w.length});
    if(sc>score){score=sc;best=c}
  });
  return best;
}
function chatEventType(t){
  if(/\b(certamen|prueba|examen|evaluacion|solemne|parcial)\b/.test(t))return 'evaluacion';
  if(/\bcontrol\b/.test(t))return 'control';
  if(/\b(entrega|tarea|informe|trabajo|proyecto|laboratorio)\b/.test(t))return 'entrega';
  return 'otro';
}
function chatEventTitle(raw,type){
  const t=norm(raw);
  const m=t.match(/\b(certamen|prueba|examen|control|solemne|parcial|entrega|tarea|informe|laboratorio|proyecto)\s*(\d{1,2})?\b/);
  return m?chatCap(m[1])+(m[2]?' '+m[2]:''):(TYPE_LABEL[type]||'Evaluación');
}

const chatTodayTasks=()=>(S.tasks||[]).filter(t=>t.date===today()&&!t.done);
function chatUpcoming(days){
  const t0=today();
  return (S.events||[]).filter(e=>e.date>=t0&&diffDays(t0,e.date)<=days).sort((a,b)=>a.date.localeCompare(b.date));
}
function chatWhen(date){
  const d=diffDays(today(),date);
  if(d===0)return 'hoy';
  if(d===1)return 'mañana';
  return `${DAYS[(parse(date).getDay()+6)%7].toLowerCase()} ${dshort(date)} (en ${d} días)`;
}
const CHAT_HELP_KEYS=[
  [/check.?in|como me siento|energia/,'checkin'],[/pomodoro|flashcard|tarjeta|herramienta/,'herramientas'],
  [/syllabus|programa del ramo/,'syllabus'],[/nota|ponderac|promedio/,'notas'],[/horario|ramo|clase/,'ramos'],
  [/respira|medita/,'respiracion'],[/pausa/,'pausas'],[/amig|social/,'amigos'],[/semana|calendario/,'semana'],
  [/\bhoy\b|plan del dia|micro.?tarea/,'hoy'],[/carga|calor/,'salud'],[/privacidad|datos personales|respaldo/,'privacidad'],
  [/tema|apariencia|modo oscuro|color/,'tema'],[/perfil/,'perfil'],[/apoyo|ayuda profesional|psicolog/,'apoyo'],[/inicio/,'inicio']
];
function chatHelpKey(t){const hit=CHAT_HELP_KEYS.find(([rx])=>rx.test(t));return hit?hit[1]:null}
const CHAT_TAB_LABEL={hoy:'Hoy',semana:'Semana',ramos:'Mis ramos',syllabus:'Syllabus',notas:'Notas',herramientas:'Herramientas',salud:'Carga por semana',
  checkin:'Check-in',respiracion:'Respiración',pausas:'Pausas',apoyo:'Apoyo',amigos:'Amigos',perfil:'Perfil',tema:'Apariencia',privacidad:'Privacidad',inicio:'Inicio',cuenta:'Cuenta'};
const chatGoAction=k=>({label:'Ir a '+(CHAT_TAB_LABEL[k]||k),go:k});
const CHAT_CRISIS=/suicid|matarme|quitarme la vida|no quiero vivir|hacerme dano|autolesion|cortarme|desaparecer para siempre|no vale la pena vivir/;

function chatBrain(raw){
  const t=norm(String(raw||''));
  const inst=currentInstitution();
  // TODO (versión con licencia): reemplazar chatBrain() por una llamada a una Edge Function de Supabase con un modelo de lenguaje, enviando solo el contexto mínimo (ramos, fechas y tareas; nunca datos de bienestar).

  if(CHAT_CRISIS.test(t))return {estado:'preocupado',
    text:'Gracias por contármelo. Lo que sientes importa y no tienes que pasarlo sola/o. Por favor habla ahora con alguien que pueda acompañarte:',
    list:['Línea de Prevención del Suicidio: *4141 desde un celular (gratuita, 24/7).','Salud Responde: 600 360 7777.','Si hay peligro inmediato: 131 (ambulancia) o 133.',
      inst?`${inst.support.service}: ${inst.support.email} · ${inst.support.phone} (dato de ejemplo).`:''].filter(Boolean),
    actions:[chatGoAction('apoyo')]};

  if(/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(t)&&t.length<25)
    return {text:`¡Hola, ${S.profile.name}! Soy Arvis. Puedo contarte qué tienes hoy, tus próximas evaluaciones y cómo vas en notas, agregar fechas o bajarte la carga. ¿Qué necesitas?`,suggest:true};

  if(/\b(llevame|abre|abrir|vamos a|ir a)\b/.test(t)){const k=chatHelpKey(t);if(k)return {text:'Vamos a '+(CHAT_TAB_LABEL[k]||k)+'.',navigate:k}}

  if(/\b(agrega|agregar|anota|anotar|anade|registra|registrar|pon|ponme|crea|crear)\b/.test(t)&&
     /\b(certamen|prueba|examen|evaluacion|control|entrega|tarea|informe|trabajo|proyecto|laboratorio|solemne|parcial|fecha)\b/.test(t)){
    const c=chatFindCourse(t),date=chatParseDate(t),type=chatEventType(t),title=chatEventTitle(raw,type);
    if(!S.courses.length)return {text:'Primero necesito al menos un ramo. Puedes importarlos desde tu universidad en Ajustes → Cuenta.',actions:[chatGoAction('cuenta')]};
    if(!c||!date){
      const falta=[!c&&'el ramo',!date&&'la fecha'].filter(Boolean).join(' y ');
      return {text:`Me falta ${falta}. Escríbelo así, por ejemplo: «Agrega certamen 2 de ${S.courses[0].name} el 28/11».`};
    }
    if(date<today())return {text:'Esa fecha ya pasó. ¿Me das una fecha de hoy en adelante?'};
    if((S.events||[]).some(e=>e.courseId===c.id&&e.date===date&&norm(e.title)===norm(title)))
      return {text:`Ya tienes «${title}» de ${c.name} ese día. No la dupliqué.`};
    return {text:`¿Agrego «${title}» de ${c.name} para el ${chatWhen(date)}? Después reorganizo tus micro-tareas para prepararla.`,
      propose:{label:'Sí, agregar',kind:'addEvent',data:{courseId:c.id,title,date,type}}};
  }

  if(/\b(reorganiza|replanifica|reprograma|reordena)\b|modo suave|baja(r)? la carga|estoy (muy )?(cansad|agotad|colapsad)|no alcanzo|me atrase/.test(t)){
    if(typeof softOn==='function'&&softOn(today()))
      return {text:'Ya tienes el modo suave activo hasta el '+dshort(S.soft.until)+'. Puedo reorganizar lo pendiente igual, sin culpa.',
        propose:{label:'Reorganizar pendientes',kind:'replan'}};
    return {estado:'cansado',text:'Te propongo activar el modo suave por 3 días: bajo tu carga un 25% y reacomodo lo pendiente. ¿Lo activo?',
      propose:{label:'Activar modo suave',kind:'soft'}};
  }

  if(/\b(pomodoro|concentrar(me)?|empezar a estudiar|ponerme a estudiar|temporizador)\b/.test(t))
    return {estado:'estudiando',text:'¿Parto un pomodoro de '+pomCfg().focusMin+' minutos? Te llevo a Herramientas.',propose:{label:'Iniciar pomodoro',kind:'pomodoro'}};

  if(/\b(hoy|ahora)\b/.test(t)&&/\b(que|tengo|toca|plan|hago|tareas?|pendiente)\b/.test(t)&&!/como (se )?usa/.test(t)){
    const ts=chatTodayTasks(),cap=capFor(today()),hecho=doneToday();
    const check=typeof ci==='function'?ci(today()):null;
    const privacidad=check?'Tu check-in de hoy ajusta la capacidad.':'No usé datos de bienestar: no hay check-in con consentimiento.';
    if(!ts.length)return {estado:hecho?'celebrando':'normal',text:hecho
      ?`Hoy ya sumaste ${hecho} min y no quedan micro-tareas. Puedes descansar tranquila/o. ${privacidad}`
      :`No tienes micro-tareas para hoy. Si agregas fechas, armo un plan liviano. ${privacidad}`,actions:[chatGoAction('hoy')]};
    return {text:`Para hoy tienes ${ts.length} micro-tarea(s). Capacidad ~${cap} min · ${hecho} min registrados. ${privacidad}`,
      list:ts.slice(0,6).map(x=>`${cname(x.courseId)} · ${x.title||'Estudio'} (${x.minutes} min)`),actions:[chatGoAction('hoy')]};
  }

  if(/\b(proxim|evaluacion|certamen|prueba|control|entrega|examen|fecha)/.test(t)&&/\b(que|cuando|cuales|tengo|vienen|hay|proxim)/.test(t)){
    const evs=chatUpcoming(21),c=chatFindCourse(t),lista=c?evs.filter(e=>e.courseId===c.id):evs;
    if(!lista.length)return {text:c?`No veo evaluaciones de ${c.name} en las próximas 3 semanas.`:'No tienes evaluaciones en las próximas 3 semanas.',actions:[chatGoAction('syllabus')]};
    return {estado:diffDays(today(),lista[0].date)<3?'preocupado':'normal',text:`Esto viene en las próximas 3 semanas${c?' en '+c.name:''}:`,
      list:lista.slice(0,8).map(e=>`${e.title} · ${cname(e.courseId)} · ${chatWhen(e.date)}`),actions:[chatGoAction('semana')]};
  }

  if(/\b(nota|notas|promedio|como voy|apruebo|aprobar|necesito sacar)\b/.test(t)&&!/como (se )?usa/.test(t)){
    const c=chatFindCourse(t),cs=c?[c]:S.courses;
    if(!cs.length)return {text:'Aún no tienes ramos registrados.',actions:[chatGoAction('ramos')]};
    const lines=cs.map(k=>{
      const g=gradeSummary(k.grades,k);
      if(g.avg==null)return `${k.name}: sin notas todavía.`;
      let s=`${k.name}: promedio ${comma(g.shown)} con ${g.wsum}% evaluado.`;
      if(g.need!=null)s+=g.need<=1?' Ya tienes asegurado el '+comma(g.pass)+'.':(g.need>7?' Con lo que queda no alcanza el '+comma(g.pass)+'; conversa con tu docente.':` Necesitas ~${comma(Math.round(g.need*10)/10)} en lo que queda.`);
      return s;
    });
    return {text:c?'Así vas:':'Así vas en tus ramos:',list:lines,actions:[chatGoAction('notas')]};
  }

  if(/\b(receso|feriado|vacaciones|semana de certamenes|calendario academico|cuando termina|fin de semestre)\b/.test(t)&&inst){
    const c=institutionCalendar(inst),t0=today();
    const items=[...c.examWeeks.map(x=>`${x.label}: ${dshort(x.start)} – ${dshort(x.end)}`),...c.breaks.map(x=>`${x.label}: ${dshort(x.start)} – ${dshort(x.end)}`),
      ...c.holidays.filter(h=>h.date>=t0).map(h=>`${h.label}: ${dshort(h.date)}`),`Fin de clases: ${dshort(c.classesEnd)}`];
    return {text:`Calendario de ${inst.short} (datos de ejemplo):`,list:items,actions:[chatGoAction('semana')]};
  }

  if(/\b(psicolog|dise|bienestar estudiantil|hablar con alguien|apoyo|ansiedad|angustia|triste|estres|estresad)/.test(t)&&inst)
    return {estado:'preocupado',text:`Siento que estés pasando por esto. En ${inst.short} puedes contactar a ${inst.support.service} (${inst.support.email} · ${inst.support.phone}, ${inst.support.hours}; dato de ejemplo). También puedes probar una respiración corta.`,
      actions:[chatGoAction('apoyo'),chatGoAction('respiracion')]};

  const k=chatHelpKey(t);
  if(k&&typeof AYUDA!=='undefined'&&AYUDA[k]){
    const h=AYUDA[k];
    return {text:`${h.title}: ${h.desc}`,list:h.steps||[],actions:[chatGoAction(k)]};
  }

  return {text:'Todavía soy un prototipo y no entendí eso. Prueba con alguna de estas ideas:',suggest:true};
}

function chatRunProposal(pid){
  const p=chatProposals[pid];if(!p||p.done)return;
  p.done=true;
  if(p.kind==='addEvent'){
    const d=p.data;
    if(!course(d.courseId)){chatSay({text:'Ese ramo ya no existe, así que no agregué la fecha.'});return}
    undoable('Fecha agregada desde el chat.',()=>{S.events.push({id:uid(),courseId:d.courseId,title:d.title,date:d.date,type:d.type})},replanAll);
    chatSay({estado:'celebrando',text:`Listo: agregué «${d.title}» de ${cname(d.courseId)} y reorganicé tus micro-tareas.`,actions:[chatGoAction('semana')]});
  }else if(p.kind==='soft'){
    applySoft();
    chatSay({estado:'descansando',text:'Modo suave activo por 3 días. Descansar también es avanzar.'});
  }else if(p.kind==='replan'){
    replanAll();render();
    chatSay({text:'Reorganicé lo pendiente para que no se acumule.',actions:[chatGoAction('hoy')]});
  }else if(p.kind==='pomodoro'){
    go('herramientas');
    const pc=pomCfg();if(!pc.running)pomStart();
    chatSay({estado:'estudiando',text:'Pomodoro en marcha. Te acompaño en este foco.'});
  }
}
function chatCancelProposal(pid){
  const p=chatProposals[pid];if(!p||p.done)return;
  p.done=true;chatSay({text:'Ok, no hice ningún cambio.'});
}

function chatPush(m){
  chatMsgs.push({id:uid(),...m});
  if(chatMsgs.length>CHAT_MAX_MSGS)chatMsgs=chatMsgs.slice(-CHAT_MAX_MSGS);
}
function chatSay(r){
  const m={from:'arvis',estado:r.estado||'normal',text:r.text||'',list:r.list||[],actions:r.actions||[],suggest:!!r.suggest};
  if(r.propose){const pid=uid();chatProposals[pid]={...r.propose,done:false};m.proposal=pid}
  chatPush(m);chatRender();
}
async function chatSend(text){
  const msg=String(text||'').trim().slice(0,CHAT_MAX_LEN);
  if(!msg||chatBusy||!chatAvailable())return;
  chatPush({from:'yo',text:msg});chatBusy=true;chatRender();
  let r;
  try{r=await Promise.resolve(chatBrain(msg))}catch(e){r={text:'Algo falló de mi lado. ¿Lo intentas de nuevo?'}}
  await new Promise(res=>setTimeout(res,250));
  chatBusy=false;
  if(!chatAvailable())return;
  chatSay(r);
  if(r.navigate)go(r.navigate);
}
function chatSubmit(ev){
  if(ev)ev.preventDefault();
  const i=document.getElementById('chat-input');if(!i)return false;
  const v=i.value;i.value='';chatSend(v);return false;
}
const CHAT_SUGGESTIONS=['¿Qué tengo hoy?','Próximas evaluaciones','¿Cómo voy en mis notas?','Estoy cansada/o, baja la carga','¿Cómo uso el check-in?'];

function chatToggle(force){
  chatOpen=typeof force==='boolean'?force:!chatOpen;
  if(chatOpen&&!chatMsgs.length){
    const inst=currentInstitution();
    chatSay({text:`¡Hola, ${S.profile.name}! Soy Arvis, tu asistente de ${inst?inst.short:'tu universidad'}. Puedo ayudarte a organizarte y resolver dudas de la app.`,suggest:true});
  }
  chatRender();
  if(chatOpen){const i=document.getElementById('chat-input');if(i)try{i.focus()}catch(e){}}
  else{const f=document.getElementById('chat-fab');if(f)try{f.focus()}catch(e){}}
}
function chatAvatar(estado){
  const on=typeof arvisOn==='function'?arvisOn():true;
  const key=typeof ARVIS_MENSAJES!=='undefined'&&ARVIS_MENSAJES[estado]?estado:'normal';
  return on?`<img class="chat-av" src="icons/arvis/arvis-${key}.svg" alt="">`:'<span class="chat-av chat-av-txt" aria-hidden="true">A</span>';
}
function chatMsgHtml(m){
  if(m.from==='yo')return `<div class="chat-msg yo"><p>${esc(m.text)}</p></div>`;
  const list=m.list&&m.list.length?`<ul>${m.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
  const p=m.proposal&&chatProposals[m.proposal];
  const prop=p&&!p.done?`<div class="chat-actions"><button class="btn" type="button" onclick="chatRunProposal('${esc(m.proposal)}')">${esc(p.label)}</button><button class="btn sec" type="button" onclick="chatCancelProposal('${esc(m.proposal)}')">No, gracias</button></div>`:'';
  const acts=m.actions&&m.actions.length?`<div class="chat-actions">${m.actions.map(a=>`<button class="lnk" type="button" onclick="go('${esc(a.go)}')">${esc(a.label)} →</button>`).join('')}</div>`:'';
  const sug=m.suggest?`<div class="chat-sug">${CHAT_SUGGESTIONS.map(s=>`<button type="button" class="chat-chip" onclick="chatSend(this.textContent)">${esc(s)}</button>`).join('')}</div>`:'';
  return `<div class="chat-msg arvis">${chatAvatar(m.estado)}<div class="chat-bub"><p>${esc(m.text)}</p>${list}${prop}${acts}${sug}</div></div>`;
}
function chatRender(){
  const root=document.getElementById('chat-root');if(!root)return;
  if(!chatAvailable()){root.innerHTML='';chatOpen=false;return}
  const inst=currentInstitution();
  let fab=document.getElementById('chat-fab');
  if(!fab){
    root.innerHTML=`<button id="chat-fab" class="chat-fab" type="button" aria-controls="chat-panel" onclick="chatToggle()">${chatAvatar('normal')}<span class="chat-fab-txt">Pregúntale a Arvis</span></button><div id="chat-panel-wrap"></div>`;
    fab=document.getElementById('chat-fab');
  }
  fab.setAttribute('aria-expanded',chatOpen?'true':'false');
  fab.setAttribute('aria-label',chatOpen?'Cerrar chat con Arvis':'Abrir chat con Arvis');
  fab.classList.toggle('on',chatOpen);
  const wrap=document.getElementById('chat-panel-wrap');
  if(!chatOpen){wrap.innerHTML='';return}
  const prev=document.getElementById('chat-input'),draftTxt=prev?prev.value:'',hadFocus=prev&&document.activeElement===prev;
  wrap.innerHTML=`<section id="chat-panel" class="chat-panel" role="dialog" aria-label="Chat con Arvis">
    <header class="chat-head">${chatAvatar('normal')}<div class="chat-heading"><b>Arvis · Asistente ${esc(inst.short)}</b></div>
      <span class="tag inst-example">Prototipo</span><button class="icon-btn" type="button" aria-label="Cerrar chat" onclick="chatToggle(false)">✕</button></header>
    <p class="chat-note">Demo sin IA real: las respuestas se generan en tu dispositivo y no se envía nada. La conversación se borra al recargar.</p>
    <div class="chat-log" id="chat-log" role="log" aria-live="polite">${chatMsgs.map(chatMsgHtml).join('')}${chatBusy?`<div class="chat-msg arvis">${chatAvatar('normal')}<div class="chat-bub chat-typing" role="status" aria-label="Arvis está escribiendo"><span></span><span></span><span></span><em>escribiendo…</em></div></div>`:''}</div>
    <form class="chat-form" onsubmit="return chatSubmit(event)">
      <label class="sr-only" for="chat-input">Escribe tu mensaje</label>
      <input id="chat-input" type="text" maxlength="${CHAT_MAX_LEN}" autocomplete="off" placeholder="Escríbele a Arvis…">
      <button class="btn" type="submit" ${chatBusy?'disabled':''}>Enviar</button>
    </form>
  </section>`;
  const i=document.getElementById('chat-input');
  if(i){i.value=draftTxt;if(hadFocus||!chatBusy)try{i.focus({preventScroll:true})}catch(e){}}
  const log=document.getElementById('chat-log');if(log)log.scrollTop=log.scrollHeight;
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!chatOpen)return;
  const d=document.getElementById('confirm-dialog');
  if(d&&!d.hidden)return;
  chatToggle(false);
});
function chatSync(){
  const ok=chatAvailable();
  if(!ok&&chatWasAvailable){chatMsgs=[];chatProposals={};chatOpen=false}
  chatWasAvailable=ok;
  document.body.classList.toggle('has-chat',ok);
  const root=document.getElementById('chat-root');
  if(!root)return;
  if(!ok){root.innerHTML='';return}
  if(!document.getElementById('chat-fab'))chatRender();
}
