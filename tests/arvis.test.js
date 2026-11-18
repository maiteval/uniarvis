const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const file=process.argv[2]||path.join(__dirname,'..','index.html');
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1100,height:900}});
  const res=[],errs=[];
  const ok=(name,cond,extra='')=>res.push((cond?'OK   ':'FALLA')+' '+name+(extra?'  → '+extra:''));
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  await p.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await p.goto('file://'+path.resolve(file));
  if(await p.locator('#reg-name').count()){
    await p.fill('#reg-name','Prueba');await p.fill('#reg-career','Carrera');
    await p.locator('.hud-btn').click();
    const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
  }
  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.lastPlan=today();save();go('inicio');
  });

  const mapa=await p.evaluate(()=>[5,4,3,2,1].map(n=>{
    S.wellbeing.diary=[{date:today(),energy:n,mood:3,sleep:3,tags:[],note:'',ts:Date.now()}];
    return arvisEstadoDelDia();
  }));
  ok('Arvis elige estado según energía',mapa.join()==='energia,energia,normal,cansado,descansando',mapa.join(','));

  const alta=await p.evaluate(()=>{
    S.wellbeing.diary=[{date:today(),energy:5,mood:5,sleep:5,tags:[],note:'',ts:Date.now()}];save();go('inicio');
    const c=document.querySelector('#arvis-inicio'),i=c&&c.querySelector('img'),bubble=c&&c.querySelector('.arvis-bubble p');
    return {src:i&&i.getAttribute('src'),alt:i&&i.getAttribute('alt'),texto:bubble&&bubble.textContent};
  });
  ok('energía 5 muestra arvis-energia en el inicio',alta.src==='icons/arvis/arvis-energia.svg'&&alta.alt===''&&!!alta.texto,JSON.stringify(alta.src));

  const baja=await p.evaluate(()=>{
    S.wellbeing.diary=[{date:today(),energy:1,mood:2,sleep:2,tags:[],note:'',ts:Date.now()}];save();go('inicio');
    const i=document.querySelector('#arvis-inicio img');
    return {src:i&&i.getAttribute('src'),texto:document.querySelector('#arvis-inicio').textContent};
  });
  ok('energía 1 muestra arvis-descansando sin presionar',baja.src==='icons/arvis/arvis-descansando.svg'&&!!baja.texto&&!/racha|puntaje|debes|tienes que|fallaste/i.test(baja.texto),JSON.stringify(baja.src));

  const sin=await p.evaluate(()=>{
    S.wellbeing.diary=[];save();go('inicio');
    const c=document.querySelector('#arvis-inicio'),i=c&&c.querySelector('img'),link=c&&c.querySelector('[onclick*="bienestar"]');
    return {src:i&&i.getAttribute('src'),link:!!link,texto:c&&c.textContent};
  });
  ok('sin check-in muestra Arvis normal con enlace a Bienestar',sin.src==='icons/arvis/arvis-normal.svg'&&sin.link&&/check-in/i.test(sin.texto),JSON.stringify(sin.texto));

  await p.locator('.brand').click();
  await p.locator('.home-card').filter({hasText:'Ajustes'}).click();
  await p.click('nav >> text="Apariencia"');
  const toggle=p.locator('input[onchange="setArvis(this.checked)"]');
  ok('Ajustes incluye el interruptor "Mostrar a Arvis" activado',await toggle.count()===1&&await toggle.isChecked()&&await p.evaluate(()=>S.settings.arvis===true));
  await toggle.uncheck();
  await p.evaluate(()=>go('inicio'));
  ok('al apagarlo Arvis desaparece y la app sigue igual',await p.locator('.arvis-card').count()===0&&await p.locator('.home-card').count()===5&&await p.evaluate(()=>S.settings.arvis===false));
  await p.evaluate(()=>go('tema'));
  await p.locator('input[onchange="setArvis(this.checked)"]').check();

  const cele=await p.evaluate(()=>{
    S.wellbeing.diary=[{date:today(),energy:5,mood:5,sleep:5,tags:[],note:'',ts:Date.now()}];
    S.events=[{id:'e1',courseId:'c1',title:'Certamen',date:addDays(today(),10),type:'evaluacion'}];
    S.tasks=[{id:'t1',eventId:'e1',courseId:'c1',title:'Repasar',date:today(),minutes:25,done:false}];
    save();go('hoy');toggleTask('t1');
    const c=document.querySelector('#arvis-celebrando'),i=c&&c.querySelector('img');
    return {src:i&&i.getAttribute('src'),sesiones:S.sessions.length};
  });
  ok('terminar una sesión muestra Arvis celebrando',cele.src==='icons/arvis/arvis-celebrando.svg'&&cele.sesiones===1,JSON.stringify(cele));

  const pom=await p.evaluate(()=>{
    S.tools.pomodoro={...freshPomodoro(),running:true,endsAt:Date.now()+600000,leftMs:600000,sound:false};
    save();go('herramientas');
    const estudio=document.querySelector('#arvis-estudiando'),small=estudio&&estudio.classList.contains('arvis-sm');
    S.tools.pomodoro.endsAt=Date.now()-1;pomAdvance();
    const c=document.querySelector('#arvis-celebrando'),i=c&&c.querySelector('img');
    return {estudio:!!estudio,small,src:i&&i.getAttribute('src'),phase:S.tools.pomodoro.phase};
  });
  ok('durante el foco Arvis estudia en pequeño',pom.estudio&&pom.small,JSON.stringify(pom));
  ok('al terminar un pomodoro Arvis celebra',pom.src==='icons/arvis/arvis-celebrando.svg'&&pom.phase==='short',JSON.stringify(pom.src));

  const alerta=await p.evaluate(()=>{
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),2),type:'evaluacion'}];
    S.tasks=[];save();go('inicio');
    const c=document.querySelector('#arvis-alerta'),i=c&&c.querySelector('img'),btn=c&&c.querySelector('[onclick*="semana"]');
    return {src:i&&i.getAttribute('src'),btn:!!btn,texto:c&&c.textContent};
  });
  ok('fecha en menos de 3 días sin plan muestra Arvis preocupado con botón',alerta.src==='icons/arvis/arvis-preocupado.svg'&&alerta.btn&&/Planificar/.test(alerta.texto),JSON.stringify(alerta.texto));

  const vacio=await p.evaluate(()=>{
    S.events=[];S.tasks=[];S.courses=[];save();go('ramos');
    const ramos=document.querySelector('#arvis-vacio-ramos'),srcR=ramos&&ramos.querySelector('img').getAttribute('src');
    go('hoy');const tareas=document.querySelector('#arvis-vacio-tareas'),srcT=tareas&&tareas.querySelector('img').getAttribute('src');
    return {srcR,srcT};
  });
  ok('estados vacíos muestran Arvis normal con instrucciones',vacio.srcR==='icons/arvis/arvis-normal.svg'&&vacio.srcT==='icons/arvis/arvis-normal.svg',JSON.stringify(vacio));

  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    save();go('inicio');
  });
  await p.click('.help-btn');
  const avatar=await p.locator('.help-with-arvis .arvis-avatar').getAttribute('src');
  ok('la ayuda usa arvis-normal.svg como avatar',avatar==='icons/arvis/arvis-normal.svg',String(avatar));
  await p.click('.icon-btn[aria-label="Cerrar"]');

  const bk=await p.evaluate(()=>({err:validState(S),on:cleanState(S).settings.arvis,json:JSON.stringify(S)}));
  ok('el ajuste de Arvis se guarda y restaura',bk.err===null&&bk.on===true&&bk.json.includes('"arvis"'),JSON.stringify(bk));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
