// Planificación por temas con IA simulada (solo modalidad institucional).
const {chromium}=require('playwright');

(async()=>{
  const base=process.argv[2];
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1100,height:900}});
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

  // Syllabus de ejemplo con unidades y semanas
  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Ana',career:'Ingeniería',university:''};S.account.type='personal';
    S.courses=[
      {id:'c1',name:'Termodinámica',difficulty:3,color:'#e0693a',grades:[{id:'g1',name:'Certamen 2',weight:30}],share:false,passGrade:4,roundFinal:true,
        syllabusNotes:['Contenido: Unidad 1: Conceptos básicos','Contenido: Unidad 2: Primera ley','Contenido: Unidad 3: Segunda ley',
          'Contenido: Unidad 4: Ciclos de potencia','Contenido: Unidad 5: Mezclas de gases'].join('\n')},
      {id:'c2',name:'Mecánica',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true,syllabusNotes:''}
    ];
    S.events=[
      {id:'e1',courseId:'c1',title:'Certamen 1: unidades 1 y 2',date:addDays(today(),10),type:'evaluacion'},
      {id:'e2',courseId:'c1',title:'Certamen 2',date:addDays(today(),20),type:'evaluacion'},
      {id:'e3',courseId:'c1',title:'Examen final',date:addDays(today(),30),type:'evaluacion'},
      {id:'e4',courseId:'c2',title:'Certamen 1',date:addDays(today(),12),type:'evaluacion'}
    ];
    replanAll();save();go('syllabus');
  });

  // ---- Modo Personal: nada de temas ----
  ok('Personal: sin temas ni sesiones por tema',await p.evaluate(()=>S.topics.length===0&&S.tasks.every(t=>!t.topicIds)));
  ok('Personal: sin "Temario cubierto" ni temario por evaluación',await p.locator('#topics-card').count()===0&&!(await p.locator('body').innerText()).includes('Temario cubierto'));
  await p.evaluate(()=>go('hoy'));
  ok('Personal: sin botón "Hoy no puedo"',await p.locator('[data-focus-id="skip-today"]').count()===0);
  await p.evaluate(()=>go('semana'));
  ok('Personal: sin "Plan de la semana"',await p.locator('#week-plan').count()===0);
  ok('Personal: ArvisIA no planifica',await p.evaluate(async()=>ArvisIA.buildTopicMap()===null&&(await ArvisIA.planStudy())===null&&ArvisIA.weekPlan()===null));

  // ---- Modo institucional ----
  await p.evaluate(async()=>{linkInstitution('udec','ana@udec.cl',await makeInstAuth('Clave1234'));instSessionSet();replanAll();render();go('syllabus')});
  const map=await p.evaluate(()=>{const n=id=>topicNames(S.events.find(e=>e.id===id).topicIds);return {e1:n('e1'),e2:n('e2'),e3:n('e3'),e4:n('e4'),all:S.topics.filter(t=>t.courseId==='c1').length}});
  ok('el syllabus genera los 5 temas del ramo',map.all===5,String(map.all));
  ok('Certamen 1 recibe las unidades 1 y 2',JSON.stringify(map.e1)===JSON.stringify(['Conceptos básicos','Primera ley']),JSON.stringify(map.e1));
  ok('Certamen 2 recibe el resto',map.e2.length===3&&map.e2.includes('Segunda ley')&&!map.e2.includes('Primera ley'),JSON.stringify(map.e2));
  ok('el examen incluye todos los temas',map.e3.length===5);
  ok('sin syllabus el ramo queda sin temas',map.e4.length===0);
  ok('aparece "Temario por evaluación" con etiqueta IA · demo',await p.locator('#topics-card').count()===1&&(await p.locator('#topics-card').innerText()).includes('IA · demo'));
  ok('muestra "Temario cubierto: N de M"',(await p.locator('#topics-e1').innerText()).includes('Temario cubierto: 0 de 2'));

  // Sesiones por tema
  const ses=await p.evaluate(()=>S.tasks.filter(t=>t.eventId==='e1'&&!t.done).map(t=>({d:t.date,k:t.kind,m:t.minutes,ids:t.topicIds||[],title:t.title,hint:t.hint,why:t.why})));
  ok('cada sesión tiene entre 1 y 3 temas',ses.length>0&&ses.every(s=>s.ids.length>=1&&s.ids.length<=3),JSON.stringify(ses.map(s=>s.ids.length)));
  ok('título, instrucción y por qué con el tema',ses.every(s=>s.hint&&s.why)&&ses.some(s=>/Conceptos básicos|Primera ley/.test(s.title)));
  ok('sin sesiones cortas sueltas (≥ 30 min)',ses.every(s=>s.m>=30),JSON.stringify(ses.map(s=>s.m)));
  const rep=await p.evaluate(()=>{const ts=S.events.find(e=>e.id==='e1').topicIds;return ts.map(id=>new Set(S.tasks.filter(t=>t.eventId==='e1'&&(t.topicIds||[]).includes(id)&&t.kind!=='simulacro').map(t=>t.date)).size)});
  ok('cada tema se repasa al menos 2 veces en días distintos',rep.every(n=>n>=2),JSON.stringify(rep));
  ok('hay un simulacro antes de la evaluación',ses.some(s=>s.k==='simulacro'));
  ok('la primera pasada va antes que los repasos',await p.evaluate(()=>{
    const ts=S.tasks.filter(t=>t.eventId==='e1');
    return S.events.find(e=>e.id==='e1').topicIds.every(id=>{const mine=ts.filter(t=>(t.topicIds||[]).includes(id));
      const first=mine.find(t=>t.kind==='nuevo');return !first||mine.filter(t=>t.kind==='recuperar').every(t=>t.date>first.date)})}));
  ok('las sesiones del mismo día no se superponen',await p.evaluate(()=>{
    const byDay={};S.tasks.filter(t=>t.slotStart).forEach(t=>(byDay[t.date]=byDay[t.date]||[]).push([toMin(t.slotStart),toMin(t.slotEnd)]));
    return Object.values(byDay).every(l=>l.sort((a,b)=>a[0]-b[0]).every((x,i)=>i===0||x[0]>=l[i-1][1]))}));

  // Más temas → más minutos y antes; dominio cambia el tiempo
  const carga=await p.evaluate(()=>{
    const min=id=>S.tasks.filter(t=>t.eventId===id).reduce((a,t)=>a+t.minutes,0);
    return {e1:min('e1'),e3:min('e3')};
  });
  ok('más temas → más minutos (examen > certamen 1)',carga.e3>carga.e1,JSON.stringify(carga));
  const dom=await p.evaluate(()=>{
    const min=()=>S.tasks.filter(t=>t.eventId==='e1').reduce((a,t)=>a+t.minutes,0);
    const before=min();S.topics.filter(t=>S.events.find(e=>e.id==='e1').topicIds.includes(t.id)).forEach(t=>t.mastery=2);replanAll();
    const after=min();S.topics.forEach(t=>t.mastery=0);replanAll();return {before,after};
  });
  ok('"Lo domino" recibe menos tiempo que "No lo he visto"',dom.after<dom.before,JSON.stringify(dom));
  await p.evaluate(()=>go('syllabus'));
  const tid=await p.evaluate(()=>S.events.find(e=>e.id==='e1').topicIds[0]);
  await p.locator(`[data-focus-id="tm-e1-${tid}-1"]`).click();
  ok('el selector de dominio guarda y replanifica',await p.evaluate(id=>topicById(id).mastery===1,tid)&&
    (await p.locator(`[data-focus-id="tm-e1-${tid}-1"]`).getAttribute('aria-pressed'))==='true');

  // "¿Cómo te fue?" ajusta el dominio
  const fb=await p.evaluate(()=>{
    const t=S.tasks.find(x=>x.eventId==='e1'&&(x.topicIds||[]).length&&x.kind!=='simulacro');
    const id=t.topicIds[0];topicById(id).mastery=2;
    t.done=true;setTaskFeeling(t.id,'costo');
    const afterCosto=topicById(id).mastery;
    const t2=S.tasks.find(x=>x.eventId==='e1'&&!x.done&&(x.topicIds||[]).includes(id)&&x.kind!=='simulacro');
    let afterBien=null;
    if(t2){t2.done=true;setTaskFeeling(t2.id,'bien');afterBien=topicById(id).mastery}
    return {afterCosto,afterBien,hist:topicById(id).history.length};
  });
  ok('"Me costó" baja el dominio',fb.afterCosto===1,JSON.stringify(fb));
  ok('"Bien" lo sube y queda historial',fb.afterBien===2&&fb.hist>=2,JSON.stringify(fb));

  // Sin syllabus: escribir temas genera el plan
  await p.evaluate(()=>go('syllabus'));
  ok('sin temas aparece el aviso para escribirlos',(await p.locator('#topics-e4').innerText()).includes('Para planificar por temas, sube el syllabus o escribe los temas'));
  await p.locator('#te-e4').fill('Cinemática\nDinámica\nTrabajo y energía');
  await p.locator('[data-focus-id="te-save-e4"]').click();
  const e4=await p.evaluate(()=>({n:topicNames(S.events.find(e=>e.id==='e4').topicIds),ses:S.tasks.filter(t=>t.eventId==='e4'&&(t.topicIds||[]).length).length,manual:S.events.find(e=>e.id==='e4').topicsManual}));
  ok('escribir los temas genera el plan por temas',e4.n.length===3&&e4.ses>0&&e4.manual===true,JSON.stringify(e4));

  // Plan de la semana
  await p.evaluate(()=>go('semana'));
  const wk=await p.locator('#week-plan').count()?await p.locator('#week-plan').innerText():'';
  ok('"Plan de la semana" con metas por ramo',wk.includes('Plan de la semana')&&/Termodinámica: (ver|repasar)/.test(wk),wk.slice(0,160));
  ok('sin tarjeta duplicada de resumen semanal',await p.locator('#weekly-card').count()===1);

  // Hoy no puedo
  await p.evaluate(()=>{const t0=today();if(!S.tasks.some(t=>t.date===t0&&!t.done)){S.tasks.push({id:'hoy1',eventId:'e2',courseId:'c1',title:'Extra',date:t0,minutes:45,done:false,kind:'ejercicios'})}save();go('hoy')});
  const antes=await p.evaluate(()=>({hoy:S.tasks.filter(t=>t.date===today()&&!t.done).length,total:S.tasks.filter(t=>!t.done).length}));
  await p.locator('[data-focus-id="skip-today"]').click();
  await p.waitForTimeout(150);
  const confirmBtn=p.locator('.confirm-modal button, #confirm button, [role="dialog"] button').filter({hasText:'Reacomodar'});
  if(await confirmBtn.count())await confirmBtn.first().click();
  await p.waitForTimeout(200);
  const despues=await p.evaluate(()=>({hoy:S.tasks.filter(t=>t.date===today()&&!t.done).length,skip:S.skipDay}));
  ok('"Hoy no puedo" vacía el día sin perder sesiones',antes.hoy>0&&despues.hoy===0&&despues.skip===await p.evaluate(()=>today()),JSON.stringify({antes,despues}));
  const undo=p.locator('#toast button, .toast button').filter({hasText:/Deshacer/i});
  if(await undo.count())await undo.first().click();
  await p.waitForTimeout(150);
  ok('"Hoy no puedo" se puede deshacer',await p.evaluate(()=>S.skipDay!==today()&&S.tasks.some(t=>t.date===today()&&!t.done)));

  // Chat
  const chat=await p.evaluate(async()=>({
    temas:await ArvisIA.chat('¿qué temas entran en el certamen 2 de termo?',[]),
    falta:await ArvisIA.chat('¿cuánto me falta del temario de termo?',[]),
    domino:await ArvisIA.chat('ya domino segunda ley',[]),
    semana:await ArvisIA.chat('replanifica mi semana',[])
  }));
  ok('chat: temas del certamen 2',chat.temas.texto.includes('Certamen 2')&&chat.temas.lista.some(x=>x.includes('Segunda ley')),chat.temas.texto);
  ok('chat: cuánto falta del temario',/llevas \d+ de \d+ temas/.test(chat.falta.texto),chat.falta.texto);
  ok('chat: "ya domino" sube el dominio',chat.domino.texto.includes('Lo domino')&&await p.evaluate(()=>S.topics.find(t=>t.name==='Segunda ley').mastery===2));
  ok('chat: replanificar la semana propone y espera confirmación',chat.semana.propuesta&&chat.semana.propuesta.kind==='replan');
  ok('chat: crisis sigue teniendo prioridad',(await p.evaluate(async()=>(await ArvisIA.chat('no quiero vivir, qué temas entran',[])).lista.join(' '))).includes('*4141'));

  // Respaldo
  const bk=await p.evaluate(()=>{
    const j=JSON.parse(JSON.stringify(S));
    const okNew=validState(j)===null&&cleanState(j).topics.length===S.topics.length&&cleanState(j).events.some(e=>Array.isArray(e.topicIds));
    const viejo=JSON.parse(JSON.stringify(S));delete viejo.topics;viejo.events.forEach(e=>{delete e.topicIds;delete e.topicsManual});viejo.tasks.forEach(t=>{delete t.topicIds;delete t.topicFb});
    const okOld=validState(viejo)===null&&Array.isArray(cleanState(viejo).topics);
    const malo=JSON.parse(JSON.stringify(S));malo.topics[0].mastery=7;
    const malo2=JSON.parse(JSON.stringify(S));malo2.topics[0].name='<img src=x onerror=alert(1)>'.repeat(30);
    const malo3=JSON.parse(JSON.stringify(S));malo3.tasks.find(t=>t.topicIds).topicIds=['a','b','c','d'];
    return {okNew,okOld,malo:validState(malo),malo2:validState(malo2),malo3:validState(malo3)};
  });
  ok('respaldo con temas se valida y conserva',bk.okNew);
  ok('respaldo antiguo sin temas se importa',bk.okOld);
  ok('temas inválidos se rechazan',bk.malo==='temas'&&bk.malo2==='temas'&&bk.malo3==='tareas',JSON.stringify(bk));

  // Volver a Personal
  await p.evaluate(()=>{S.account=accountBlank();S.account.type='personal';replanAll();render()});
  ok('al volver a Personal los temas se conservan pero no se usan',await p.evaluate(()=>S.topics.length>0&&S.tasks.filter(t=>!t.done).every(t=>!t.topicIds)));

  ok('sin fetch, XHR ni peticiones externas',await p.evaluate(()=>!(window.__fetchCalls||0)&&!(window.__xhrCalls||0))&&external.length===0,external.join(', '));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r=>r.startsWith('FALLA'))?1:0);
})();
