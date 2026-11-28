const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const file=process.argv[2]||path.join(__dirname,'..','index.html');
  const fx=n=>path.join(__dirname,'fixtures',n);
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1100,height:900}});
  const res=[],errs=[];
  const ok=(name,cond,extra='')=>res.push((cond?'OK   ':'FALLA')+' '+name+(extra?'  → '+extra:''));
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  try{
    await p.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
    await p.goto('file://'+path.resolve(file));
    await p.evaluate(()=>{
      S=fresh();S.profile={name:'Trivia',career:'Biología',university:'',nickname:''};S.account.type='personal';
      S.courses=[{id:'c1',name:'Biología celular',difficulty:3,color:'#2e9e6a',grades:[],share:false,passGrade:4,roundFinal:true}];
      save();go('pregunta');
    });
    await p.waitForTimeout(200);
    ok('Herramientas tiene la pestaña Arvis pregunta',await p.locator('nav >> text="Arvis pregunta"').count()>0);
    ok('la ruta es #/herramientas/pregunta',p.url().endsWith('#/herramientas/pregunta'),p.url());
    ok('sin trivias muestra el estado vacío',(await p.textContent('#app')).includes('Aún no tienes trivias'));

    // Crear sin archivo
    await p.click('[data-focus-id="qz-create"]');
    ok('pide elegir un archivo',await p.evaluate(()=>qzCfg().sets.length===0));

    // .ppt antiguo
    await p.setInputFiles('#qz-file',fx('texto.ppt'));
    await p.click('[data-focus-id="qz-create"]');
    await p.waitForSelector('.qz-feedback.bad');
    ok('rechaza el formato .ppt antiguo con instrucciones',(await p.textContent('.qz-feedback.bad')).includes('guárdalo como .pptx o PDF'));

    // PPTX → trivia
    await p.setInputFiles('#qz-file',fx('biologia-celular.pptx'));
    await p.selectOption('#qz-course','c1');
    await p.selectOption('#qz-count','10');
    await p.click('[data-focus-id="qz-create"]');
    await p.waitForSelector('.qz-q',{timeout:10000});
    const set=await p.evaluate(()=>qzCfg().sets[0]);
    ok('crea una trivia de 10 preguntas desde el PPTX',set&&set.questions.length===10&&set.tipo==='pptx',set&&set.questions.length);
    ok('la trivia queda asociada al ramo',set.courseId==='c1');
    ok('todas las preguntas son válidas',await p.evaluate(()=>qzCfg().sets[0].questions.every(validQuizQuestion)));
    ok('mezcla distintos tipos de pregunta',new Set(set.questions.map(q=>q.kind)).size>=4,[...new Set(set.questions.map(q=>q.kind))].join(','));
    ok('las respuestas correctas salen del contenido',set.questions.some(q=>q.opts[q.ok].includes('síntesis de proteínas')||q.opts[q.ok]==='Ribosoma'||q.opts[q.ok]==='Ribosomas'));
    ok('guarda solo preguntas, no las diapositivas',await p.evaluate(()=>Object.keys(qzCfg().sets[0]).join(',')==='id,name,courseId,tipo,createdAt,best,plays,questions'));
    ok('el juego muestra el temporizador',await p.locator('#qz-bar').count()===1);

    // Responder: una correcta, una incorrecta, una por tiempo
    const correct=await p.evaluate(()=>qzCurrent().ok);
    await p.click(`[data-focus-id="qz-opt-${correct}"]`);
    ok('respuesta correcta suma puntos',await p.evaluate(()=>qzGame.score>=100&&qzGame.answers[0].ok));
    ok('marca la opción correcta',await p.locator('.qz-opt.qz-ok').count()===1);
    await p.click('#qz-next');
    const wrong=await p.evaluate(()=>(qzCurrent().ok+1)%qzCurrent().opts.length);
    await p.click(`[data-focus-id="qz-opt-${wrong}"]`);
    ok('respuesta incorrecta muestra la correcta',(await p.textContent('.qz-feedback')).includes('La respuesta era'));
    ok('la racha se reinicia al fallar',await p.evaluate(()=>qzGame.streak===0));
    await p.click('#qz-next');
    await p.evaluate(()=>{qzGame.deadline=Date.now()-10});
    await p.waitForSelector('.qz-feedback',{timeout:3000});
    ok('se acaba el tiempo y cuenta como error',(await p.textContent('.qz-feedback')).includes('Se acabó el tiempo')&&await p.evaluate(()=>qzGame.answers[2].timeout));

    // Terminar el resto
    for(let i=3;i<10;i++){
      await p.click('#qz-next');
      const c=await p.evaluate(()=>qzCurrent().ok);
      await p.click(`[data-focus-id="qz-opt-${c}"]`);
    }
    await p.click('#qz-next');
    await p.waitForSelector('.qz-final');
    ok('muestra el resultado final',(await p.textContent('.qz-final')).includes('8 de 10 correctas'),await p.textContent('.qz-final'));
    ok('lista las preguntas para repasar',await p.locator('.qz-wrong li').count()===2);
    const saved=await p.evaluate(()=>qzCfg().sets[0]);
    ok('guarda récord y partidas',saved.plays===1&&saved.best>0);

    // Falladas → flashcards
    await p.click('[data-focus-id="qz-to-fc"]');
    const deck=await p.evaluate(()=>fcCfg().decks.find(d=>d.name.startsWith('Arvis pregunta')));
    ok('pasa las falladas a un mazo de flashcards',deck&&deck.cards.length===2&&deck.courseId==='c1',deck&&deck.cards.length);
    await p.click('[data-focus-id="qz-to-fc"]');
    ok('no duplica tarjetas al repetir',await p.evaluate(()=>fcCfg().decks.find(d=>d.name.startsWith('Arvis pregunta')).cards.length===2));

    // Volver y jugar de nuevo
    await p.click('[data-focus-id="qz-again"]');
    ok('jugar de nuevo reinicia la partida',await p.evaluate(()=>qzGame.i===0&&qzGame.score===0&&qzGame.phase==='play'));
    await p.evaluate(()=>quitQuiz());

    // PDF
    await p.setInputFiles('#qz-file',fx('biologia-celular.pdf'));
    await p.selectOption('#qz-count','5');
    await p.click('[data-focus-id="qz-create"]');
    await p.waitForSelector('.qz-q',{timeout:15000});
    const pdf=await p.evaluate(()=>qzCfg().sets[0]);
    ok('crea una trivia desde el PDF',pdf.tipo==='pdf'&&pdf.questions.length===5);
    await p.evaluate(()=>quitQuiz());
    ok('la lista muestra ambas trivias',await p.locator('.task').count()===2);

    // Poco texto
    const poco=await p.evaluate(()=>quizFromSlides([{n:1,title:'Hola',lines:['Gracias']}],10).preguntas.length);
    ok('con poco texto no inventa preguntas',poco===0);

    // Respaldos
    const v=await p.evaluate(()=>{
      const t=JSON.parse(JSON.stringify(S.tools));
      const bad1=JSON.parse(JSON.stringify(t));bad1.quiz.sets[0].questions[0].ok=9;
      const bad2=JSON.parse(JSON.stringify(t));bad2.quiz.sets[0].tipo='docx';
      const sinQuiz=JSON.parse(JSON.stringify(t));delete sinQuiz.quiz;
      return {good:validTools(t),bad1:validTools(bad1),bad2:validTools(bad2),sinQuiz:validTools(sinQuiz),
        clean:cleanQuiz(bad1.quiz).sets[0].questions.length,esperado:t.quiz.sets[0].questions.length-1,old:JSON.stringify(cleanTools({pomodoro:{},flashcards:{}}).quiz)};
    });
    ok('el respaldo con trivias es válido',v.good);
    ok('rechaza respuestas fuera de rango',!v.bad1);
    ok('rechaza tipos de archivo desconocidos',!v.bad2);
    ok('respaldos antiguos sin trivias siguen siendo válidos',v.sinQuiz&&v.old==='{"sets":[]}');
    ok('la limpieza descarta solo la pregunta inválida',v.clean===v.esperado,v.clean+' vs '+v.esperado);

    // Borrar
    p.once('dialog',d=>d.accept());
    await p.locator('.task').first().locator('button.del').click();
    const confirm=p.locator('.modal button, [role="dialog"] button').filter({hasText:'Borrar'});
    if(await confirm.count())await confirm.first().click();
    await p.waitForTimeout(200);
    ok('borrar elimina la trivia',await p.evaluate(()=>qzCfg().sets.length===1));

    // Móvil
    await p.setViewportSize({width:390,height:844});
    await p.evaluate(()=>startQuiz(qzCfg().sets[0].id));await p.waitForTimeout(150);
    ok('móvil sin scroll horizontal durante el juego',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await p.evaluate(()=>quitQuiz());
  }catch(e){res.push('ERROR DEL TEST '+e.message.split('\n')[0])}
  ok('sin errores de consola',errs.length===0,errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r=>!r.startsWith('OK'))?1:0);
})();
