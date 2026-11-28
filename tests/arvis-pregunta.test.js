const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const file=process.argv[2]||path.join(__dirname,'..','index.html');
  const fx=n=>path.join(__dirname,'fixtures',n);
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1100,height:900},reducedMotion:'reduce'});
  const spin=async()=>{await p.click('#qz-spin');await p.waitForSelector('.qz-q',{timeout:5000})};
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
    await p.waitForSelector('#qz-spin',{timeout:10000});
    ok('empieza con la ruleta y Arvis',await p.locator('.qz-wheel').count()===1&&await p.locator('.qz-stage .arvis-figura').count()===1);
    await spin();
    ok('la ruleta cae en la categoría de la pregunta',await p.evaluate(()=>{const idx=QZ_ORDER.indexOf(qzCurrent().kind);return ((qzGame.rot+idx*72+36)%360+360)%360===0}));
    ok('el color de la pantalla corresponde a la categoría',await p.evaluate(()=>document.querySelector('.qz-stage').style.getPropertyValue('--cat')===QZ_CATS[qzCurrent().kind].color));
    const set=await p.evaluate(()=>qzCfg().sets[0]);
    ok('crea una trivia de 10 preguntas desde el PPTX',set&&set.questions.length===10&&set.tipo==='pptx',set&&set.questions.length);
    ok('la trivia queda asociada al ramo',set.courseId==='c1');
    ok('todas las preguntas son válidas',await p.evaluate(()=>qzCfg().sets[0].questions.every(validQuizQuestion)));
    ok('mezcla distintos tipos de pregunta',new Set(set.questions.map(q=>q.kind)).size>=4,[...new Set(set.questions.map(q=>q.kind))].join(','));
    ok('las respuestas correctas salen del contenido',set.questions.some(q=>q.opts[q.ok].includes('síntesis de proteínas')||q.opts[q.ok]==='Ribosoma'||q.opts[q.ok]==='Ribosomas'));
    ok('guarda solo preguntas, no las diapositivas',await p.evaluate(()=>Object.keys(qzCfg().sets[0]).join(',')==='id,name,courseId,tipo,createdAt,best,plays,questions'));
    ok('el juego muestra el temporizador',await p.locator('#qz-ring').count()===1);

    // Responder: una correcta, una incorrecta, una por tiempo
    const correct=await p.evaluate(()=>qzCurrent().ok);
    await p.click(`[data-focus-id="qz-opt-${correct}"]`);
    ok('respuesta correcta suma puntos',await p.evaluate(()=>qzGame.score>=100&&qzGame.answers[0].ok));
    ok('marca la opción correcta',await p.locator('.qz-opt.qz-ok').count()===1);
    ok('Arvis celebra el acierto',await p.locator('.qz-arvis-row .arvis-figura').count()===1&&(await p.textContent('.qz-bubble')).includes('+'));
    await p.click('#qz-next');await spin();
    const wrong=await p.evaluate(()=>(qzCurrent().ok+1)%qzCurrent().opts.length);
    await p.click(`[data-focus-id="qz-opt-${wrong}"]`);
    ok('respuesta incorrecta muestra la correcta',(await p.textContent('.qz-feedback')).includes('La respuesta era'));
    ok('la racha se reinicia al fallar',await p.evaluate(()=>qzGame.streak===0));
    await p.click('#qz-next');await spin();
    await p.evaluate(()=>{qzGame.deadline=Date.now()-10});
    await p.waitForSelector('.qz-feedback',{timeout:3000});
    ok('se acaba el tiempo y cuenta como error',(await p.textContent('.qz-feedback')).includes('Se acabó el tiempo')&&await p.evaluate(()=>qzGame.answers[2].timeout));

    // Terminar el resto
    for(let i=3;i<10;i++){
      await p.click('#qz-next');await spin();
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
    ok('jugar de nuevo reinicia la partida',await p.evaluate(()=>qzGame.i===0&&qzGame.score===0&&qzGame.phase==='spin'));
    await p.evaluate(()=>quitQuiz());

    // PDF
    await p.setInputFiles('#qz-file',fx('biologia-celular.pdf'));
    await p.selectOption('#qz-count','5');
    await p.click('[data-focus-id="qz-create"]');
    await p.waitForSelector('#qz-spin',{timeout:15000});
    const pdf=await p.evaluate(()=>qzCfg().sets[0]);
    ok('crea una trivia desde el PDF',pdf.tipo==='pdf'&&pdf.questions.length===5);
    await p.evaluate(()=>quitQuiz());
    ok('la lista muestra ambas trivias',await p.locator('.qz-tile').count()===2);

    // Lógica: con teoría y ejercicios mezclados, solo pregunta teoría
    await p.setInputFiles('#qz-file',fx('inferencia.pdf'));
    const inf=await p.evaluate(async()=>{const {slides}=await qzRead(qzFile);const r=quizFromSlides(slides,30);
      return {r:{teoria:r.teoria,ejercicios:r.ejercicios,definiciones:r.definiciones},qs:r.preguntas.map(q=>q.q+' '+q.opts.join(' '))}});
    ok('separa diapositivas de teoría y de ejercicios',inf.r.teoria===6&&inf.r.ejercicios===2,JSON.stringify(inf.r));
    ok('reconoce las definiciones aunque el PDF corte las líneas',inf.r.definiciones>=10,String(inf.r.definiciones));
    const malas=inf.qs.filter(t=>/ejercicio|ejemplo|calcule|soluci[oó]n|n = 25|1\.200|ampolleta|1,96|diapositiva|ppt|¿qu[eé] ocurre/i.test(t));
    ok('ninguna pregunta sale de ejercicios, ejemplos o datos numéricos',malas.length===0,malas.slice(0,2).join(' || '));
    ok('pregunta por los conceptos clave',['Valor p','Error tipo I','Intervalo de confianza','Hipótesis nula','Estimador puntual'].every(c=>inf.qs.some(t=>t.includes(c))));
    const soloEj=await p.evaluate(()=>{const r=quizFromSlides([{n:1,title:'Ejercicio 1',lines:['Calcule la media de 3, 5 y 7','Se toma una muestra de n = 10']},{n:2,title:'Ejemplo',lines:['¿Qué ocurre si n aumenta?','Solución: disminuye']}],10);return r.preguntas.length+'|'+r.ejercicios});
    ok('una presentación solo de ejercicios no genera preguntas',soloEj==='0|2',soloEj);
    // Apuntes tipo documento: índice, encabezados, Parte II, fórmulas y «Errores típicos»
    await p.setInputFiles('#qz-file',fx('apunte-muestreo.pdf'));
    const ap=await p.evaluate(async()=>{const {slides}=await qzRead(qzFile);const r=quizFromSlides(slides,30);
      return {secciones:slides.map(s=>s.title),qs:r.preguntas.map(q=>q.q+' '+q.opts.join(' '))}});
    ok('arma secciones con los títulos del apunte',ap.secciones.includes('Muestreo estratificado')&&ap.secciones.includes('Afijación'),ap.secciones.join(' | '));
    ok('ignora índice y encabezado repetido',!ap.qs.some(t=>/\. \. \.|999999|Índice/.test(t)));
    ok('no pregunta sobre la Parte II de ejercicios',!ap.qs.some(t=>/turno|trabajadores|n1 =|Calcule/i.test(t)));
    ok('no toma «Errores típicos» como verdades',!ap.qs.some(t=>/Redondear el tama|Olvidar la correcci/i.test(t)));
    ok('ignora las fórmulas',!ap.qs.some(t=>/Σ|V\(ȳ\)/.test(t)));
    ok('da contexto a las listas (afijación proporcional)',ap.qs.some(t=>t.includes('Afijación proporcional'))&&ap.qs.some(t=>t.includes('Afijación de Neyman')));
    ok('une definiciones cortadas en dos líneas',ap.qs.some(t=>t.includes('respecto de la variable de interés')));
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
    await p.locator('.qz-tile').first().locator('.qz-del').click();
    const confirm=p.locator('.modal button, [role="dialog"] button').filter({hasText:'Borrar'});
    if(await confirm.count())await confirm.first().click();
    await p.waitForTimeout(200);
    ok('borrar elimina la trivia',await p.evaluate(()=>qzCfg().sets.length===1));

    // Móvil
    await p.setViewportSize({width:390,height:844});
    await p.evaluate(()=>startQuiz(qzCfg().sets[0].id));await p.waitForTimeout(150);
    ok('móvil sin scroll horizontal en la ruleta',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await spin();
    ok('móvil sin scroll horizontal durante el juego',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await p.evaluate(()=>quitQuiz());
  }catch(e){res.push('ERROR DEL TEST '+e.message.split('\n')[0])}
  ok('sin errores de consola',errs.length===0,errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r=>!r.startsWith('OK'))?1:0);
})();
