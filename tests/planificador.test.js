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
  p.on('dialog',d=>d.accept());
  await p.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await p.goto('file://'+path.resolve(file));
  const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
  if(await p.locator('#reg-name').count()){
    await p.fill('#reg-name','Planificador');await p.fill('#reg-career','Carrera');
    await p.locator('.hud-btn').click();
  }
  const base=()=>p.evaluate(()=>{
    S=fresh();S.profile={name:'Planificador',career:'Carrera'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    S.tasks=[];S.sessions=[];S.wellbeing.diary=[];S.consent=null;inval();
  });

  const split=await p.evaluate(()=>{
    const bad=[];
    for(const size of [45,60,90])for(let total=30;total<=900;total+=15){
      const parts=splitMinutes(total,size),sum=parts.reduce((a,x)=>a+x,0);
      if(sum!==total||parts.some(x=>x<20))bad.push(size+'/'+total+':'+parts.join(','));
    }
    return bad.slice(0,5);
  });
  ok('splitMinutes suma el total y no deja restos sueltos',split.length===0,split.join(' | '));

  const sizes=await p.evaluate(()=>{
    const out={};
    [45,60,90].forEach(size=>{
      S=fresh();S.profile={name:'Planificador',career:'Carrera'};S.account.type='personal';
      S.settings.sessionMin=size;
      S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
      S.events=[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),10),type:'evaluacion'}];
      S.tasks=[];S.sessions=[];inval();replanAll();
      const ts=S.tasks.filter(t=>t.eventId==='ev1'&&!t.done);
      out[size]={n:ts.length,min:Math.min(...ts.map(t=>t.minutes)),max:Math.max(...ts.map(t=>t.minutes)),
        hints:ts.every(t=>t.hint&&t.hint.length<=160&&t.why&&t.why.length<=240),
        slots:ts.every(t=>t.slotStart&&t.slotEnd)};
    });
    return out;
  });
  ok('cada tamaño configurable genera sesiones largas',[45,60,90].every(s=>sizes[s].n>0&&sizes[s].min>=20&&sizes[s].max<=s+29),JSON.stringify(sizes));
  ok('todas las sesiones traen pista, motivo y franja',[45,60,90].every(s=>sizes[s].hints&&sizes[s].slots));

  await base();
  const caps=await p.evaluate(()=>{
    S.settings.sessionMin=60;S.settings.maxSessions=2;
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),12),type:'evaluacion'}];
    inval();replanAll();
    const by={};S.tasks.filter(t=>!t.done).forEach(t=>{(by[t.date]=by[t.date]||[]).push(t)});
    return Object.entries(by).map(([date,ts])=>({date,count:ts.length,load:ts.reduce((a,t)=>a+t.minutes,0),
      cap:planCap(date),soft:dayBudget(date,addDays(today(),11),false),max:maxSessions()}));
  });
  ok('ningún día supera 100% de planCap ni maxSessions',caps.every(x=>x.load<=x.cap&&x.count<=x.max),JSON.stringify(caps.slice(0,3)));
  ok('el presupuesto suave queda bajo el 80% de la capacidad',caps.every(x=>x.soft<=Math.floor(x.cap*0.8/5)*5+5));

  await base();
  const merge=await p.evaluate(()=>{
    S.settings.sessionMin=45;S.settings.maxSessions=2;
    const date=today(),last=addDays(date,4),block=(id,title)=>({date,minutes:45,courseId:'c1',eventId:'ev1',id,title,kind:'ejercicios',hint:'Practica',why:'Por cercanía'});
    const overflow=allocateSessions([block('b1','A'),block('b2','B')],{days:[date],eveDate:last,last});
    const ts=S.tasks.filter(t=>t.date===date);
    return {overflow,count:ts.length,minutes:ts.map(t=>t.minutes),state:sessionState(date).count};
  });
  ok('sesiones del mismo ramo y día se fusionan hasta 90 min',merge.overflow===0&&merge.count===1&&merge.minutes[0]===90&&merge.state===1,JSON.stringify(merge));

  await base();
  const weights=await p.evaluate(()=>{
    S.courses[0].grades=[{id:'g1',name:'Certamen grande',weight:40},{id:'g2',name:'Certamen chico',weight:10}];
    const big=importanceFor({id:'e1',courseId:'c1',title:'Certamen grande',date:today()});
    const small=importanceFor({id:'e2',courseId:'c1',title:'Certamen chico',date:today()});
    return {big,small};
  });
  ok('ponderación 40% pesa más que 10% en la prioridad',weights.big.factor>weights.small.factor&&weights.big.weight===40&&weights.small.weight===10,JSON.stringify(weights));

  await base();
  const slots=await p.evaluate(()=>{
    S.classes=[{id:'k1',courseId:'c1',day:(parse(today()).getDay()+6)%7,start:'09:00',end:'11:00'}];
    inval();
    const s=slotFor(today(),60,'ejercicios'),k=classWindows(today())[0],a=toMin(s.slotStart),b=toMin(s.slotEnd);
    S.classes=[{id:'k2',courseId:'c1',day:(parse(today()).getDay()+6)%7,start:'08:00',end:'21:30'}];
    inval();
    return {free:!(a<k.b&&b>k.a),blocked:slotFor(today(),60,'ejercicios')};
  });
  ok('las franjas esquivan las clases y admiten horas',slots.free&&slots.blocked===null,JSON.stringify(slots));

  await base();
  const flex=await p.evaluate(()=>{
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),5),type:'evaluacion'}];
    S.tasks=[{id:'t1',eventId:'ev1',courseId:'c1',title:'Sin franja',date:today(),minutes:45,done:false}];
    inval();go('hoy');
    return (document.querySelector('#app').textContent||'').includes('Cuando puedas');
  });
  ok('sin ventana disponible la interfaz dice «Cuando puedas»',flex);

  await base();
  const feedback=await p.evaluate(()=>{
    const ev={id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),5),type:'evaluacion'};
    const task=(id,feeling)=>({id,eventId:'ev1',courseId:'c1',title:'Sesión',date:today(),minutes:60,done:true,kind:'ejercicios',feeling});
    S.events=[ev];S.tasks=[task('a','costo')];
    const costly=feedbackFor(ev);
    S.tasks=[task('a','bien'),task('b','bien')];
    const easy=feedbackFor(ev);
    S.tasks=[task('a','bien'),task('b','bien'),task('c','bien')].map((t,i)=>({...t,realMinutes:i===2?90:60}));
    S.settings.paceFactor=1;learnPace();const once=S.settings.paceFactor;learnPace();
    return {costly,easy,once,twice:S.settings.paceFactor};
  });
  ok('«Me costó» propone una sesión extra',feedback.costly.extra===true);
  ok('dos sesiones «Bien» del mismo tipo bajan una sesión',feedback.easy.skipKind==='ejercicios');
  ok('el ritmo aprendido es idempotente',feedback.once===feedback.twice&&feedback.once>=0.7&&feedback.once<=1.4,JSON.stringify(feedback));

  await base();
  const cert=await p.evaluate(()=>{
    S.settings.sessionMin=60;
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),7),type:'evaluacion'}];
    S.certamen={plans:[{eventId:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),7),mockMin:120,
      topics:[{id:'t1',name:'Derivadas',hard:true},{id:'t2',name:'Integrales',hard:false}],leftOut:[]}],topicsByCourse:{}};
    inval();buildCertamenTasks(today(),[]);save();
    const ts=S.tasks.filter(t=>t.certamen&&!t.done);
    return {n:ts.length,sizes:[...new Set(ts.map(t=>t.minutes))].sort((a,b)=>a-b),
      mock:(ts.find(t=>t.phase==='ensayo')||{}).minutes,
      phases:[...new Set(ts.map(t=>t.phase))].sort(),
      named:ts.every(t=>t.hint&&t.why&&t.title),valid:validState(S)};
  });
  ok('el modo certamen usa sesiones largas y conserva las fases',cert.n>=6&&cert.sizes.includes(60)&&cert.mock===120&&cert.phases.length>=4&&cert.named&&cert.valid===null,JSON.stringify(cert));

  const legacy=await p.evaluate(()=>{
    const old={courses:[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0'}],classes:[],
      events:[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),3),type:'evaluacion'}],
      tasks:[{id:'t1',eventId:'ev1',courseId:'c1',title:'Hecha antes',date:today(),minutes:25,done:true}],
      sessions:[],settings:{min:60},profile:{name:'Ana',career:'Medicina'}};
    const err=validState(old),m=migrate(JSON.parse(JSON.stringify(old))),clean=cleanState(JSON.parse(JSON.stringify(old)));
    return {err,sessionMin:m.settings.sessionMin,max:m.settings.maxSessions,pace:m.settings.paceFactor,
      done:m.tasks.filter(t=>t.done).length,valid:validState(m),clean:clean.tasks.filter(t=>t.done).length};
  });
  ok('un respaldo antiguo con tareas hechas migra sin perderlas',legacy.err===null&&legacy.valid===null&&legacy.sessionMin===60&&legacy.max===2&&legacy.pace===1&&legacy.done===1&&legacy.clean===1,JSON.stringify(legacy));

  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
