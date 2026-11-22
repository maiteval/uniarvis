// Experiencia de sesiones: próxima sesión, pomodoro → "¿Cómo te fue?", mover sesiones fijas, exportar sesiones y accesibilidad.
const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2];
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1100,height:900},acceptDownloads:true});
  await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await ctx.route('**/*',r=>{
    let u;try{u=new URL(r.request().url())}catch(e){return r.continue()}
    if(/^https?:$/.test(u.protocol)&&u.origin!==local){external.push(u.href);return r.abort()}
    return r.continue();
  });
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  await p.goto(base);
  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Ana',career:'Ingeniería',university:''};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.classes=[{id:'k1',courseId:'c1',day:(new Date().getDay()+6)%7,start:'08:00',end:'10:00'}];
    S.events=[{id:'e1',courseId:'c1',title:'Certamen 1',date:addDays(today(),8),type:'evaluacion'}];
    replanAll();
    if(!S.tasks.some(t=>t.date===today()&&!t.done)){const t=S.tasks.find(x=>!x.done);t.date=today();delete t.slotStart;delete t.slotEnd}
    save();go('hoy');
  });

  // ---- Próxima sesión ----
  const hero=await p.locator('.hero-session').count()?await p.locator('.hero-session').innerText():'';
  ok('Hoy muestra "Tu próxima sesión" arriba',/tu próxima sesión/i.test(hero)&&await p.locator('[data-focus-id="hero-start"]').count()===1,hero.slice(0,80));
  ok('la próxima sesión va antes que el plan',await p.evaluate(()=>{const h=document.querySelector('.hero-session'),pl=document.getElementById('plan-hoy-title');return !!h&&!!pl&&(h.compareDocumentPosition(pl)&Node.DOCUMENT_POSITION_FOLLOWING)>0}));
  ok('sin "Cada caja = 25 min": barra de progreso accesible',!(await p.locator('#app').innerText()).includes('Cada caja = 25 min')&&
    await p.locator('.day-bar[role="progressbar"][aria-valuetext]').count()>=1);
  ok('mínimo viable y estudio libre en "Más opciones"',await p.locator('#hoy-mas #smin').count()===1&&await p.locator('#hoy-mas #fm').count()===1&&
    !(await p.locator('#hoy-mas').evaluate(e=>e.open)));
  ok('los campos de "Más opciones" tienen etiqueta',await p.evaluate(()=>['fc','fm','smin'].every(id=>!!document.querySelector(`label[for="${id}"]`))));

  // ---- Pomodoro → sesión terminada → ¿Cómo te fue? ----
  const tid=await p.evaluate(()=>S.tasks.filter(t=>t.date===today()&&!t.done).sort((a,b)=>String(a.slotStart||'99').localeCompare(String(b.slotStart||'99')))[0].id);
  await p.locator('[data-focus-id="hero-start"]').click();
  await p.waitForTimeout(150);
  ok('Empezar abre el pomodoro ligado a la sesión',await p.evaluate(id=>pomCfg().target==='task:'+id&&pomCfg().running,tid));
  ok('el pomodoro a pantalla completa muestra la sesión',await p.locator('.focus-session').count()===1&&/sesión en curso/i.test(await p.locator('.focus-session').innerText()),await p.evaluate(()=>(document.getElementById('focus-root')||{}).innerText||'sin overlay').then(x=>String(x).slice(0,200)));
  const fin=await p.evaluate(id=>{
    const t=S.tasks.find(x=>x.id===id),pc=pomCfg();
    pc.focusMin=t.minutes;pc.endsAt=Date.now()-10;pomAdvance();
    return {done:t.done,real:t.realMinutes,ses:S.sessions.filter(s=>s.taskId===id).reduce((a,s)=>a+s.minutes,0),min:t.minutes};
  },tid);
  ok('al terminar el foco la sesión queda hecha con minutos reales',fin.done&&fin.real===fin.min,JSON.stringify(fin));
  ok('no se cuentan minutos dos veces',fin.ses===fin.min,JSON.stringify(fin));
  ok('el pomodoro pregunta "¿Cómo te fue?"',await p.locator('#focus-feedback').count()===1);
  await p.locator('[data-focus-id="ffeel-'+tid+'-costo"]').click();
  ok('la respuesta se guarda desde el pomodoro',await p.evaluate(id=>S.tasks.find(t=>t.id===id).feeling==='costo',tid)&&
    (await p.locator('[data-focus-id="ffeel-'+tid+'-costo"]').getAttribute('aria-pressed'))==='true');
  await p.evaluate(()=>{focusClose();pomEscape&&pomEscape(false);go('hoy')});
  ok('Hoy también ofrece "¿Cómo te fue?" tras terminar',await p.locator('#hero-feedback').count()===1);
  await p.evaluate(()=>closeSessionFeedback());

  // "Terminé la sesión" antes de completar el tiempo
  const t2=await p.evaluate(()=>{const t=S.tasks.find(x=>!x.done&&x.id);t.date=today();save();startTaskPomodoro(t.id);return t.id});
  await p.evaluate(id=>{focusClose();go('herramientas')},t2);
  ok('Herramientas muestra la sesión en curso',await p.locator('#pom-session').count()===1);
  await p.locator('[data-focus-id="pom-finish-session"]').click();
  ok('"Terminé la sesión" la marca hecha y pregunta',await p.evaluate(id=>S.tasks.find(t=>t.id===id).done,t2)&&await p.locator('#pom-session-feedback').count()===1);
  await p.evaluate(()=>{closeSessionFeedback();const pc=pomCfg();pc.running=false;pc.target='';save();go('hoy')});

  // ---- Mover sesiones (quedan fijas) ----
  const mv=await p.evaluate(()=>{const t=S.tasks.filter(x=>!x.done&&x.date>today()).sort((a,b)=>a.date.localeCompare(b.date))[0];return {id:t.id,min:t.minutes,ev:t.eventId}});
  const destino=await p.evaluate(()=>addDays(today(),3));
  await p.evaluate(d=>{weekStart=mondayOf(d);go('semana');render()},await p.evaluate(id=>S.tasks.find(t=>t.id===id).date,mv.id));
  await p.locator(`[data-focus-id="cal-${mv.id}"]`).click();
  ok('tocar una sesión en Semana abre "Mover"',await p.locator('#move-panel').count()===1);
  await p.locator(`#mv-date-${mv.id}`).fill(destino);
  await p.locator(`#mv-time-${mv.id}`).fill('18:30');
  await p.locator(`[data-focus-id="mv-save-${mv.id}"]`).click();
  const moved=await p.evaluate(id=>{const t=S.tasks.find(x=>x.id===id);return t&&{date:t.date,s:t.slotStart,e:t.slotEnd,pinned:t.pinned}},mv.id);
  ok('la sesión se mueve al día y hora elegidos',moved&&moved.date===destino&&moved.s==='18:30'&&moved.pinned===true,JSON.stringify(moved));
  const tras=await p.evaluate(id=>{replanAll();const t=S.tasks.find(x=>x.id===id);return t&&{date:t.date,s:t.slotStart,n:S.tasks.filter(x=>x.id===id).length}},mv.id);
  ok('al reorganizar, Arvis respeta la sesión fijada',tras&&tras.date===destino&&tras.s==='18:30'&&tras.n===1,JSON.stringify(tras));
  ok('las demás sesiones no chocan con la fijada',await p.evaluate(d=>{
    const l=S.tasks.filter(t=>t.date===d&&t.slotStart).map(t=>[toMin(t.slotStart),toMin(t.slotEnd)]).sort((a,b)=>a[0]-b[0]);
    return l.every((x,i)=>i===0||x[0]>=l[i-1][1])},destino));
  const err=await p.evaluate(id=>{const t=S.tasks.find(x=>x.id===id),antes=t.date;saveMoveTask(id,'2000-01-01','');const a=t.date;saveMoveTask(id,addDays(today(),40),'');return {antes,a,b:t.date}},mv.id);
  ok('no deja mover al pasado ni después de la evaluación',err.a===err.antes&&err.b===err.antes,JSON.stringify(err));
  await p.evaluate(id=>unpinTask(id),mv.id);
  ok('"Dejar que Arvis la ubique" la libera',await p.evaluate(()=>S.tasks.every(t=>!t.pinned)));

  // ---- Exportar sesiones ----
  await p.evaluate(()=>go('semana'));
  const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('[data-focus-id="export-sessions"]').click()]);
  const ics=fs.readFileSync(await dl.path(),'utf8'),lines=ics.split('\r\n');
  const pend=await p.evaluate(()=>S.tasks.filter(t=>!t.done&&t.date>=today()).length);
  ok('exporta todas las sesiones pendientes',ics.startsWith('BEGIN:VCALENDAR')&&(ics.match(/BEGIN:VEVENT/g)||[]).length===pend,pend+' sesiones');
  ok('sesiones con hora usan DTSTART con hora',/DTSTART:\d{8}T\d{6}/.test(ics));
  ok('líneas del .ics ≤ 75 bytes',lines.every(l=>Buffer.byteLength(l)<=75));

  // ---- Respaldo ----
  const bk=await p.evaluate(()=>{
    const t=S.tasks.find(x=>!x.done);t.pinned=true;
    const j=JSON.parse(JSON.stringify(S)),okv=validState(j)===null&&cleanState(j).tasks.some(x=>x.pinned===true);
    const malo=JSON.parse(JSON.stringify(S));malo.tasks.find(x=>x.pinned).pinned='si';
    delete t.pinned;return {okv,malo:validState(malo)};
  });
  ok('el respaldo conserva sesiones fijadas y rechaza valores inválidos',bk.okv&&bk.malo==='tareas',JSON.stringify(bk));

  // ---- Textos y accesibilidad ----
  const textos=await p.evaluate(()=>{const out=[];['hoy','semana','syllabus'].forEach(t=>{go(t);out.push(document.getElementById('app').innerText)});go('hoy');return out.join(' ')});
  ok('ya no aparece "micro-tarea" en pantalla',!/micro-?tarea/i.test(textos));
  await p.setViewportSize({width:375,height:800});
  await p.evaluate(()=>go('hoy'));
  ok('sin desborde horizontal en 375 px',await p.evaluate(()=>document.documentElement.scrollWidth<=377));
  ok('el botón principal mide al menos 44 px',await p.evaluate(()=>{const b=document.querySelector('[data-focus-id="hero-start"]');return !b||b.getBoundingClientRect().height>=44}));
  ok('hay espacio para que el chat no tape el final',await p.evaluate(()=>{const fab=document.querySelector('.chat-fab');if(!fab)return true;return parseFloat(getComputedStyle(document.getElementById('app')).paddingBottom)>=fab.getBoundingClientRect().height}));
  ok('existe región para anuncios del lector de pantalla',await p.evaluate(()=>{announce('prueba');const el=document.getElementById('sr-announce');return !!el&&el.getAttribute('aria-live')==='polite'}));

  ok('sin peticiones externas',external.length===0,external.join(', '));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r=>r.startsWith('FALLA'))?1:0);
})();
