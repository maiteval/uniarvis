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
    await p.fill('#reg-name','Evidencia');await p.fill('#reg-career','Carrera');
    await p.locator('.hud-btn').click();
  }

  const setup=await p.evaluate(()=>{
    S=fresh();S.profile={name:'Evidencia',career:'Carrera'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true},
      {id:'c2',name:'Física',difficulty:3,color:'#e0693a',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen de Cálculo',date:addDays(today(),10),type:'evaluacion'}];
    S.tools.flashcards.decks.push({id:'d1',name:'Fórmulas',courseId:'c1',cards:[]});
    S.settings.chronotype='manana';S.consent={health:true,at:today()};
    S.wellbeing.diary=[];S.tasks=[];S.sessions=[];inval();replanAll();go('hoy');
    const ts=S.tasks.filter(t=>t.eventId==='ev1');
    const rec=ts.filter(t=>t.kind==='recuperar').map(t=>t.date).sort();
    const eve=addDays(today(),9);
    return {n:ts.length,kinds:[...new Set(ts.map(t=>t.kind))].sort(),first:ts[0],
      rec,recGaps:rec.slice(1).map((d,i)=>diffDays(rec[i],d)),
      eve:ts.filter(t=>t.date===eve),titles:ts.map(t=>t.title),
      interleave:ts.some(t=>needsInterleave(t))};
  });
  ok('EVIDENCE define fuentes y estimaciones',await p.evaluate(()=>!!EVIDENCE.sources.sleepDebt&&EVIDENCE.capacity.energy.length===5&&EVIDENCE.capacity.dayMinutes===840));
  ok('hay micro-tareas con kind',setup.n>5&&setup.kinds.includes('nuevo')&&setup.kinds.includes('recuperar'),JSON.stringify(setup.kinds));
  ok('la primera sesión usa recuperación activa',setup.first&&setup.first.kind==='nuevo'&&setup.first.title==='Recordar sin mirar: escribe lo que sabes y luego revisa',JSON.stringify(setup.first));
  ok('hay al menos dos recuperaciones en días distintos',setup.rec.length>=2&&new Set(setup.rec).size===setup.rec.length,JSON.stringify(setup.rec));
  ok('las recuperaciones se separan de forma creciente',setup.recGaps.length>=1&&setup.recGaps[0]>=1&&(!setup.recGaps[1]||setup.recGaps[1]>=setup.recGaps[0]),JSON.stringify(setup.recGaps));
  ok('la víspera es solo repaso ligero y hasta 45 min',setup.eve.length>0&&setup.eve.every(t=>t.kind==='repaso_ligero')&&setup.eve.reduce((a,t)=>a+t.minutes,0)<=45,JSON.stringify(setup.eve));
  ok('no quedó el texto de releer/subrayar',setup.titles.every(x=>!/Repasar apuntes|subrayar/i.test(x)),JSON.stringify(setup.titles.slice(0,3)));
  const hintText=await p.textContent('#app');
  ok('intercalar no se impone como obligación',!/obligator|debes mezclar/i.test(hintText));
  const interleave=await p.evaluate(()=>{
    const t=S.tasks.find(x=>x.eventId==='ev1'&&x.kind==='ejercicios');
    if(!t)return {ok:false};
    S.tasks.filter(x=>x.courseId==='c1'&&x.date<t.date).forEach(x=>x.done=true);
    const extra={id:'done-c2',courseId:'c2',date:addDays(t.date,-1),minutes:25,done:true,title:'Otro ramo'};
    S.tasks.push(extra);const withBoth=needsInterleave(t);
    S.tasks=S.tasks.filter(x=>x.id!==extra.id);
    return {ok:withBoth&&!needsInterleave(t)};
  });
  ok('la pista de intercalar exige temas distintos ya trabajados',interleave.ok,JSON.stringify(interleave));
  const chrono=await p.evaluate(()=>({good:S.tasks.some(t=>t.chrono==='Mejor en tu franja: mañana'),flex:S.tasks.some(t=>t.chrono==='cuando puedas')}));
  ok('el cronotipo etiqueta sin horas exactas',chrono.good&&chrono.flex,JSON.stringify(chrono));
  await p.evaluate(()=>{const r=S.tasks.find(t=>t.eventId==='ev1'&&t.kind==='recuperar');if(r){r.date=today();save();go('hoy')}});
  ok('los botones de flashcards aparecen en recuperaciones',await p.locator('button:has-text("Repasar flashcards de este ramo")').count()>=1,String(await p.locator('button:has-text("Repasar flashcards de este ramo")').count()));

  const debt=await p.evaluate(()=>{
    S.wellbeing.diary=[{date:today(),energy:5,mood:5,sleep:5,tags:[],note:'',ts:1}];
    inval();const clean=capInfo(today());
    for(let i=1;i<=5;i++)S.wellbeing.diary.push({date:addDays(today(),-i),energy:5,mood:5,sleep:1,tags:[],note:'',ts:1});
    inval();const tired=capInfo(today());
    return {clean:clean.f,tired:tired.f,hours:tired.debt.hours,penalty:tired.debt.factor,explain:capExplain(tired).join(' ')};
  });
  ok('deuda de sueño usa los 5 check-ins previos y no excedentes',debt.hours===15&&Math.abs(debt.penalty-0.75)<0.001,JSON.stringify(debt));
  ok('energía alta no cancela la deuda',debt.tired<debt.clean&&debt.explain.includes('No se compensa con energía alta'),JSON.stringify(debt));

  const cal=await p.evaluate(()=>{
    S.wellbeing.diary=[];S.tasks=[];S.sessions=[];
    for(let i=1;i<=14;i++){
      const d=addDays(today(),-i);
      S.wellbeing.diary.push({date:d,energy:4,mood:5,sleep:5,tags:[],note:'',ts:1});
      S.tasks.push({id:'plan-'+i,eventId:'ev0',courseId:'c1',title:'Plan',date:d,minutes:100,done:true});
      S.sessions.push({id:'ses-'+i,date:d,courseId:'c1',minutes:60,taskId:'plan-'+i});
    }
    inval();const info=capInfo(today());
    return {days:info.cal.days,factor:info.cal.factor,explain:capExplain(info).join(' ')};
  });
  ok('calibración personal se activa con 14 días',cal.days===14&&cal.factor<1&&cal.factor>0.35,JSON.stringify(cal));
  ok('el desglose explica la calibración',cal.explain.includes('Calibración con tus últimos 14 días'),cal.explain);

  await p.evaluate(()=>{S.wellbeing.diary=[];S.tasks=[];S.sessions=[];inval();replanAll();go('bienestar')});
  ok('la sección ¿En qué se basa? explica fuentes y estimaciones',(await p.textContent('#app')).includes('¿En qué se basa?')&&(await p.textContent('#app')).includes('Van Dongen')&&(await p.textContent('#app')).includes('Estimaciones de diseño'));
  await p.evaluate(()=>go('respiracion'));
  ok('el suspiro cíclico es la respiración por defecto',(await p.textContent('#app')).includes('Suspiro cíclico')&&!(await p.locator('button:has-text("4-7-8")').isVisible()));

  const pom=await p.evaluate(()=>{
    const t={id:'pom-evidencia',courseId:'c1',date:today(),minutes:25,kind:'simulacro',title:'Simulacro',done:false};
    S.tasks.push(t);
    const q=pomCfg();q.phase='focus';q.running=false;q.pomodoros=0;q.kindStreak='';q.kindCount=0;
    q.target='task:'+t.id;pomFinishPhase(q,Date.now());q.phase='focus';pomFinishPhase(q,Date.now());
    q.running=false;save();go('herramientas');
    return {streak:q.kindStreak,count:q.kindCount,suggest:pomSuggestLongBreak(q),text:document.querySelector('#app').textContent};
  });
  ok('dos focos seguidos de tipo exigente sugieren pausa larga',pom.count===2&&pom.suggest&&pom.text.includes('más de 10 min'),JSON.stringify({streak:pom.streak,count:pom.count,suggest:pom.suggest}));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));

  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
