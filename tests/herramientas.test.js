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
    S.events.push({id:'e1',courseId:'c1',title:'Certamen',date:today(),type:'evaluacion'});
    S.tasks=[{id:'t1',eventId:'e1',courseId:'c1',title:'Repasar derivadas',date:today(),minutes:25,done:false}];
    S.lastPlan=today();save();go('inicio');
  });
  await p.locator('.home-card').filter({hasText:'Herramientas'}).click();
  ok('Herramientas es sección principal',p.url().endsWith('#/herramientas/herramientas')&&(await p.textContent('#app')).includes('Pomodoro')&&(await p.textContent('#app')).includes('Flashcards'));

  const resume=await p.evaluate(()=>{
    S.tools.pomodoro={...freshPomodoro(),running:true,endsAt:Date.now()-1000,leftMs:1500000,target:'course:c1'};
    save();pomResume();const q=S.tools.pomodoro;
    return {phase:q.phase,running:q.running,endsAt:q.endsAt,now:Date.now()};
  });
  ok('Pomodoro: termina el foco y pasa a descanso corto',resume.phase==='short'&&resume.running&&resume.endsAt>resume.now,JSON.stringify(resume));
  await p.reload();
  const afterReload=await p.evaluate(()=>{
    const q=S.tools.pomodoro,t=document.querySelector('#pom-time');
    return {phase:q.phase,running:q.running,endsAt:q.endsAt,now:Date.now(),clock:t?t.textContent:''};
  });
  ok('Pomodoro: retoma tras recargar',afterReload.phase==='short'&&afterReload.running&&afterReload.endsAt>afterReload.now&&/^\d\d:\d\d$/.test(afterReload.clock),JSON.stringify(afterReload));

  const long=await p.evaluate(()=>{
    S.tools.pomodoro={...freshPomodoro(),pomodoros:3,running:true,endsAt:Date.now()-1000,target:'task:t1'};
    save();const before=S.sessions.length;pomAdvance(Date.now());const q=S.tools.pomodoro;
    return {phase:q.phase,pomodoros:q.pomodoros,added:S.sessions.length-before,session:S.sessions[S.sessions.length-1]};
  });
  ok('Pomodoro: descanso largo después de 4 focos',long.phase==='long'&&long.pomodoros===0,JSON.stringify(long));
  ok('Pomodoro: el foco suma minutos a la micro-tarea',long.added===1&&long.session.taskId==='t1'&&long.session.minutes===25,JSON.stringify(long.session));

  const imp=await p.evaluate(()=>{
    S.tools.flashcards={decks:[{id:'d1',name:'Derivadas',courseId:'c1',cards:[]}],activeDeckId:'d1',limit:20};
    save();go('herramientas');
    const tab=parseFlashcardLine("definicion\tlimite eventual"),semi=parseFlashcardLine("regla ; (fg)' = f'g + fg'");
    document.querySelector('#fc-import').value="frente\tverso\notra pregunta ; otra respuesta";
    previewFlashcardsImport();const n=fcPreview.length;confirmFlashcardsImport();
    return {tab,semi,n,cards:S.tools.flashcards.decks[0].cards.map(c=>c.front)};
  });
  ok('Flashcards: importación con tabulación',imp.tab&&imp.tab.front==='definicion'&&imp.tab.back==='limite eventual',JSON.stringify(imp.tab));
  ok('Flashcards: importación con " ; "',imp.semi&&imp.semi.front==='regla'&&imp.semi.back==="(fg)' = f'g + fg'",JSON.stringify(imp.semi));
  ok('Flashcards: vista previa y confirmación',imp.n===2&&imp.cards.length===2,JSON.stringify(imp.cards));

  const lei=await p.evaluate(()=>{
    const t=today(),card={box:1,due:t};
    return {known:flashcardAnswer(card,true,t),failed:flashcardAnswer({box:4,due:t},false,t),
      intervals:LEITNER.slice(),dates:[1,2,3,4,5].map(box=>flashcardAnswer({box,due:t},true,t).due),
      tomorrow:addDays(t,1),expected:[2,4,8,16,16].map(n=>addDays(t,n))};
  });
  ok('Flashcards: avance de cajas Leitner',lei.known.box===2&&lei.failed.box===1,JSON.stringify(lei));
  ok('Flashcards: fechas de repaso 1/2/4/8/16 días',lei.intervals.join()==='1,2,4,8,16'&&lei.known.due===lei.expected[0]&&lei.failed.due===lei.tomorrow&&lei.dates.join()===lei.expected.join(),lei.dates.join(' '));

  const sesion=await p.evaluate(()=>{
    startFlashcards();const id=fcSession.queue[0];showFlashcardAnswer();flashcardAnswerNow(false);
    const answered=S.tools.flashcards.decks[0].cards.find(x=>x.id===id);
    return {reviewed:fcSession.reviewed,tomorrow:fcSession.tomorrow,answered,dueTomorrow:addDays(today(),1)};
  });
  ok('Flashcards: la respuesta vuelve a la caja 1 y mañana',sesion.reviewed===1&&sesion.tomorrow===1&&sesion.answered.box===1&&sesion.answered.due===sesion.dueTomorrow,JSON.stringify(sesion));

  const bk=await p.evaluate(()=>{
    const bad=JSON.parse(JSON.stringify(S));bad.tools.flashcards.decks[0].cards[0].front='x'.repeat(1001);
    const bad2=JSON.parse(JSON.stringify(S));bad2.tools.flashcards.decks[0].cards[0].box=9;
    const c=cleanState(S);
    return {err:validState(S),bad:validState(bad),bad2:validState(bad2),decks:c.tools.flashcards.decks.length,cards:c.tools.flashcards.decks[0].cards.length};
  });
  ok('Herramientas: respaldo y restauración validados',bk.err===null&&bk.bad==='herramientas'&&bk.bad2==='herramientas'&&bk.decks===1&&bk.cards===2,JSON.stringify(bk));

  await p.setViewportSize({width:390,height:800});
  await p.evaluate(()=>go('herramientas'));
  const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
  ok('Herramientas sin scroll horizontal en móvil',sw<=392,String(sw));
  ok('Herramientas visibles en móvil',await p.locator('#pomodoro').isVisible()&&await p.locator('#flashcards').isVisible());
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
