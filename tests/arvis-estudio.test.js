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
  const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
  if(await p.locator('#reg-name').count()){
    await p.fill('#reg-name','Prueba');await p.fill('#reg-career','Carrera');
    await p.locator('.hud-btn').click();
  }
  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.settings.arvis=true;S.lastPlan=today();save();go('herramientas');
  });

  const fases=await p.evaluate(()=>{
    arvisMomento=null;
    S.tools.pomodoro={...freshPomodoro(),sound:false};save();go('herramientas');pomStart();
    const c=document.querySelector('#arvis-estudiando'),i=c&&c.querySelector('img');
    const estudio={src:i&&i.getAttribute('src'),texto:c&&c.textContent,mediano:!!c&&c.classList.contains('arvis-md'),ancho:i?Math.round(parseFloat(getComputedStyle(i).width)):0};
    S.tools.pomodoro.endsAt=Date.now()-1;pomAdvance();arvisMomento=null;render();
    const d=document.querySelector('#arvis-pomodoro-descanso'),di=d&&d.querySelector('img');
    return {estudio,descanso:{src:di&&di.getAttribute('src'),texto:d&&d.textContent},phase:S.tools.pomodoro.phase};
  });
  ok('Arvis estudia en mediano con mensaje inicial',fases.estudio.src==='icons/arvis/arvis-estudiando.svg'&&fases.estudio.mediano&&fases.estudio.ancho===120&&/Vamos, yo también me concentro\./.test(fases.estudio.texto),JSON.stringify(fases.estudio));
  ok('Arvis cambia a descansando al terminar el foco',fases.descanso.src==='icons/arvis/arvis-descansando.svg'&&/Pausa\. Estírate o toma agua\./.test(fases.descanso.texto)&&fases.phase==='short',JSON.stringify(fases.descanso));

  const vuelta=await p.evaluate(()=>{
    arvisMomento=null;
    S.tools.pomodoro={...freshPomodoro(),sound:false};save();go('herramientas');pomStart();
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    document.dispatchEvent(new Event('visibilitychange'));
    const endsAt=S.tools.pomodoro.endsAt;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
    document.dispatchEvent(new Event('visibilitychange'));
    const c=document.querySelector('#arvis-pomodoro-vuelta');
    const botones=c?Array.from(c.querySelectorAll('button')).map(x=>x.textContent.trim()):[];
    return {texto:c&&c.textContent,botones,endsAt,igual:S.tools.pomodoro.endsAt===endsAt,corriendo:S.tools.pomodoro.running};
  });
  ok('Arvis dice "Te esperé" al volver de otra pestaña',/Te esperé\. ¿Seguimos\?/.test(vuelta.texto||'')&&vuelta.botones.join('|')==='Seguir|Terminar por hoy',JSON.stringify(vuelta.botones));
  ok('el temporizador conserva su marca de tiempo',vuelta.igual&&vuelta.corriendo,JSON.stringify(vuelta));

  const limite=await p.evaluate(()=>{
    arvisMomento=null;
    S.sessions=[{id:'s1',date:today(),courseId:'c1',minutes:capFor(today())}];
    S.tools.pomodoro={...freshPomodoro(),sound:false};save();go('herramientas');pomStart();
    const c=document.querySelector('#arvis-pomodoro-limite'),boton=c&&c.querySelector('button');
    const texto=c&&c.textContent,label=boton&&boton.textContent.trim(),bloqueado=!S.tools.pomodoro.running;
    if(boton)boton.click();
    return {texto,label,bloqueado,corriendo:S.tools.pomodoro.running};
  });
  ok('al llegar al límite diario Arvis avisa sin iniciar',/Ya cumpliste por hoy/.test(limite.texto||'')&&limite.label==='Iniciar igual'&&limite.bloqueado,JSON.stringify(limite));
  ok('"Iniciar igual" permite comenzar de todas formas',limite.corriendo,String(limite.corriendo));

  const fc=await p.evaluate(()=>{
    arvisMomento=null;
    S.tools.flashcards={decks:[{id:'d1',name:'Mazo',courseId:'c1',cards:Array.from({length:6},(_,i)=>({id:'q'+(i+1),front:'Pregunta '+(i+1),back:'Respuesta '+(i+1),box:1,due:today()}))}],activeDeckId:'d1',limit:20,correct:0};
    save();go('herramientas');startFlashcards();
    const c=document.querySelector('#arvis-flashcard'),img=c&&c.querySelector('img');
    const pregunta={src:img&&img.getAttribute('src'),texto:c&&c.textContent};
    for(let n=0;n<3;n++){showFlashcardAnswer();flashcardAnswerNow(true)}
    const c3=document.querySelector('#arvis-celebrando'),i3=c3&&c3.querySelector('img'),msg3=c3&&c3.textContent;
    for(let n=0;n<2;n++){showFlashcardAnswer();flashcardAnswerNow(true)}
    const c5=document.querySelector('#arvis-celebrando'),i5=c5&&c5.querySelector('img'),msg5=c5&&c5.textContent;
    showFlashcardAnswer();flashcardAnswerNow(true);
    const resumen=document.querySelector('#arvis-flashcard');
    return {pregunta,msg3,src3:i3&&i3.getAttribute('src'),msg5,src5:i5&&i5.getAttribute('src'),resumen:resumen&&resumen.textContent,aciertos:S.tools.flashcards.correct,pomodoros:S.tools.pomodoro.completed};
  });
  ok('Arvis normal hace la pregunta de cada tarjeta',fc.pregunta.src==='icons/arvis/arvis-normal.svg'&&/Pregunta 1/.test(fc.pregunta.texto||''),JSON.stringify(fc.pregunta));
  ok('celebración tras 3 aciertos seguidos',fc.src3==='icons/arvis/arvis-celebrando.svg'&&/Tres seguidas/.test(fc.msg3||''),JSON.stringify(fc.msg3));
  ok('celebración distinta tras 5 aciertos',fc.src5==='icons/arvis/arvis-celebrando.svg'&&/Cinco seguidas/.test(fc.msg5||'')&&fc.msg5!==fc.msg3,JSON.stringify(fc.msg5));
  ok('resumen del mazo en la burbuja de Arvis',/Acertaste 6 de 6\./.test(fc.resumen||'')&&fc.aciertos===6,JSON.stringify(fc.resumen));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
