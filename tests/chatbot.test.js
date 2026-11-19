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
  const say=async m=>{await send(m);await p.waitForTimeout(450);return last()};

  ok('modo Personal no muestra ni monta el chat',await p.locator('#chat-fab').count()===0&&
    await p.evaluate(()=>document.getElementById('chat-root').innerHTML===''&&!document.body.classList.contains('has-chat')));

  await p.evaluate(()=>{linkInstitution('udec','ana@udec.cl');render()});
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

  await send('hola');
  ok('muestra el indicador de escribiendo antes de responder',await p.locator('.chat-typing').count()===1);
  await p.waitForTimeout(450);
  ok('responde al saludo',(await last()).includes('¡Hola, Ana!'));

  const hoy=await say('¿Qué tengo hoy?');
  ok('responde qué hay para hoy con micro-tareas y capacidad',/micro-tarea/.test(hoy)&&/Capacidad ~/.test(hoy));
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

  ok('pide ramo y fecha cuando faltan',(await say('agrega una prueba')).includes('Me falta el ramo y la fecha'));
  ok('responde dudas con los textos de AYUDA',(await say('¿cómo uso el check-in?')).includes('Check-in: Registra tu energía'));
  const crisis=await say('no quiero vivir');
  ok('ante crisis muestra *4141 y el apoyo institucional',crisis.includes('*4141')&&crisis.includes('600 360 7777')&&crisis.includes('131')&&crisis.includes('DISE'));
  ok('el avatar de crisis es preocupado',
    (await p.locator('.chat-msg.arvis').last().locator('img.chat-av').getAttribute('src'))==='icons/arvis/arvis-preocupado.svg');
  ok('ofrece el botón de Ir a Apoyo',(await p.locator('.chat-msg.arvis').last().innerText()).includes('Ir a Apoyo'));

  await say('llévame a notas');
  ok('navega sin cerrar el panel',await p.evaluate(()=>tab)==='notas'&&await p.locator('#chat-panel').count()===1);
  await p.setViewportSize({width:390,height:780});
  ok('en móvil solo muestra el avatar sobre la barra inferior',await p.locator('#chat-fab .chat-fab-txt').isHidden()&&
    await p.evaluate(()=>document.getElementById('chat-fab').getBoundingClientRect().bottom<=document.getElementById('mobile-nav').getBoundingClientRect().top));
  await p.setViewportSize({width:1100,height:850});
  const filtrado=await p.evaluate(()=>({s:JSON.stringify(S).includes('no quiero vivir'),ls:(localStorage.getItem('entrenador-academico-v1')||'').includes('no quiero vivir')}));
  ok('la conversación no queda en S ni en el respaldo local',!filtrado.s&&!filtrado.ls);

  await p.keyboard.press('Escape');
  ok('Escape cierra el panel',await p.locator('#chat-panel').count()===0);

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
