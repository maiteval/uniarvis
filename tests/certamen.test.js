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
    S=fresh();S.profile={name:'Ana',career:'Medicina'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true},
      {id:'c2',name:'Física',difficulty:4,color:'#e0693a',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen de Cálculo',date:addDays(today(),7),type:'evaluacion'}];
    S.certamen={plans:[],topicsByCourse:{c1:['Derivadas','Integrales']}};
    S.tasks=[];S.sessions=[];S.consent=null;S.lastPlan=today();save();go('hoy');
  });
  const t0=await p.evaluate(()=>today());

  ok('Oferta visible en Plan del día',await p.locator('#certamen-offers').isVisible()&&(await p.textContent('#certamen-offers')).includes('Certamen de Cálculo'));
  await p.evaluate(()=>go('syllabus'));
  ok('Oferta visible en Syllabus',await p.locator('#certamen-offers').isVisible()&&(await p.textContent('#certamen-offers')).includes('Certamen de Cálculo'));
  ok('No se activa automáticamente',await p.evaluate(()=>S.certamen.plans.length===0&&S.tasks.every(t=>!t.certamen)));

  await p.click('[data-focus-id="cert-open-ev1"]');
  const topicInputs=p.locator('#certamen-draft input[aria-label="Tema que entra en la evaluación"]');
  ok('Sugiere temas del syllabus',await topicInputs.count()===2&&(await topicInputs.nth(0).inputValue())==='Derivadas',JSON.stringify(await topicInputs.evaluateAll(els=>els.map(e=>e.value))));
  await topicInputs.nth(0).fill('Derivadas');
  await p.locator('#certamen-draft input[type="checkbox"]').first().check();
  await p.locator('#cert-mock').fill('120');
  await p.locator('#cert-mock').dispatchEvent('change');
  await p.click('[data-focus-id="cert-activate"]');

  const activated=await p.evaluate(()=>{
    const plan=S.certamen.plans[0],ts=S.tasks.filter(t=>t.eventId==='ev1'),ct=ts.filter(t=>t.certamen);
    return {plans:S.certamen.plans.length,hard:plan.topics.filter(t=>t.hard).length,mock:plan.mockMin,
      normal:ts.filter(t=>!t.certamen).length,count:ct.length,
      phases:[...new Set(ct.map(t=>t.phase))].sort(),mockMin:(ct.find(t=>t.phase==='ensayo')||{}).minutes,
      theory:ct.filter(t=>t.phase==='teoria').map(t=>t.date),
      exercise:ct.filter(t=>t.phase==='ejercicios').map(t=>t.date),
      review:ct.filter(t=>t.phase==='repaso').map(t=>t.date)};
  });
  ok('Activación crea un plan editable',activated.plans===1&&activated.hard===1&&activated.mock===120,JSON.stringify(activated));
  ok('Reemplaza micro-tareas del evento',activated.normal===0&&activated.count>0,JSON.stringify(activated));
  ok('Cubre las cinco fases',activated.phases.join()==='ejercicios,ensayo,errores,repaso,teoria',activated.phases.join());
  ok('Ensayo usa la duración configurable',activated.mockMin===120,String(activated.mockMin));
  ok('Fases de 7 días en fechas correctas',activated.theory.includes(t0)&&activated.theory.length===2&&activated.exercise.length===2&&activated.review.length===2,JSON.stringify(activated));

  const loads=await p.evaluate(()=>{
    const m={};S.tasks.filter(t=>t.certamen&&!t.done).forEach(t=>m[t.date]=(m[t.date]||0)+t.minutes);
    return Object.keys(m).map(d=>({d,load:m[d],cap:planCap(d)}));
  });
  ok('Respeta la capacidad diaria',loads.every(x=>x.load<=x.cap),JSON.stringify(loads));

  await p.evaluate(()=>go('hoy'));
  ok('Progreso por tema con casillas',await p.locator('#certamen-plan-ev1 input[type="checkbox"]').count()>=6,String(await p.locator('#certamen-plan-ev1 input[type="checkbox"]').count()));
  const progress=await p.evaluate(()=>{
    const t=S.tasks.find(x=>x.certamen&&x.phase==='teoria'),id=t.id;
    toggleTask(id);replanAll();
    const same=S.tasks.find(x=>x.id===id);
    return {done:!!(same&&same.done),pending:S.tasks.filter(x=>x.certamen&&x.eventId==='ev1'&&x.phase==='teoria'&&!x.done).length,
      sessions:S.sessions.filter(x=>x.taskId===id).length};
  });
  ok('El avance se conserva al reprogramar',progress.done&&progress.pending===1&&progress.sessions===1,JSON.stringify(progress));

  await p.evaluate(()=>{
    const done=S.tasks.find(x=>x.certamen&&x.done);if(done)toggleTask(done.id);
    const ev=S.events.find(e=>e.id==='ev1'),d=addDays(today(),3);
    ev.date=d;S.certamen.plans[0].date=d;
    S.tasks=S.tasks.filter(t=>!t.certamen||t.done);replanAll();go('hoy');
  });
  const compressed=await p.evaluate(()=>{
    const ts=S.tasks.filter(t=>t.certamen&&!t.done&&t.eventId==='ev1'),dates=[...new Set(ts.map(t=>t.date))].sort();
    return {dates,past:ts.filter(t=>t.date<today()).length,
      theory:ts.filter(t=>t.phase==='teoria').map(t=>t.date),
      exercise:ts.filter(t=>t.phase==='ejercicios').map(t=>t.date),
      mock:(ts.find(t=>t.phase==='ensayo')||{}).date,
      review:ts.filter(t=>t.phase==='repaso').map(t=>t.date)};
  });
  const exp=await p.evaluate(()=>({t0:today(),d1:addDays(today(),1),d2:addDays(today(),2),d3:addDays(today(),3)}));
  ok('Compresión a 3 días sin fechas pasadas',compressed.past===0&&compressed.dates.length<=3&&compressed.dates.every(d=>d>=exp.t0&&d<=exp.d3),JSON.stringify(compressed));
  ok('Ensayo y repaso sobreviven a la compresión',compressed.mock===exp.d1&&compressed.review.length>0&&compressed.review.every(d=>d===exp.d2),JSON.stringify(compressed));

  await p.evaluate(()=>{
    S.consent={health:true,at:today()};
    S.wellbeing.diary=[{date:today(),mood:2,energy:1,sleep:2,tags:[],note:'',ts:1}];
    inval();replanAll();go('hoy');
  });
  const low=await p.evaluate(()=>{
    const plan=S.certamen.plans[0],ts=S.tasks.filter(t=>t.certamen&&!t.done&&t.date===today());
    return {cap:planCap(today()),load:ts.reduce((a,t)=>a+t.minutes,0),
      topics:ts.map(t=>({name:plan.topics.find(x=>x.id===t.topicId).name,hard:plan.topics.find(x=>x.id===t.topicId).hard,phase:t.phase})),
      left:plan.leftOut.map(x=>x.label)};
  });
  ok('Día con energía baja: solo el mínimo viable',low.load>0&&low.load<=low.cap,JSON.stringify(low));
  ok('Día con energía baja: prioriza el tema difícil',low.topics.length===1&&low.topics[0].hard===true&&low.topics[0].phase==='teoria',JSON.stringify(low.topics));
  ok('Aviso sin culpa por lo que quedó fuera',low.left.some(x=>x.includes('Integrales'))&&(await p.textContent('#app')).includes('Quedó fuera'),JSON.stringify(low.left));

  await p.evaluate(()=>{
    const ev=S.events.find(e=>e.id==='ev1'),d=addDays(today(),2);
    ev.date=d;S.certamen.plans[0].date=d;
    S.tasks=S.tasks.filter(t=>!t.certamen||t.done);replanAll();
  });
  const prio=await p.evaluate(()=>{
    const plan=S.certamen.plans[0],mock=S.tasks.find(t=>t.certamen&&t.phase==='ensayo'&&!t.done);
    return {minutes:mock&&mock.minutes,date:mock&&mock.date,wanted:plan.mockMin,today:today(),left:plan.leftOut.map(x=>x.label)};
  });
  ok('Baja energía: se conserva el ensayo completo reubicándolo',prio.minutes===prio.wanted&&prio.date>prio.today,JSON.stringify(prio));

  await p.evaluate(()=>{
    S.consent=null;S.wellbeing.diary=[];
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen A',date:addDays(today(),3),type:'evaluacion'},
      {id:'ev2',courseId:'c2',title:'Control B',date:addDays(today(),4),type:'control'}];
    S.certamen={plans:[],topicsByCourse:{c1:['Tema A'],c2:['Tema B']}};
    S.tasks=[];S.sessions=[];inval();replanAll();
    openCertamen('ev1');activateCertamen();openCertamen('ev2');activateCertamen();go('hoy');
  });
  const two=await p.evaluate(()=>{
    const byEvent={};
    S.certamen.plans.forEach(pl=>byEvent[pl.eventId]=S.tasks.filter(t=>t.certamen&&t.eventId===pl.eventId&&!t.done).reduce((a,t)=>a+t.minutes,0));
    const dates=[...new Set(S.tasks.filter(t=>t.certamen&&!t.done).map(t=>t.date))].sort();
    return {n:S.certamen.plans.length,byEvent,dates,
      daily:dates.map(d=>({d,load:S.tasks.filter(t=>t.certamen&&t.date===d).reduce((a,t)=>a+t.minutes,0),cap:planCap(d)}))};
  });
  ok('Dos evaluaciones: ambos planes activos',two.n===2&&two.byEvent.ev1>0&&two.byEvent.ev2>0,JSON.stringify(two.byEvent));
  ok('Dos evaluaciones: capacidad repartida por cercanía y dificultad',two.byEvent.ev1<two.byEvent.ev2,JSON.stringify(two.byEvent));
  ok('Dos evaluaciones: nunca se excede la capacidad',two.daily.every(x=>x.load<=x.cap),JSON.stringify(two.daily));

  const bk=await p.evaluate(()=>{
    const c=cleanState(S),bad=JSON.parse(JSON.stringify(S)),old=JSON.parse(JSON.stringify(S));
    bad.certamen.plans[0].mockMin=5;delete old.certamen;
    return {err:validState(S),bad:validState(bad),old:validState(old),plans:c.certamen.plans.length,
      topics:Object.keys(c.certamen.topicsByCourse).length,oldPlans:cleanState(old).certamen.plans.length};
  });
  ok('Modo certamen: respaldo y restauración validados',bk.err===null&&bk.bad==='modo certamen'&&bk.old===null&&bk.plans===2&&bk.topics===2&&bk.oldPlans===0,JSON.stringify(bk));

  const exit=await p.evaluate(()=>{
    exitCertamen('ev1');
    return {plans:S.certamen.plans.length,cert:S.tasks.filter(t=>t.certamen&&t.eventId==='ev1').length,
      normal:S.tasks.filter(t=>!t.certamen&&t.eventId==='ev1').length};
  });
  ok('Salir vuelve a micro-tareas',exit.plans===1&&exit.cert===0&&exit.normal>0,JSON.stringify(exit));

  await p.setViewportSize({width:390,height:800});
  await p.evaluate(()=>go('hoy'));
  const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
  ok('Modo certamen sin scroll horizontal en móvil',sw<=392,String(sw));
  ok('Controles visibles en móvil',await p.locator('[data-focus-id^="cert-exit-"]').first().isVisible());
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
