const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1200,height:900}});
  await ctx.addInitScript(()=>{
    try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}
    const f=window.fetch;window.fetch=(...a)=>{window.__fetchCalls=(window.__fetchCalls||0)+1;return f(...a)};
    const o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(...a){window.__xhrCalls=(window.__xhrCalls||0)+1;return o.apply(this,a)};
  });
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
    S=fresh();S.profile={name:'Ana',career:'Ingeniería'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo Numérico',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    save();go('syllabus');
  });
  ok('Personal: no aparece «Analizar con Arvis»',await p.locator('text=Analizar con Arvis').count()===0);
  ok('Personal: el lector clásico sigue disponible',await p.locator('button',{hasText:'Analizar syllabus'}).count()===1&&
    await p.locator('#syl-file').count()===1);
  await p.evaluate(()=>{go('herramientas')});
  ok('Personal: no aparece «Crear con Arvis»',await p.locator('text=Crear con Arvis').count()===0&&
    await p.locator('#fc-import').count()===0);
  const nulo=await p.evaluate(async()=>({s:await ArvisIA.extractSyllabus('x',null),f:await ArvisIA.makeFlashcards('x',{}),c:ArvisIA.context()}));
  ok('Personal: funciones de IA simulada no operan',nulo.s===null&&nulo.f===null&&nulo.c===null);

  const lector=await p.evaluate(()=>{
    const d=parse(addDays(today(),12));
    sylCourse='c1';sylText=`Certamen 1 el ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}\n`;
    const antes=S.events.length;
    analyze();const detectado=pending.length,sinConfirmar=S.events.length;
    addPending();
    return {antes,detectado,sinConfirmar,despues:S.events.length};
  });
  ok('Personal: detecta fechas y solo agrega tras confirmar',lector.detectado===1&&
    lector.sinConfirmar===lector.antes&&lector.despues===lector.antes+1,JSON.stringify(lector));

  await p.evaluate(async()=>{
    linkInstitution('udec','ana@udec.cl',await makeInstAuth('Clave1234'));instSessionSet();
    S.profile={name:'Ana',career:'Ingeniería',university:''};
    S.courses=[{id:'c1',name:'Cálculo Numérico',difficulty:4,color:'#3b6df0',
      grades:[{id:'g1',name:'Certamen 1',weight:10,score:3.8},{id:'g2',name:'Controles',weight:10}],
      share:false,passGrade:5,roundFinal:true}];
    S.events=[];sylText='';sylCourse='';sylAi=null;
    const d1=parse(addDays(today(),12)),d2=parse(addDays(today(),20)),d3=parse(addDays(today(),25));
    window.__syl=[
      'Syllabus Cálculo Numérico',
      `Certamen 1 (30%) el ${d1.getDate()}/${d1.getMonth()+1}/${d1.getFullYear()}`,
      `Certamen 2: 25 %, prueba el ${d2.getDate()}/${d2.getMonth()+1}/${d2.getFullYear()}`,
      'Controles 20%',
      `${d3.getDate()}/${d3.getMonth()+1}/${d3.getFullYear()}`,
      'Tarea final (20 % aprox.)',
      'Nota final = 0,3·C1 + 0,3·C2 + 0,4·Ex',
      'Nota mínima 4,0',
      'Exigencia 60%',
      'Eximición con 5,5',
      'Examen obligatorio si promedio < 4,0',
      'Asistencia mínima 75%',
      'Semana 3: Integrales',
      '- Integrales definidas'
    ].join('\n');
    const ev=detectEvents(window.__syl,'c1')[0];
    S.events.push({id:'e0',courseId:'c1',title:ev.title,date:ev.date,type:ev.type});
    sylText=window.__syl;sylCourse='c1';
    window.__antes=JSON.parse(JSON.stringify({eventos:S.events,grades:S.courses[0].grades,pass:S.courses[0].passGrade}));
    save();go('syllabus');render();
  });
  ok('Institucional: botón «Analizar con Arvis» con etiqueta IA · demo',
    await p.locator('[data-focus-id="syl-ai-analyze"]').count()===1&&
    (await p.locator('[data-focus-id="syl-ai-analyze"]').innerText()).includes('IA · demo'));
  const antes=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__antes)));

  const ext=await p.evaluate(async()=>ArvisIA.extractSyllabus(window.__syl,'c1'));
  ok('extrae fechas reutilizando detectEvents',ext.fechas.length>=3&&
    ext.fechas.every(f=>f.courseId==='c1'&&/^\d{4}-\d{2}-\d{2}$/.test(f.date))&&
    ext.fechas.some(f=>f.confianza==='Revísalo'),JSON.stringify(ext.fechas.map(f=>f.date+':'+f.confianza)));
  ok('extrae ponderaciones',ext.ponderaciones.some(x=>x.nombre.includes('Certamen 1')&&x.peso===30)&&
    ext.ponderaciones.some(x=>x.nombre==='Controles'&&x.peso===20)&&
    ext.ponderaciones.some(x=>x.nombre==='C1'&&x.peso===30),JSON.stringify(ext.ponderaciones.map(x=>x.nombre+':'+x.peso)));
  ok('avisa si las ponderaciones no suman 100 %',ext.avisos.some(x=>x.includes('no 100 %')),ext.avisos.join(' | '));
  ok('extrae nota de aprobación y exigencia',ext.passGrade===4&&ext.exigencia===60);
  ok('extrae requisitos especiales',ext.reglas.some(x=>/Eximición con 5,5/.test(x.texto))&&
    ext.reglas.some(x=>/Examen obligatorio si promedio/.test(x.texto))&&
    ext.reglas.some(x=>/Asistencia mínima 75%/.test(x.texto)));
  ok('extrae contenidos por semana',ext.contenidos.some(x=>x.texto.includes('Semana 3: Integrales')));
  const conf=[...ext.fechas,...ext.ponderaciones,...ext.reglas,...ext.contenidos].map(x=>x.confianza);
  ok('todos los elementos tienen nivel de confianza',conf.every(x=>x==='Seguro'||x==='Revísalo')&&
    conf.includes('Seguro')&&conf.includes('Revísalo'),conf.join(','));

  await p.locator('[data-focus-id="syl-ai-analyze"]').click();
  await p.waitForFunction(()=>!!document.querySelector('#syl-ai-loading'),null,{timeout:3000});
  ok('muestra «Arvis está leyendo tu syllabus…»',(await p.locator('#syl-ai-loading').innerText()).includes('Arvis está leyendo tu syllabus'));
  await p.waitForFunction(()=>!!document.querySelector('#syl-ai-preview'),null,{timeout:5000});
  ok('vista previa con 4 bloques editables',
    JSON.stringify(await p.locator('#syl-ai-preview h3').allTextContents())===JSON.stringify(['Fechas','Ponderaciones','Reglas del ramo','Contenidos']));
  ok('la vista previa muestra confianza y avisos',
    await p.locator('#syl-ai-preview .tag',{hasText:'Revísalo'}).count()>0&&
    (await p.locator('#syl-ai-avisos').innerText()).includes('100 %'));
  const intacto=await p.evaluate(()=>({n:S.events.length,g:S.courses[0].grades,p:S.courses[0].passGrade,
    s:S.courses[0].syllabusNotes||''}));
  ok('nada se agrega antes de confirmar',JSON.stringify(intacto)===JSON.stringify({
    n:antes.eventos.length,g:antes.grades,p:antes.pass,s:''}),JSON.stringify(intacto));

  await p.locator('[data-focus-id="syl-ai-add"]').click();
  await p.waitForSelector('#confirm-dialog:not([hidden])',{timeout:3000});
  ok('pregunta antes de pisar una ponderación existente',
    (await p.locator('#confirm-text').innerText()).includes('Actualizamos el peso'));
  await p.locator('#confirm-ok').click();
  await p.waitForFunction(()=>!document.querySelector('#syl-ai-preview'),null,{timeout:3000});
  const confirmed=await p.evaluate(()=>({
    n:S.events.length,grades:S.courses[0].grades,pass:S.courses[0].passGrade,notas:S.courses[0].syllabusNotes||''
  }));
  const esperadas=ext.fechas.filter(f=>f.keep).length;
  ok('fechas sin duplicados',confirmed.n===antes.eventos.length+esperadas-1,
    JSON.stringify({n:confirmed.n,detectadas:ext.fechas.length,esperadas,antes:antes.eventos.length}));
  ok('no pisa notas con puntaje',confirmed.grades.find(g=>g.id==='g1').weight===10);
  ok('actualiza peso de evaluación sin nota tras preguntar',confirmed.grades.find(g=>g.id==='g2').weight===20);
  ok('crea evaluaciones nuevas en Notas',confirmed.grades.some(g=>g.name.includes('Certamen 2')&&g.weight===25));
  ok('aplica la nota de aprobación confirmada',confirmed.pass===4,String(confirmed.pass));
  ok('guarda reglas y contenidos en syllabusNotes',confirmed.notas.includes('Asistencia mínima 75%')&&
    confirmed.notas.includes('Semana 3: Integrales')&&confirmed.notas.length<=2000,confirmed.notas.slice(0,120));
  ok('Arvis celebra en estado celebrando',await p.locator('#arvis-celebrando img').count()===1&&
    (await p.locator('#arvis-celebrando img').getAttribute('src')).includes('celebrando'));

  const apuntes=[
    'Fotosíntesis: proceso por el cual las plantas convierten luz en energía.',
    'La mitocondria es el orgánulo responsable de la respiración celular.',
    'Área = base * altura / 2',
    'E = m * c^2',
    'Tipos de energía:',
    '- Cinética',
    '- Potencial',
    '- Térmica',
    '¿Qué es una célula?',
    'Es la unidad básica de los seres vivos.',
    'Fotosíntesis: proceso por el cual las plantas convierten luz en energía.',
    'ESTE_TEXTO_NO_DEBE_GUARDARSE'
  ].join('\n');
  const gen=await p.evaluate(async(txt)=>{
    const preg=await ArvisIA.makeFlashcards(txt,{cantidad:10,tipo:'preguntas'});
    const comp=await ArvisIA.makeFlashcards(txt,{cantidad:10,tipo:'completar'});
    const mix=await ArvisIA.makeFlashcards(txt,{cantidad:10,tipo:'mixto'});
    const muchos=Array.from({length:15},(_,i)=>`Término ${i}: definición número ${i} para estudiar.`).join('\n');
    const limite=await ArvisIA.makeFlashcards(muchos,{cantidad:10,tipo:'preguntas'});
    const vacio=await ArvisIA.makeFlashcards('hola mundo\n-texto sin sentido útil',{cantidad:10,tipo:'preguntas'});
    return {preg,comp,mix,limite,vacio};
  },apuntes);
  const tipos=new Set(gen.preg.tarjetas.map(c=>c.tipo));
  ok('genera definición, fórmula, lista y pregunta',['definicion','formula','lista','pregunta'].every(t=>tipos.has(t)),
    [...tipos].join(','));
  ok('fórmula con frente «¿Cuál es la fórmula de…?»',gen.preg.tarjetas.some(c=>c.tipo==='formula'&&/¿Cuál es la fórmula de/.test(c.front)));
  ok('lista con frente «¿Cuáles son…?»',gen.preg.tarjetas.some(c=>c.tipo==='lista'&&/¿Cuáles son los tipos de energía\?/.test(c.front)));
  ok('sin duplicados',new Set(gen.preg.tarjetas.map(c=>c.front+'|'+c.back)).size===gen.preg.tarjetas.length);
  ok('respeta la cantidad elegida',gen.limite.tarjetas.length===10&&gen.preg.tarjetas.length<=10,String(gen.limite.tarjetas.length));
  ok('tipo completar oculta el término con ____',gen.comp.tarjetas.length>0&&
    gen.comp.tarjetas.every(c=>c.tipo==='completar'&&c.front.includes('____')),JSON.stringify(gen.comp.tarjetas[0]||{}));
  ok('tipo mixto combina preguntas y completar',
    gen.mix.tarjetas.some(c=>c.tipo==='completar')&&gen.mix.tarjetas.some(c=>c.tipo!=='completar'));
  ok('texto sin contenido útil da mensaje amable',gen.vacio.tarjetas.length===0&&
    /No encontré material suficiente/.test(gen.vacio.mensaje)&&/definiciones|fórmulas|listas|preguntas/.test(gen.vacio.mensaje),
    gen.vacio.mensaje);

  await p.evaluate(()=>{go('herramientas')});
  await p.locator('#fc-ai summary').click();
  ok('Herramientas: opción «Crear con Arvis» con etiqueta IA · demo',
    (await p.locator('#fc-ai summary').innerText()).includes('Crear con Arvis')&&
    await p.locator('#fc-ai .ai-demo-tag').count()===1);
  ok('ofrece los contenidos del syllabus como texto de partida',await p.locator('#fc-ai-use').count()===1);
  await p.locator('#fc-ai-use').click();
  ok('usa syllabusNotes como texto inicial',(await p.locator('#fc-ai-text').inputValue()).includes('Semana 3: Integrales'));

  await p.locator('#fc-ai-cant').selectOption('10');
  await p.locator('#fc-ai-tipo').selectOption('mixto');
  await p.locator('#fc-ai-text').fill(apuntes);
  await p.locator('#fc-ai-create').click();
  await p.waitForFunction(()=>!!document.querySelector('#fc-ai-loading'),null,{timeout:3000});
  ok('muestra «Arvis está creando tus tarjetas…»',(await p.locator('#fc-ai-loading').innerText()).includes('Arvis está creando tus tarjetas'));
  await p.waitForFunction(()=>!!document.querySelector('#fc-ai-preview'),null,{timeout:5000});
  const filas=p.locator('#fc-ai-preview .fc-ai-row'),n0=await filas.count();
  await filas.first().locator('input').fill('FRENTE EDITADO');
  await filas.first().locator('input').dispatchEvent('change');
  await filas.first().locator('textarea').fill('REVERSO EDITADO');
  await filas.first().locator('textarea').dispatchEvent('change');
  await filas.nth(1).locator('button',{hasText:'Descartar'}).click();
  ok('se pueden editar y descartar tarjetas antes de agregarlas',await p.locator('#fc-ai-preview .fc-ai-row').count()===n0-1);
  await p.locator('[data-focus-id="fc-ai-add"]').click();
  await p.waitForFunction(()=>document.querySelectorAll('[data-focus-id="fc-ai-add"]').length===0,null,{timeout:3000});
  const mazo=await p.evaluate(()=>{
    const d=S.tools.flashcards.decks.find(x=>x.name==='Cálculo Numérico');
    return {existe:!!d,activo:!!d&&S.tools.flashcards.activeDeckId===d.id,tarjetas:d?d.cards.map(c=>c.front+'|'+c.back):[],
      guardado:JSON.stringify(S).includes('ESTE_TEXTO_NO_DEBE_GUARDARSE')};
  });
  ok('crea el mazo con el nombre del ramo y agrega las tarjetas confirmadas',mazo.existe&&mazo.activo&&
    mazo.tarjetas.length===n0-1&&mazo.tarjetas.some(x=>x.includes('FRENTE EDITADO')&&x.includes('REVERSO EDITADO')),
    JSON.stringify(mazo.tarjetas.slice(0,2)));
  ok('el texto pegado no se guarda',mazo.guardado===false);

  const bk=await p.evaluate(()=>{
    const j=JSON.parse(JSON.stringify(S));delete j.courses[0].syllabusNotes;
    const error=validState(j),limpio=cleanState(j);
    const antiguo=JSON.parse(JSON.stringify(j));migrate(antiguo);
    const largo=JSON.parse(JSON.stringify(j));largo.courses[0].syllabusNotes='x'.repeat(2001);
    return {error,importado:typeof limpio.courses[0].syllabusNotes==='string'&&limpio.courses[0].syllabusNotes.length===0,
      migrado:typeof antiguo.courses[0].syllabusNotes==='string',largo:validState(largo)};
  });
  ok('respaldos antiguos sin syllabusNotes se importan bien',bk.error===null&&bk.importado&&bk.migrado,JSON.stringify(bk));
  ok('syllabusNotes valida el máximo de 2000 caracteres',bk.largo==='ramos',String(bk.largo));

  const calls=await p.evaluate(()=>({f:window.__fetchCalls||0,x:window.__xhrCalls||0}));
  ok('sin fetch, XHR ni peticiones externas',calls.f===0&&calls.x===0&&external.length===0,JSON.stringify(calls)+' ext='+external.length);
  ok('sin errores de JavaScript',errs.length===0,errs.join(' | '));

  await b.close();
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
