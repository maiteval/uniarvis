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
    S.events.push({id:'e1',courseId:'c1',title:'Certamen 2',date:addDays(today(),3),type:'evaluacion'});
    save();go('notas');
  });

  const normal=await p.evaluate(()=>{
    const c=S.courses[0];
    c.grades=[{id:'g1',name:'C1',score:5,weight:40},{id:'g2',name:'C2',score:3,weight:30}];save();render();
    const s=gradeSummary(c.grades,c);
    return {need:s.need,wsum:s.wsum,rem:s.rem,text:document.querySelector('.grades-card').textContent};
  });
  ok('nota necesaria: caso normal',Math.abs(normal.need-11/3)<0.01&&normal.wsum===70&&normal.rem===30,JSON.stringify(normal.need));
  ok('nota necesaria y próxima evaluación en pantalla',normal.text.includes('3,7')&&normal.text.includes('Certamen 2')&&normal.text.includes('nota necesaria en ella'));

  const aprobado=await p.evaluate(()=>{
    const c=S.courses[0];c.grades=[{id:'g3',name:'C1',score:6,weight:99}];save();render();
    return document.querySelector('.grades-card').textContent;
  });
  ok('nota necesaria: ya aprobado',aprobado.includes('Ya tienes el ramo aprobado con lo rendido'));

  const dificil=await p.evaluate(()=>{
    const c=S.courses[0];c.grades=[{id:'g4',name:'C1',score:1,weight:95}];save();render();
    return document.querySelector('.grades-card').textContent;
  });
  ok('nota necesaria: meta alta con tono amable',dificil.includes('61,0')&&/examen de repetición/.test(dificil)&&!/imposible|fracas/i.test(dificil));

  const pesos=await p.evaluate(()=>{
    const c=S.courses[0];c.grades=[{id:'g5',name:'C1',score:6,weight:40}];save();render();
    return document.querySelector('.grades-card').innerHTML;
  });
  ok('ponderaciones que no suman 100 % avisan sin rojo',pesos.includes('Faltan 60')&&pesos.includes('banner info')&&!pesos.includes('color:var(--bad)'));

  const redondeo=await p.evaluate(()=>{
    const c=S.courses[0];c.grades=[{id:'g6',name:'C1',score:3.95,weight:100}];
    const on=gradeSummary(c.grades,{...c,roundFinal:true}),off=gradeSummary(c.grades,{...c,roundFinal:false});
    c.roundFinal=true;save();render();
    return {on:on.shown,off:off.shown,text:document.querySelector('.grades-card').textContent};
  });
  ok('redondeo 3,95 → 4,0',redondeo.on===4&&redondeo.off===3.95&&redondeo.text.includes('4,0'));

  await p.evaluate(()=>{const c=S.courses[0];c.grades=[];save();render()});
  await p.fill('#gn-c1','Certamen 1');await p.fill('#gs-c1','5,5');await p.fill('#gw-c1','40');
  await p.click('[data-focus-id="add-grade-c1"]');
  const coma=await p.evaluate(()=>({score:S.courses[0].grades[0].score,input:document.querySelector('.grades-tbl input[inputmode="decimal"]').value}));
  ok('acepta 5,5 y muestra coma decimal',coma.score===5.5&&coma.input==='5,5',JSON.stringify(coma));
  await p.fill('#gn-c1','Certamen 2');await p.fill('#gs-c1','5.5');await p.fill('#gw-c1','30');
  await p.click('[data-focus-id="add-grade-c1"]');
  ok('acepta 5.5',await p.evaluate(()=>S.courses[0].grades.length===2&&S.courses[0].grades[1].score===5.5));

  await p.evaluate(()=>setGradeOption('c1','passGrade','5,5'));
  ok('aprobación configurable por ramo',await p.evaluate(()=>S.courses[0].passGrade===5.5));

  const bk=await p.evaluate(()=>({err:validState(S),copy:cleanState(S),json:JSON.stringify(S)}));
  ok('nuevos campos de notas en respaldo y restauración',bk.err===null&&bk.copy.courses[0].passGrade===5.5&&bk.copy.courses[0].roundFinal===true&&bk.json.includes('"tools"'));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
