// Chat con Arvis: solo en modo institucional, sin red y con acciones confirmadas.
const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1100,height:850}});
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
    S.courses=[{id:'c1',name:'Cálculo Numérico',difficulty:3,color:'#3b6df0',grades:[{id:'g1',name:'C1',weight:30,score:4.5}],share:false,passGrade:4,roundFinal:true},
      {id:'c2',name:'Termodinámica',difficulty:3,color:'#e0693a',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.events=[{id:'e1',courseId:'c2',title:'Certamen 1',date:addDays(today(),4),type:'evaluacion'}];
    S.wellbeing.diary=[{date:today(),mood:3,energy:3,sleep:3,tags:[],note:'SECRETO_DIARIO',ts:1}];
    replanAll();save();go('inicio');
  });

  const last=()=>p.locator('.chat-msg.arvis').last().innerText();
  const send=async m=>{await p.fill('#chat-input',m);await p.press('#chat-input','Enter')};
  const settled=async()=>{await p.waitForFunction(()=>!chatBusy&&!document.querySelector('.chat-typing'),null,{timeout:5000});await p.waitForTimeout(40)};
  const say=async m=>{await send(m);await settled();return last()};

  ok('modo Personal no muestra ni monta el chat',await p.locator('#chat-fab').count()===0&&
    await p.evaluate(()=>document.getElementById('chat-root').innerHTML===''&&!document.body.classList.contains('has-chat')));

  await p.evaluate(async()=>{linkInstitution('udec','ana@udec.cl',await makeInstAuth('Clave1234'));instSessionSet();render()});
  ok('modo Institucional muestra el botón flotante con Arvis',await p.locator('#chat-fab').count()===1&&
    (await p.locator('#chat-fab').innerText()).includes('Pregúntale a Arvis')&&
    (await p.getAttribute('#chat-fab img.chat-av','src'))==='icons/arvis/arvis-normal.svg');

  await p.click('#chat-fab');await p.waitForSelector('#chat-panel');
  const panel=await p.locator('#chat-panel').innerText();
  ok('el panel es un diálogo con encabezado, etiqueta y nota de privacidad',
    await p.locator('#chat-panel[role="dialog"]').count()===1&&
    (await p.locator('#chat-panel header b').innerText())==='Arvis · Asistente UdeC'&&
    panel.includes('Prototipo')&&panel.includes('Demo sin IA real')&&panel.includes('no se envía nada'));
  ok('el historial es un log accesible',await p.getAttribute('#chat-log','role')==='log'&&await p.getAttribute('#chat-log','aria-live')==='polite');
  ok('saluda con el nombre y ofrece cinco sugerencias',(await last()).includes('Ana')&&await p.locator('.chat-chip').count()===5);
  ok('ocupa toda la ventana, tapa la app y bloquea el scroll',await p.evaluate(()=>{
    const el=document.getElementById('chat-panel'),r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return s.position==='fixed'&&Math.round(r.width)===innerWidth&&Math.round(r.height)===innerHeight&&
      s.borderRadius==='0px'&&getComputedStyle(document.body).overflow==='hidden'&&
      getComputedStyle(document.getElementById('chat-fab')).display==='none';
  }));

  await send('hola');
  ok('muestra el indicador de pensando antes de responder',await p.locator('.chat-typing').count()===1&&
    (await p.locator('.chat-typing').innerText()).includes('Arvis está pensando'));
  await settled();
  ok('responde al saludo',(await last()).includes('¡Hola, Ana!'));

  const hoy=await say('¿Qué tengo hoy?');
  ok('responde qué hay para hoy con micro-tareas y capacidad',/sesi[oó]n/.test(hoy)&&/Capacidad ~/.test(hoy));
  ok('no lee bienestar sin consentimiento',hoy.includes('No usé datos de bienestar')&&!hoy.includes('SECRETO_DIARIO'));
  ok('lista próximas evaluaciones',(await say('próximas evaluaciones')).includes('Certamen 1'));
  ok('calcula cómo vas en notas',(await say('¿Cómo voy en mis notas?')).includes('4,5'));
  ok('entiende abreviaturas de ramos',(await say('agrega control de termo mañana')).includes('Termodinámica'));
  await p.locator('.chat-actions .btn.sec').last().click();await p.waitForTimeout(100);
  ok('"No, gracias" no cambia ningún dato',await p.evaluate(()=>S.events.length)===1);

  const fecha=await p.evaluate(()=>addDays(today(),6)),corta=await p.evaluate(d=>dshort(d),fecha);
  const antes=await p.evaluate(()=>S.events.length);
  const propuesta=await say(`agrega certamen 2 de calculo el ${corta}`);
  ok('propone agregar sin tocar los datos',/Agrego/.test(propuesta)&&await p.evaluate(()=>S.events.length)===antes);
  await p.locator('.chat-actions .btn',{hasText:'Sí, agregar'}).last().click();await p.waitForTimeout(150);
  ok('al confirmar agrega la fecha y replanifica',await p.evaluate(d=>S.events.some(e=>e.title==='Certamen 2'&&e.courseId==='c1'&&e.date===d)&&S.lastPlan===today(),fecha));
  ok('el avatar de la confirmación cambia a celebrando',
    (await p.locator('.chat-msg.arvis').last().locator('img.chat-av').getAttribute('src'))==='icons/arvis/arvis-celebrando.svg');

  const falta=await say('agrega una prueba');
  ok('pide ramo y fecha cuando faltan',falta.includes('Me falta el ramo y la fecha'),falta.slice(0,120));
  ok('responde dudas con los textos de AYUDA',(await say('¿cómo uso el check-in?')).includes('Check-in: Registra tu energía'));
  const crisis=await say('no quiero vivir');
  ok('ante crisis muestra *4141 y el apoyo institucional',crisis.includes('*4141')&&crisis.includes('600 360 7777')&&crisis.includes('131')&&crisis.includes('DISE'));
  ok('el avatar de crisis es preocupado',
    (await p.locator('.chat-msg.arvis').last().locator('img.chat-av').getAttribute('src'))==='icons/arvis/arvis-preocupado.svg');
  ok('ofrece el botón de Ir a Apoyo',(await p.locator('.chat-msg.arvis').last().innerText()).includes('Ir a Apoyo'));

  const confirmar=async(label)=>{await p.locator('.chat-actions .btn',{hasText:label}).last().click();await p.waitForTimeout(120)};
  const cancelar=async()=>{await p.locator('.chat-actions .btn.sec',{hasText:'No, gracias'}).last().click();await p.waitForTimeout(80)};
  const deshacer=async()=>{await p.evaluate(()=>{const b=document.querySelector('.toast-undo');if(b)b.click()});await p.waitForTimeout(100)};
  const fechaMover=await p.evaluate(()=>addDays(today(),9)),cortaMover=await p.evaluate(d=>dshort(d),fechaMover);
  const mover=await say(`mueve certamen 2 de calculo al ${cortaMover}`);
  ok('propone mover sin tocar los datos',/Muevo|Te propongo mover/.test(mover)&&await p.evaluate(d=>!S.events.some(e=>e.title==='Certamen 2'&&e.date===d),fechaMover),mover.slice(0,160));
  await confirmar('Sí, mover');
  ok('al confirmar mueve la fecha',await p.evaluate(d=>S.events.some(e=>e.title==='Certamen 2'&&e.date===d),fechaMover),await p.evaluate(d=>S.events.find(e=>e.title==='Certamen 2').date+' vs '+d,fechaMover));
  await deshacer();
  ok('mover se puede deshacer',await p.evaluate(d=>!S.events.some(e=>e.title==='Certamen 2'&&e.date===d),fechaMover));

  const borrar=await say('borra certamen 2 de calculo');
  ok('propone eliminar sin tocar los datos',borrar.includes('Quito')&&await p.evaluate(()=>S.events.some(e=>e.title==='Certamen 2')));
  await confirmar('Sí, eliminar');
  ok('al confirmar elimina la fecha',await p.evaluate(()=>!S.events.some(e=>e.title==='Certamen 2')));
  await deshacer();
  ok('eliminar se puede deshacer',await p.evaluate(()=>S.events.some(e=>e.title==='Certamen 2')));

  const tarea=await p.evaluate(()=>{const t=(S.tasks||[]).find(x=>x.date===today()&&!x.done);return t?{id:t.id,title:t.title}:null});
  if(tarea){
    const marcar=await say(`ya hice la micro-tarea ${tarea.title}`);
    ok('propone marcar micro-tarea',marcar.includes('Marco como hecha'));
    await confirmar('Sí, marcar');
    ok('al confirmar marca la micro-tarea',await p.evaluate(id=>S.tasks.find(x=>x.id===id).done,tarea.id));
    await deshacer();
    ok('marcar se puede deshacer',await p.evaluate(id=>!S.tasks.find(x=>x.id===id).done,tarea.id));
  }else ok('propone marcar micro-tarea',false,'sin micro-tareas de prueba');

  const nota=await say('me saque 5 en prueba 1 de termo');
  ok('pide la ponderación cuando falta',nota.includes('ponderación'));
  await p.locator('.chat-msg.arvis').last().locator('.chat-chip',{hasText:'30%'}).click();await settled();
  ok('guarda la ponderación dicha en el chip',(await last()).includes('30%'));
  await confirmar('Sí, registrar');
  ok('al confirmar registra la nota',await p.evaluate(()=>S.courses.find(c=>c.name==='Termodinámica').grades.some(g=>g.score===5&&g.weight===30)));
  await deshacer();
  ok('registrar nota se puede deshacer',await p.evaluate(()=>!S.courses.find(c=>c.name==='Termodinámica').grades.some(g=>g.score===5&&g.weight===30)));

  const sesiones=await p.evaluate(()=>S.sessions.length);
  const estudiar=await say('estudiar termo 45 min mañana');
  ok('propone agendar estudio',/Aparto|Bloque de/.test(estudiar),estudiar.slice(0,160));
  await confirmar('Sí, agendar');
  ok('al confirmar agrega el bloque de estudio',await p.evaluate(n=>S.sessions.length===n+1,sesiones));
  await deshacer();

  const suave=await say('estoy muy cansado');
  ok('ofrece bajar la carga con consentimiento',suave.includes('modo suave'));
  await confirmar('Activar modo suave');
  ok('activa el modo suave',await p.evaluate(()=>!!S.soft));
  await p.evaluate(()=>document.getElementById('toast').classList.remove('on'));
  const replan=await say('reorganiza mis pendientes');
  ok('reorganiza cuando se lo pides',replan.includes('Reorganizar pendientes')||replan.includes('Ya tienes el modo suave'),replan.slice(0,160));
  await confirmar('Reorganizar pendientes');
  ok('al confirmar reordena',(await last()).includes('Reorganicé'));

  await say('inicia un pomodoro');
  await confirmar('Iniciar pomodoro');
  ok('el pomodoro se inicia desde el chat',await p.evaluate(()=>tab==='herramientas'&&!!S.tools.pomodoro.running));
  await p.evaluate(()=>{if(typeof focusClose==='function')focusClose()});

  const ahora=await say('¿qué hago ahora?');
  ok('sugiere una sola tarea y no lee bienestar',/una sola cosa|una sola sesi[oó]n/.test(ahora)&&ahora.includes('No usé datos de bienestar'));

  const chipFalta=await say('agrega una prueba');
  ok('ofrece chips para completar datos que faltan',chipFalta.includes('Me falta el ramo y la fecha')&&await p.locator('.chat-msg.arvis').last().locator('.chat-chip').count()>0);
  await p.locator('.chat-msg.arvis').last().locator('.chat-chip',{hasText:'Cálculo Numérico'}).click();await settled();
  const fechaFalta=await last();
  ok('recuerda el ramo elegido y pide solo la fecha',fechaFalta.includes('falta la fecha'),fechaFalta.slice(0,160));
  await p.locator('.chat-msg.arvis').last().locator('.chat-chip',{hasText:'Mañana'}).click();await settled();
  ok('usa el chip de fecha y vuelve a proponer',(await last()).includes('Agrego'));
  await cancelar();

  await say('llévame a notas');
  ok('navega sin cerrar el panel',await p.evaluate(()=>tab)==='notas'&&await p.locator('#chat-panel').count()===1);
  await p.setViewportSize({width:390,height:780});
  ok('en móvil el fab queda oculto tras el panel a pantalla completa',await p.locator('#chat-fab').isHidden()&&await p.locator('#chat-panel').isVisible()&&
    await p.evaluate(()=>Math.round(document.getElementById('chat-panel').getBoundingClientRect().height)===innerHeight));
  await p.setViewportSize({width:1100,height:850});
  const filtrado=await p.evaluate(()=>({s:JSON.stringify(S).includes('no quiero vivir'),ls:(localStorage.getItem('entrenador-academico-v1')||'').includes('no quiero vivir')}));
  ok('la conversación no queda en S ni en el respaldo local',!filtrado.s&&!filtrado.ls);

  await p.click('#chat-panel .icon-btn');
  ok('el botón ✕ cierra, devuelve el foco y libera el scroll',await p.locator('#chat-panel').count()===0&&
    await p.evaluate(()=>document.activeElement.id==='chat-fab'&&getComputedStyle(document.body).overflow!=='hidden'));
  await p.click('#chat-fab');
  ok('vuelve a abrir el chat',await p.locator('#chat-panel').count()===1);
  await p.keyboard.press('Escape');
  ok('Escape cierra el panel y devuelve el foco',await p.locator('#chat-panel').count()===0&&
    await p.evaluate(()=>document.activeElement.id==='chat-fab'&&getComputedStyle(document.body).overflow!=='hidden'));

  await p.evaluate(()=>{S.settings.arvis=false;save();document.getElementById('chat-root').innerHTML='';chatSync()});
  ok('sin Arvis el chat sigue pero sin imagen de la mascota',await p.locator('#chat-fab').count()===1&&
    await p.locator('#chat-fab img.chat-av').count()===0&&await p.locator('#chat-fab .chat-av-txt').count()===1);

  await p.evaluate(()=>{unlinkInstitution();render()});
  ok('al volver a Personal desaparece y borra la conversación',await p.locator('#chat-fab').count()===0&&
    await p.evaluate(()=>chatMsgs.length===0&&chatOpen===false&&document.getElementById('chat-root').innerHTML===''));

  ok('sin peticiones de red externas',external.length===0,external.slice(0,3).join(' | '));
  ok('sin errores en consola',errs.length===0,errs.join(' | '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exitCode=1});
