const POM_PHASES={focus:'Foco',short:'Descanso corto',long:'Descanso largo'};
const LEITNER=[1,2,4,8,16];
let fcPreview=[],fcEditId='',fcSession=null,fcShow=false;
let pomAway=false,pomAwayPrompt=false,pomLimitPrompt=false,pomStartMsg=false,fcStreak=0,fcMomento=null;
const pomCfg=()=>(S.tools&&S.tools.pomodoro)||freshPomodoro();
const fcCfg=()=>(S.tools&&S.tools.flashcards)||freshFlashcards();
const pomDuration=(p,phase=p.phase)=>(phase==='focus'?p.focusMin:phase==='short'?p.shortMin:p.longMin)*60000;
const pomRemaining=(p,now=Date.now())=>p.running&&p.endsAt!=null?Math.max(0,p.endsAt-now):Math.max(0,p.leftMs||0);
const pomClock=ms=>{const s=Math.ceil(ms/1000);return `${pad(Math.floor(s/60))}:${pad(s%60)}`};
const pomCount=p=>p.phase==='long'?p.longEvery:p.phase==='short'?Math.max(1,p.pomodoros):Math.min(p.longEvery,p.pomodoros+1);
function pomLogFocus(p){
  if(!p.target)return;
  let task=null,courseId='';
  if(p.target.indexOf('task:')===0){
    task=S.tasks.find(t=>t.id===p.target.slice(5)&&t.date===today());
    if(!task)return;
    courseId=task.courseId;
  }else if(p.target.indexOf('course:')===0){
    courseId=p.target.slice(7);
    if(!course(courseId))return;
  }
  if(!courseId)return false;
  const session={id:uid(),date:today(),courseId,minutes:p.focusMin};
  if(task)session.taskId=task.id;
  S.sessions.push(session);
  return true;
}
function pomAlert(from,to){
  const p=pomCfg();
  if(p.sound&&typeof beep==='function')beep();
  try{
    if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('U.A.R.V.I.S.',{body:`Terminó ${POM_PHASES[from]}. Ahora: ${POM_PHASES[to]}.`});
  }catch(e){}
}
function pomTrackUntargeted(p){
  const d=today();
  if(p.todayDate!==d){p.todayDate=d;p.todayMinutes=0}
  p.todayMinutes=(p.todayMinutes||0)+p.focusMin;
}
function pomFinishPhase(p,now){
  const from=p.phase;
  if(from==='focus'){
    p.pomodoros++;
    const logged=pomLogFocus(p);
    p.completed=(p.completed||0)+1;
    if(!logged)pomTrackUntargeted(p);
    if(p.pomodoros>=p.longEvery){p.phase='long';p.pomodoros=0}
    else p.phase='short';
  }else{p.phase='focus';pomStartMsg=true}
  p.leftMs=pomDuration(p);
  p.endsAt=now+p.leftMs;
  p.running=true;
  return from;
}
const pomDailyMinutes=()=>{const p=pomCfg();return p.todayDate===today()?(p.todayMinutes||0):0};
const pomAtDailyLimit=()=>doneToday()+pomDailyMinutes()>=capFor(today());
function pomArvisHtml(){
  if(!arvisOn())return '';
  const momento=arvisMomentoHtml('pomodoro');
  if(momento)return momento;
  if(pomAwayPrompt)return arvis('normal','Te esperé. ¿Seguimos?',{action:'<button class="lnk" type="button" onclick="pomEscape(true)">Seguir</button><button class="lnk" type="button" onclick="pomEscape(false)">Terminar por hoy</button>',id:'arvis-pomodoro-vuelta'});
  if(pomLimitPrompt)return arvis('normal','Ya cumpliste por hoy',{action:'<button class="lnk" type="button" onclick="pomStart(true)">Iniciar igual</button>',id:'arvis-pomodoro-limite'});
  const p=pomCfg();
  if(p.phase!=='focus')return arvis('descansando','Pausa. Estírate o toma agua.',{mediano:true,id:'arvis-pomodoro-descanso'});
  if(!p.running)return '';
  const msg=pomStartMsg?'Vamos, yo también me concentro.':null;
  pomStartMsg=false;
  return arvis('estudiando',msg,{mediano:true,id:'arvis-estudiando'});
}
function pomAdvance(now=Date.now(),natural=true,quiet=false){
  const p=pomCfg();let changed=false,last=null,i=0;
  while(p.running&&p.endsAt!=null&&p.endsAt<=now&&i++<60){
    last=natural?pomFinishPhase(p,now):(p.phase==='focus'?p.phase='short':p.phase='focus');
    if(!natural){p.leftMs=pomDuration(p);p.endsAt=p.running?now+p.leftMs:null}
    changed=true;
  }
  if(i>=60&&p.running)p.endsAt=now+pomDuration(p);
  if(changed){
    if(last&&natural)pomAlert(last,p.phase);
    if(last==='focus'&&natural&&typeof metricsTrack==='function')metricsTrack('pomodoro_completado');
    if(last==='focus'&&natural&&!quiet&&typeof arvisCelebrar==='function')arvisCelebrar('¡Ciclo terminado! Buen trabajo.','pomodoro');
    save();
    if(!quiet&&(typeof tab==='undefined'||tab==='herramientas')&&typeof render==='function')render();
  }
  return p;
}
function pomResume(){return pomAdvance(Date.now(),true,true)}
function pomStart(force){
  const p=pomCfg();if(p.running)return;
  if(p.phase==='focus'&&!force&&arvisOn()&&pomAtDailyLimit()){
    pomLimitPrompt=true;pomAwayPrompt=false;render();return;
  }
  pomLimitPrompt=false;pomAwayPrompt=false;
  if(p.phase==='focus')pomStartMsg=true;
  p.endsAt=Date.now()+Math.max(0,p.leftMs||pomDuration(p));p.running=true;save();render();pomodoroTick();
}
function pomEscape(keep){
  pomAwayPrompt=false;pomAway=false;
  if(keep){render();return}
  const p=pomCfg();p.running=false;p.endsAt=null;p.leftMs=pomDuration(p);
  if(arvisOn())arvisCelebrar('Lo que alcanzaste igual cuenta','pomodoro');
  save();render();
}
function pomPause(){
  const p=pomCfg();if(!p.running)return;
  p.leftMs=pomRemaining(p);p.endsAt=null;p.running=false;save();render();
}
function pomReset(){
  const p=pomCfg(),early=p.phase==='focus'&&p.running;
  p.running=false;p.endsAt=null;p.leftMs=pomDuration(p);
  pomLimitPrompt=false;pomAwayPrompt=false;pomStartMsg=false;
  if(early&&arvisOn())arvisCelebrar('Lo que alcanzaste igual cuenta','pomodoro');
  save();render();
}
function pomSkip(){
  const p=pomCfg(),now=Date.now(),leavingFocus=p.phase==='focus';
  p.phase=leavingFocus?'short':'focus';
  p.leftMs=pomDuration(p);p.endsAt=p.running?now+p.leftMs:null;
  pomLimitPrompt=false;pomAwayPrompt=false;pomStartMsg=!leavingFocus;
  if(leavingFocus&&arvisOn())arvisCelebrar('Lo que alcanzaste igual cuenta','pomodoro');
  save();render();
}
function pomSetConfig(key,val){
  const p=pomCfg(),limits={focusMin:[1,180],shortMin:[1,180],longMin:[1,180],longEvery:[2,12]},lim=limits[key];
  if(!lim)return;
  const n=parseInt(val,10);
  if(!Number.isInteger(n)||n<lim[0]||n>lim[1])return toast(`Pon un valor entre ${lim[0]} y ${lim[1]}.`);
  const phaseKey={focus:'focusMin',short:'shortMin',long:'longMin'}[p.phase];
  p[key]=n;
  if(!p.running&&key===phaseKey)p.leftMs=pomDuration(p);
  if(p.pomodoros>=p.longEvery)p.pomodoros=0;
  save();render();
}
function pomSetSound(on){const p=pomCfg();p.sound=!!on;save();render()}
function pomSetTarget(v){
  const p=pomCfg(),s=String(v||'');
  if(s&&!/^(course|task):[\w-]{1,40}$/.test(s))return toast('Selecciona un ramo o una tarea de la lista.');
  p.target=s;save();render();
}
function pomTargetOptions(){
  const p=pomCfg(),values=[];
  let h='<option value="">Sin registrar</option>';
  S.courses.forEach(c=>{values.push('course:'+c.id);h+=`<option value="course:${c.id}" ${p.target==='course:'+c.id?'selected':''}>Ramo: ${esc(c.name)}</option>`});
  S.tasks.filter(t=>t.date===today()&&!t.done).forEach(t=>{values.push('task:'+t.id);h+=`<option value="task:${t.id}" ${p.target==='task:'+t.id?'selected':''}>Tarea: ${esc(t.title)} · ${t.minutes} min</option>`});
  if(p.target&&values.indexOf(p.target)<0)h+=`<option value="${esc(p.target)}" selected>Selección anterior</option>`;
  return h;
}
function pomodoroTick(){
  const p=pomCfg();
  if(p.running&&p.endsAt!=null&&p.endsAt<=Date.now()){pomAdvance();return}
  const t=$('#pom-time'),phase=$('#pom-phase'),bar=$('#pom-progress');
  if(t)t.textContent=pomClock(pomRemaining(p));
  if(phase)phase.textContent=`${POM_PHASES[p.phase]} · ${pomCount(p)} de ${p.longEvery}`;
  if(bar)bar.style.setProperty('--f',`${100-pomRemaining(p)/pomDuration(p)*100}%`);
  if(pomStartMsg&&arvisOn()&&!arvisMomento&&(typeof tab==='undefined'||tab==='herramientas')&&typeof render==='function')render();
}
function pomodoroHtml(){
  const p=pomCfg(),breath=p.phase!=='focus';
  return `${pomArvisHtml()}<div class="card tools-card" id="pomodoro"><h2>Pomodoro</h2>
    <div class="stats"><div class="stat pom-clock"><b id="pom-time">${pomClock(pomRemaining(p))}</b><span class="mute" id="pom-phase">${POM_PHASES[p.phase]} · ${pomCount(p)} de ${p.longEvery}</span>
      <div class="pom-bar" id="pom-progress" style="--f:0%" aria-hidden="true"></div></div></div>
    <div class="pom-actions">
      <button class="btn" data-focus-id="pom-start" onclick="pomStart()" ${p.running?'disabled':''}>Iniciar</button>
      <button class="btn sec" data-focus-id="pom-pause" onclick="pomPause()" ${p.running?'':'disabled'}>Pausar</button>
      <button class="btn sec" data-focus-id="pom-reset" onclick="pomReset()">Reiniciar</button>
      <button class="btn sec" data-focus-id="pom-skip" onclick="pomSkip()">Saltar fase</button></div>
    ${breath?`<div class="pom-breath"><span>Descanso: si quieres, haz la respiración por defecto de Bienestar (exhalación larga 4-6).</span><button class="btn sec" onclick="goBreath('larga')">Respirar</button></div>`:''}
    <details class="pom-settings"><summary><span class="pom-chevron" aria-hidden="true">▸</span>Configuración y registro</summary>
      <div class="pom-config-grid">
        <label class="mute"><span>Foco (min)</span><input id="pom-focus" type="number" min="1" max="180" value="${p.focusMin}" onchange="pomSetConfig('focusMin',this.value)"></label>
        <label class="mute"><span>Descanso corto (min)</span><input id="pom-short" type="number" min="1" max="180" value="${p.shortMin}" onchange="pomSetConfig('shortMin',this.value)"></label>
        <label class="mute"><span>Descanso largo (min)</span><input id="pom-long" type="number" min="1" max="180" value="${p.longMin}" onchange="pomSetConfig('longMin',this.value)"></label>
        <label class="mute"><span>Largo cada (focos)</span><input id="pom-every" type="number" min="2" max="12" value="${p.longEvery}" onchange="pomSetConfig('longEvery',this.value)"></label></div>
      <label class="mute pom-check"><input type="checkbox" ${p.sound?'checked':''} onchange="pomSetSound(this.checked)"> Sonido suave al terminar cada fase</label>
      <label class="mute pom-target">Trabajar en
        <select onchange="pomSetTarget(this.value)">${pomTargetOptions()}</select></label>
      <p class="tools-help">Si eliges una micro-tarea de hoy, al terminar un foco se suman esos minutos como estudio. Las notificaciones solo aparecen si ya diste permiso en el navegador; aquí no se pide.</p>
    </details>
  </div>`;
}
function fcActiveDeck(){const F=fcCfg();return F.decks.find(d=>d.id===F.activeDeckId)||null}
function fcCount(){return fcCfg().decks.reduce((n,d)=>n+(d.cards||[]).length,0)}
function escapeFC(s){return String(s).replace(/\\/g,'\\\\').replace(/\r/g,'').replace(/\n/g,'\\n').replace(/\t/g,'\\t')}
function unescapeFC(s){return String(s).replace(/\\([\\nt])/g,(m,c)=>c==='n'?'\n':c==='t'?'\t':'\\')}
function parseFlashcardLine(line){
  const raw=String(line).replace(/\r$/,'');if(!raw.trim())return null;
  let front,back,i=raw.indexOf('\t');
  if(i>=0){front=raw.slice(0,i);back=raw.slice(i+1)}
  else{const m=raw.match(/^(.*?)\s+;\s+(.*)$/);if(!m)return null;front=m[1];back=m[2]}
  front=unescapeFC(front).trim();back=unescapeFC(back).trim();
  if(!front||!back||front.length>1000||back.length>1000)return null;
  return {front,back};
}
function flashcardsDue(deck,date=today()){
  return (deck&&deck.cards||[]).filter(c=>c.due<=date).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
}
function flashcardAnswer(card,knew,date=today()){
  const box=knew?Math.min(5,(card.box||1)+1):1;
  return {box,due:addDays(date,LEITNER[box-1])};
}
function createFlashcardDeck(){
  const name=String(($('#fd-name')||{}).value||'').trim(),courseId=($('#fd-course')||{}).value||'';
  if(!name)return toast('Escribe un nombre para el mazo.');
  if(courseId&&!course(courseId))return toast('Ese ramo ya no existe.');
  const F=fcCfg(),deck={id:uid(),name:name.slice(0,80),courseId:courseId,cards:[]};
  F.decks.push(deck);F.activeDeckId=deck.id;save();render();
}
function setActiveFlashcardDeck(id){const F=fcCfg();if(!F.decks.some(d=>d.id===id))return;F.activeDeckId=id;fcSession=null;fcEditId='';fcPreview=[];save();render()}
function renameFlashcardDeck(id,v){
  const d=fcCfg().decks.find(x=>x.id===id);if(!d)return;
  const name=String(v||'').trim();if(!name)return toast('El mazo necesita un nombre.');
  d.name=name.slice(0,80);save();render();
}
function setFlashcardDeckCourse(id,v){
  const d=fcCfg().decks.find(x=>x.id===id);if(!d)return;
  d.courseId=v&&course(v)?v:'';save();render();
}
async function delFlashcardDeck(id){
  const F=fcCfg(),d=F.decks.find(x=>x.id===id);if(!d)return;
  if(!await askConfirm({title:'Borrar mazo',text:`¿Borrar "${d.name}" y sus ${(d.cards||[]).length} tarjeta(s)?`,okLabel:'Borrar',danger:true}))return;
  undoable('Mazo eliminado.',()=>{
    F.decks=F.decks.filter(x=>x.id!==id);
    if(F.activeDeckId===id)F.activeDeckId=F.decks[0]?F.decks[0].id:'';
    if(fcSession&&fcSession.deckId===id)fcSession=null;
    if(fcEditId)fcEditId='';
    fcPreview=[];
  });
}
function setFlashcardLimit(v){
  const n=parseInt(v,10);if(!Number.isInteger(n)||n<1||n>200)return toast('El tope debe estar entre 1 y 200.');
  fcCfg().limit=n;save();render();
}
function addFlashcard(){
  const d=fcActiveDeck();if(!d)return toast('Crea o abre un mazo primero.');
  const front=String(($('#fc-front')||{}).value||''),back=String(($('#fc-back')||{}).value||'');
  if(!front.trim()||!back.trim())return toast('Escribe el frente y el reverso.');
  if(front.length>1000||back.length>1000)return toast('Cada lado puede tener hasta 1000 caracteres.');
  if(fcCount()>=5000)return toast('Ya alcanzaste el límite de 5000 tarjetas.');
  d.cards.push({id:uid(),front,back,box:1,due:today()});save();render();
}
function editFlashcard(id){fcEditId=id;render()}
function cancelFlashcardEdit(){fcEditId='';render()}
function updateFlashcard(id){
  const d=fcActiveDeck(),c=d&&d.cards.find(x=>x.id===id);if(!c)return;
  const front=String(($('#fce-front')||{}).value||''),back=String(($('#fce-back')||{}).value||'');
  if(!front.trim()||!back.trim())return toast('Escribe el frente y el reverso.');
  if(front.length>1000||back.length>1000)return toast('Cada lado puede tener hasta 1000 caracteres.');
  c.front=front;c.back=back;fcEditId='';save();render();
}
function delFlashcard(id){
  const d=fcActiveDeck();if(!d)return;
  undoable('Tarjeta eliminada.',()=>{d.cards=d.cards.filter(c=>c.id!==id);if(fcEditId===id)fcEditId=''});
}
function previewFlashcardsImport(){
  const text=String(($('#fc-import')||{}).value||''),room=Math.max(0,5000-fcCount());
  let skipped=0;fcPreview=[];
  text.split(/\r?\n/).forEach(line=>{
    const c=parseFlashcardLine(line);
    if(!c){if(line.trim())skipped++;return}
    if(fcPreview.length<room)fcPreview.push(c);
  });
  toast(`${fcPreview.length} tarjeta(s) listas para revisar${skipped?`; ${skipped} línea(s) no se pudieron leer`:''}.`);render();
}
function cancelFlashcardsImport(){fcPreview=[];render()}
function confirmFlashcardsImport(){
  const d=fcActiveDeck();if(!d)return toast('Crea o abre un mazo antes de importar.');
  if(!fcPreview.length)return toast('No hay tarjetas en la vista previa.');
  const room=Math.max(0,5000-fcCount()),cards=fcPreview.slice(0,room).map(c=>({id:uid(),front:c.front,back:c.back,box:1,due:today()}));
  if(!cards.length)return toast('Ya alcanzaste el límite de 5000 tarjetas.');
  cards.forEach(c=>d.cards.push(c));fcPreview=[];save();render();
  toast(`${cards.length} tarjeta(s) agregadas al mazo.`);
}
function exportFlashcardDeck(id){
  const d=fcCfg().decks.find(x=>x.id===id);if(!d)return;
  if(!d.cards.length)return toast('Ese mazo aún no tiene tarjetas.');
  const text=d.cards.map(c=>`${escapeFC(c.front)}\t${escapeFC(c.back)}`).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  a.download='mazo-'+(d.name||'flashcards').replace(/[^\w-]+/g,'-').slice(0,60)+'.txt';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function fcArvisHtml(){
  if(!arvisOn())return '';
  const momento=arvisMomentoHtml('flashcards');
  if(momento)return momento;
  if(fcMomento){
    if(Date.now()-fcMomento.ts<3500)return arvis(fcMomento.estado,fcMomento.mensaje,{id:'arvis-flashcard'});
    fcMomento=null;
  }
  if(!fcSession)return '';
  if(!fcSession.queue.length)return arvis('normal',`Acertaste ${fcSession.correct||0} de ${fcSession.total||fcSession.reviewed||0}.`,{id:'arvis-flashcard'});
  const d=fcCfg().decks.find(x=>x.id===fcSession.deckId),c=d&&d.cards.find(x=>x.id===fcSession.queue[0]);
  return c?arvis('normal',c.front,{id:'arvis-flashcard'}):'';
}
function startFlashcards(){
  const d=fcActiveDeck();if(!d)return toast('Crea o abre un mazo primero.');
  const due=flashcardsDue(d,today()).slice(0,fcCfg().limit);
  if(!due.length)return toast('Por hoy no hay tarjetas que tocar en este mazo.');
  fcSession={deckId:d.id,queue:due.map(c=>c.id),reviewed:0,tomorrow:0,correct:0,total:due.length};
  fcShow=false;fcEditId='';fcStreak=0;fcMomento=null;render();
}
function showFlashcardAnswer(){fcShow=true;render()}
function flashcardAnswerNow(knew){
  const d=fcCfg().decks.find(x=>x.id===fcSession.deckId),id=fcSession.queue[0],c=d&&d.cards.find(x=>x.id===id);
  if(!c){fcSession=null;render();return}
  const next=flashcardAnswer(c,!!knew,today());
  c.box=next.box;c.due=next.due;
  fcSession.reviewed++;if(next.due===addDays(today(),1))fcSession.tomorrow++;
  fcSession.queue.shift();fcShow=false;
  if(knew){
    fcStreak++;fcSession.correct=(fcSession.correct||0)+1;
    S.tools.flashcards.correct=(S.tools.flashcards.correct||0)+1;fcMomento=null;
    if(fcStreak===3)arvisCelebrar('Tres seguidas. ¡Vas muy bien!','flashcards');
    else if(fcStreak===5)arvisCelebrar('Cinco seguidas. ¡Excelente!','flashcards');
  }else{
    fcStreak=0;
    fcMomento={estado:'normal',mensaje:'Esa cuesta. La volvemos a ver al final.',ts:Date.now()};
  }
  if(!fcSession.queue.length&&fcSession.reviewed>0&&typeof metricsTrack==='function')metricsTrack('flashcards_repasadas');
  save();render();
}
function finishFlashcards(){
  if(fcSession&&fcSession.reviewed>0&&fcSession.queue.length&&typeof metricsTrack==='function')metricsTrack('flashcards_repasadas');
  fcSession=null;fcShow=false;fcStreak=0;fcMomento=null;render();
}
function fcStudyHtml(){
  const F=fcCfg();
  if(fcSession&&!fcSession.queue.length)return `<div class="card"><h3>Resumen del repaso</h3>
    <div class="banner info">Repasaste <b>${fcSession.reviewed}</b> tarjeta(s). Vuelven mañana <b>${fcSession.tomorrow}</b>.</div>
    <button class="btn sec" data-focus-id="fc-finish" onclick="finishFlashcards()">Cerrar resumen</button></div>`;
  if(!fcSession)return `<div class="fc-study-row"><button class="btn" data-focus-id="fc-study" onclick="startFlashcards()">Estudiar lo que toca hoy</button>
    <span class="mute">Tope: ${F.limit} tarjeta(s) por sesión.</span></div>`;
  const d=F.decks.find(x=>x.id===fcSession.deckId),c=d&&d.cards.find(x=>x.id===fcSession.queue[0]);
  if(!c){fcSession=null;return ''}
  return `<div class="card"><h3>Estudiando · ${esc(d.name)}</h3>
    <p class="mute" style="margin-top:0">Quedan ${fcSession.queue.length} tarjeta(s) en esta sesión.</p>
    <div class="pcard"><div class="tools-pre" style="font-size:18px">${esc(c.front)}</div>
      ${fcShow?`<hr><div class="tools-pre">${esc(c.back)}</div>
        <div class="row" style="margin-top:10px"><button class="btn" data-focus-id="fc-knew" onclick="flashcardAnswerNow(true)">La sabía</button>
        <button class="btn sec" data-focus-id="fc-unknown" onclick="flashcardAnswerNow(false)">No la sabía</button></div>`
      :'<button class="btn sec" data-focus-id="fc-show" onclick="showFlashcardAnswer()">Mostrar respuesta</button>'}
    </div></div>`;
}
function flashcardsHtml(){
  const F=fcCfg(),decks=F.decks,active=fcActiveDeck(),courseOpts=sel=>`<option value="">Sin ramo</option>`+S.courses.map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  const deckRows=decks.map(d=>`<div class="task fc-list-row">
      <span class="dot fc-dot" style="background:${ccolor(d.courseId)}"></span>
      <span class="fc-grow"><input class="fc-name-input" aria-label="Nombre del mazo" value="${esc(d.name)}" maxlength="80" onchange="renameFlashcardDeck('${d.id}',this.value)">
        <span class="mute">${(d.cards||[]).length} tarjeta(s) · ${d.courseId?esc(cname(d.courseId)):'sin ramo'}</span></span>
      <select aria-label="Ramo del mazo" onchange="setFlashcardDeckCourse('${d.id}',this.value)">${courseOpts(d.courseId)}</select>
      <button class="btn sec" onclick="setActiveFlashcardDeck('${d.id}')">${d.id===F.activeDeckId?'Activo':'Abrir'}</button>
      <button class="btn sec" onclick="exportFlashcardDeck('${d.id}')">Exportar</button>
      <button class="btn del" onclick="delFlashcardDeck('${d.id}')">Borrar</button></div>`).join('');
  const cards=active?(active.cards||[]):[];
  const cardRows=cards.map(c=>`<div class="task fc-list-row">
      ${fcEditId===c.id?`<div class="fc-grow"><textarea id="fce-front" class="fc-textarea" maxlength="1000" aria-label="Frente de la tarjeta">${esc(c.front)}</textarea>
        <textarea id="fce-back" class="fc-textarea" maxlength="1000" aria-label="Reverso de la tarjeta">${esc(c.back)}</textarea>
        <div class="fc-actions"><button class="btn sec" onclick="updateFlashcard('${c.id}')">Guardar</button>
        <button class="btn sec" onclick="cancelFlashcardEdit()">Cancelar</button></div></div>`
      :`<span class="fc-grow"><b>Frente</b><div class="tools-pre">${esc(c.front)}</div>
        <b>Reverso</b><div class="tools-pre mute">${esc(c.back)}</div>
        <span class="tag">Caja ${c.box} · vuelve ${dshort(c.due)}</span></span>
        <button class="btn sec" onclick="editFlashcard('${c.id}')">Editar</button>
        <button class="btn del" onclick="delFlashcard('${c.id}')">Quitar</button>`}</div>`).join('');
  const preview=fcPreview.map((c,i)=>`<div class="task fc-list-row"><span class="fc-grow">
      <b>${i+1}. ${esc(c.front.replace(/\n/g,' / '))}</b><div class="tools-pre mute">${esc(c.back)}</div></span></div>`).join('');
  return `${fcArvisHtml()}<div class="card tools-card" id="flashcards"><h2>Flashcards</h2>
    <p class="tools-help">Mazos por ramo (o sin ramo), con repaso espaciado en 5 cajas: 1, 2, 4, 8 y 16 días.</p>
    <div class="fc-new-row"><input id="fd-name" maxlength="80" placeholder="Nombre del mazo"><select id="fd-course">${courseOpts('')}</select>
      <button class="btn sec" data-focus-id="fc-add-deck" onclick="createFlashcardDeck()">Crear mazo</button></div>
    ${decks.length?`<div class="fc-list">${deckRows}</div>`:'<div class="fc-empty">Aún no hay mazos.</div>'}
    ${active?`<details class="fc-details"><summary>Tarjetas de ${esc(active.name)}</summary>
      <div class="fc-card-form"><textarea id="fc-front" class="fc-textarea" maxlength="1000" placeholder="Frente"></textarea>
        <textarea id="fc-back" class="fc-textarea" maxlength="1000" placeholder="Reverso"></textarea></div>
      <div class="fc-actions"><button class="btn sec" data-focus-id="fc-add-card" onclick="addFlashcard()">Agregar tarjeta</button>
        <span class="mute">Los saltos de línea se conservan. Hasta 1000 caracteres por lado y 5000 tarjetas en total.</span></div>
      ${cards.length?`<div class="fc-list">${cardRows}</div>`:'<div class="fc-empty">Este mazo aún no tiene tarjetas.</div>'}
      <details><summary>Importar texto (tabulación o " ; ")</summary>
        <textarea id="fc-import" class="fc-textarea fc-import-textarea" placeholder="frente&#9;reverso&#10;otra pregunta ; otra respuesta"></textarea>
        <div class="fc-actions"><button class="btn sec" data-focus-id="fc-preview" onclick="previewFlashcardsImport()">Ver vista previa</button></div>
        ${fcPreview.length?`<div class="fc-list"><b>Vista previa · ${fcPreview.length} tarjeta(s)</b>${preview}
          <div class="fc-actions"><button class="btn" data-focus-id="fc-import-confirm" onclick="confirmFlashcardsImport()">Confirmar importación</button>
          <button class="btn sec" onclick="cancelFlashcardsImport()">Cancelar</button></div></div>`:''}
      </details></details>`:''}
    <div class="fc-review"><h3 class="fc-review-title">Repaso</h3>
      <div class="fc-limit-row"><label class="mute" for="fc-limit">Tope diario</label>
        <input id="fc-limit" class="fc-limit-input" type="number" min="1" max="200" value="${F.limit}" onchange="setFlashcardLimit(this.value)"></div>
      ${fcStudyHtml()}
    </div>
  </div>`;
}
function viewTools(){
  return `${screenHelp('herramientas')}<div class="card"><h2>Herramientas</h2>
    <p class="mute" style="margin-top:0">Un temporizador que no se desfasa y tarjetas con repaso espaciado. Todo se guarda solo en este navegador y funciona sin conexión.</p></div>
    <div class="grid2 tools-grid"><div class="tools-column">${pomodoroHtml()}</div><div class="tools-column">${flashcardsHtml()}</div></div>`;
}
setInterval(pomodoroTick,1000);
document.addEventListener('visibilitychange',()=>{
  const p=pomCfg();
  if(document.hidden){if(p.running&&p.phase==='focus')pomAway=true;return}
  if(!pomAway)return;
  pomAway=false;
  if(!arvisOn())return;
  pomAdvance();
  const q=pomCfg();
  if(q.running&&q.phase==='focus'){pomAwayPrompt=true;render()}
});
