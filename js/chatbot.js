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
function chatBrain(mensaje,historial){
  return typeof ArvisIA!=='undefined'?ArvisIA.chat(mensaje,historial):Promise.resolve(null);
}
function chatRunProposal(pid){
  const p=chatProposals[pid];if(!p||p.done)return;
  p.done=true;
  const d=p.data||{};
  if(p.kind==='addEvent'){
    if(!course(d.courseId)){chatSay({texto:'Ese ramo ya no existe, así que no agregué la fecha.'});return}
    undoable('Fecha agregada desde el chat.',()=>{S.events.push({id:uid(),courseId:d.courseId,title:d.title,date:d.date,type:d.type})},replanAll);
    chatSay({estado:'celebrando',texto:`Listo: agregué «${d.title}» de ${cname(d.courseId)} y reorganicé tus sesiones.`,acciones:[{label:'Ir a Semana',go:'semana'}]});
  }else if(p.kind==='moveEvent'){
    const e=S.events.find(x=>x.id===d.eventId);
    if(!e){chatSay({texto:'Esa fecha ya no está, así que no la moví.'});return}
    undoable('Fecha movida desde el chat.',()=>{e.date=d.date},replanAll);
    chatSay({estado:'celebrando',texto:`Listo: «${e.title}» de ${cname(e.courseId)} queda para el ${dshort(d.date)}.`,acciones:[{label:'Ir a Semana',go:'semana'}]});
  }else if(p.kind==='delEvent'){
    const e=S.events.find(x=>x.id===d.eventId);
    if(!e){chatSay({texto:'Esa fecha ya no está, así que no eliminé nada.'});return}
    undoable('Fecha eliminada desde el chat.',()=>{S.events=S.events.filter(x=>x.id!==d.eventId);S.tasks=S.tasks.filter(x=>x.eventId!==d.eventId||x.done)},replanAll);
    chatSay({texto:`Quitaré «${e.title}» del plan. Si te arrepientes, puedes deshacerlo.`,acciones:[{label:'Ir a Semana',go:'semana'}]});
  }else if(p.kind==='doneTask'){
    const t=S.tasks.find(x=>x.id===d.taskId);
    if(!t||t.done){chatSay({texto:'Esa sesión ya estaba marcada.'});return}
    if(doneToday()>=capFor(today())){chatSay({texto:'Hoy ya completaste tu capacidad; no agregué más minutos.'});return}
    undoable('Micro-tarea marcada desde el chat.',()=>{
      t.done=true;t.date=today();
      S.sessions.push({id:uid(),date:today(),courseId:t.courseId,minutes:t.minutes,taskId:t.id});
    },()=>{if(doneToday()>=capFor(today()))replanAll()});
    chatSay({estado:'celebrando',texto:`Listo: marqué «${t.title||'Estudio'}» de ${cname(t.courseId)}.`,acciones:[{label:'Ir a Hoy',go:'hoy'}]});
  }else if(p.kind==='registrarNota'){
    const c=course(d.courseId);
    if(!c){chatSay({texto:'Ese ramo ya no existe, así que no registré la nota.'});return}
    undoable('Nota registrada desde el chat.',()=>{
      c.grades=Array.isArray(c.grades)?c.grades:[];
      const g=d.gradeId?c.grades.find(x=>x.id===d.gradeId):null;
      if(g)g.score=d.score;
      else c.grades.push({id:uid(),name:d.name,score:d.score,weight:d.weight});
    });
    chatSay({estado:'celebrando',texto:`Anoté ${comma(d.score)} en «${d.name}» de ${c.name} (${d.weight}%).`,acciones:[{label:'Ir a Notas',go:'notas'}]});
  }else if(p.kind==='addStudy'){
    const c=course(d.courseId);
    if(!c){chatSay({texto:'Ese ramo ya no existe, así que no agendé el bloque.'});return}
    undoable('Bloque de estudio agendado desde el chat.',()=>{
      S.sessions.push({id:uid(),date:d.date,courseId:d.courseId,minutes:d.minutes});
    },replanAll);
    chatSay({estado:'estudiando',texto:`Listo: aparté ${d.minutes} min de ${c.name} para el ${dshort(d.date)}.`,acciones:[{label:'Ir a Semana',go:'semana'}]});
  }else if(p.kind==='soft'){
    undoable('Modo suave activado desde el chat.',()=>{},applySoft);
    chatSay({estado:'descansando',texto:'Modo suave activo por 3 días. Descansar también es avanzar.'});
  }else if(p.kind==='replan'){
    undoable('Plan reorganizado desde el chat.',()=>{},replanAll);
    chatSay({texto:'Reorganicé lo pendiente para que no se acumule.',acciones:[{label:'Ir a Hoy',go:'hoy'}]});
  }else if(p.kind==='pomodoro'){
    go('herramientas');
    const pc=pomCfg();if(!pc.running)pomStart();
    chatSay({estado:'estudiando',texto:'Pomodoro en marcha. Te acompaño en este foco.'});
  }
}
function chatCancelProposal(pid){
  const p=chatProposals[pid];if(!p||p.done)return;
  p.done=true;chatSay({texto:'Ok, no hice ningún cambio.'});
  if(typeof ArvisIA!=='undefined'&&ArvisIA.reset)ArvisIA.reset();
}
function chatAnswer(tipo,valor){
  const etiqueta={ramo:'Ramo',fecha:'Fecha',ponderacion:'Ponderación',evento:'Evento',tarea:'Tarea'}[tipo]||'Dato';
  chatSend(`${etiqueta}: ${valor}`);
}
function chatWeeklyFull(){
  go('semana');
  setTimeout(()=>{const el=document.getElementById('weekly-card');if(el&&el.scrollIntoView)try{el.scrollIntoView({block:'nearest'})}catch(e){}},60);
}
async function chatAskWeek(){
  chatToggle(true);
  if(typeof ArvisIA==='undefined')return;
  const r=await ArvisIA.weeklySummary();
  if(!r||!chatAvailable())return;
  chatSay({texto:`${r.titulo}. ${r.parrafos[0]} ${r.parrafos[1]}`,lista:r.prioridades.slice(0,3),estado:r.estado,
    acciones:[{label:'Ver resumen completo',fn:'chatWeeklyFull'}],resumen:true});
}
function chatPush(m){
  chatMsgs.push({id:uid(),...m});
  if(chatMsgs.length>CHAT_MAX_MSGS)chatMsgs=chatMsgs.slice(-CHAT_MAX_MSGS);
}
function chatSay(r){
  const m={from:'arvis',estado:r.estado||'normal',text:r.texto||r.text||'',list:r.lista||r.list||[],
    actions:r.acciones||r.actions||[],suggest:!!(r.sugerir||r.suggest),pregunta:r.pregunta||null,resumen:!!r.resumen};
  if(r.propuesta||r.propose){const pid=uid();chatProposals[pid]={...(r.propuesta||r.propose),done:false};m.proposal=pid}
  chatPush(m);chatRender();
}
async function chatSend(text){
  const msg=String(text||'').trim().slice(0,CHAT_MAX_LEN);
  if(!msg||chatBusy||!chatAvailable())return;
  chatPush({from:'yo',text:msg});chatBusy=true;chatRender();
  let r=null;
  try{r=await chatBrain(msg,chatMsgs)}catch(e){r={texto:'Algo falló de mi lado. ¿Lo intentas de nuevo?'}}
  chatBusy=false;
  if(!r||!chatAvailable())return;
  chatSay(r);
  if(r.navegar)go(r.navegar);
}
function chatSubmit(ev){
  if(ev)ev.preventDefault();
  const i=document.getElementById('chat-input');if(!i)return false;
  const v=i.value;i.value='';chatSend(v);return false;
}
const CHAT_SUGGESTIONS=['¿Qué tengo hoy?','Próximas evaluaciones','¿Cómo voy en mis notas?','¿Qué hago ahora?','¿Cómo uso el check-in?'];

function chatToggle(force){
  chatOpen=typeof force==='boolean'?force:!chatOpen;
  document.body.classList.toggle('chat-open',chatOpen);
  if(chatOpen&&!chatMsgs.length){
    const inst=currentInstitution();
    chatSay({texto:`¡Hola, ${displayName()}! Soy Arvis, tu asistente de ${inst?inst.short:'tu universidad'}. Puedo ayudarte a organizarte y resolver dudas de la app.`,sugerir:true});
  }
  chatRender();
  if(chatOpen){const i=document.getElementById('chat-input');if(i)try{i.focus()}catch(e){}}
  else{const f=document.getElementById('chat-fab');if(f){void document.body.offsetWidth;try{f.focus()}catch(e){}}}
}
function chatAvatar(estado){
  const on=typeof arvisOn==='function'?arvisOn():true;
  const key=typeof ARVIS_MENSAJES!=='undefined'&&ARVIS_MENSAJES[estado]?estado:'normal';
  return on?arvisFigura(key,44,'chat-av'):'<span class="chat-av chat-av-txt" aria-hidden="true">A</span>';
}
function chatMsgHtml(m){
  if(m.from==='yo')return `<div class="chat-msg yo"><p>${esc(m.text)}</p></div>`;
  const list=m.list&&m.list.length?`<ul>${m.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
  const p=m.proposal&&chatProposals[m.proposal];
  const prop=p&&!p.done?`<div class="chat-actions"><button class="btn" type="button" onclick="chatRunProposal('${esc(m.proposal)}')">${esc(p.label)}</button><button class="btn sec" type="button" onclick="chatCancelProposal('${esc(m.proposal)}')">No, gracias</button></div>`:'';
  const acts=m.actions&&m.actions.length?`<div class="chat-actions">${m.actions.map(a=>a.fn?
    `<button class="lnk" type="button" onclick="${esc(a.fn)}()">${esc(a.label)} →</button>`:
    `<button class="lnk" type="button" onclick="go('${esc(a.go)}')">${esc(a.label)} →</button>`).join('')}</div>`:'';
  const q=m.pregunta&&m.pregunta.opciones&&m.pregunta.opciones.length?`<div class="chat-sug" role="group" aria-label="${esc(m.pregunta.texto)}">${m.pregunta.opciones.map(o=>
    `<button type="button" class="chat-chip" onclick="chatAnswer(${esc(JSON.stringify(m.pregunta.tipo))},${esc(JSON.stringify(o.value))})">${esc(o.label)}</button>`).join('')}</div>`:'';
  const sug=m.suggest?`<div class="chat-sug">${CHAT_SUGGESTIONS.map(s=>`<button type="button" class="chat-chip" onclick="chatSend(this.textContent)">${esc(s)}</button>`).join('')}</div>`:'';
  return `<div class="chat-msg arvis">${chatAvatar(m.estado)}<div class="chat-bub"><p>${esc(m.text)}</p>${list}${q}${prop}${acts}${sug}</div></div>`;
}
function chatRender(){
  const root=document.getElementById('chat-root');if(!root)return;
  if(!chatAvailable()){root.innerHTML='';chatOpen=false;document.body.classList.remove('chat-open');return}
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
      <span class="tag inst-example">Prototipo</span><span class="tag inst-example ai-demo-tag" title="Respuestas generadas en tu dispositivo, sin IA real" aria-label="Respuestas generadas en tu dispositivo, sin IA real">IA · demo</span><button class="icon-btn" type="button" aria-label="Cerrar chat" onclick="chatToggle(false)">✕</button></header>
    <p class="chat-note">Demo sin IA real: las respuestas se generan en tu dispositivo y no se envía nada. La conversación se borra al recargar.</p>
    <div class="chat-log" id="chat-log" role="log" aria-live="polite">${chatMsgs.map(chatMsgHtml).join('')}${chatBusy?`<div class="chat-msg arvis">${chatAvatar('normal')}<div class="chat-bub chat-typing" role="status" aria-label="Arvis está pensando"><span></span><span></span><span></span><em>Arvis está pensando…</em></div></div>`:''}</div>
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
  if(!ok&&chatWasAvailable){chatMsgs=[];chatProposals={};chatOpen=false;if(typeof ArvisIA!=='undefined'&&ArvisIA.reset)ArvisIA.reset()}
  chatWasAvailable=ok;
  document.body.classList.toggle('has-chat',ok);
  if(!ok)document.body.classList.remove('chat-open');
  const root=document.getElementById('chat-root');
  if(!root)return;
  if(!ok){root.innerHTML='';return}
  if(!document.getElementById('chat-fab'))chatRender();
}
