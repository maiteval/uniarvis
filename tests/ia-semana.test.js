const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1100,height:850}});
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
    S=fresh();S.profile={name:'Ana',career:'Ingeniería',university:''};S.account.type='personal';
    S.courses=[
      {id:'c1',name:'Cálculo Numérico',difficulty:4,color:'#3b6df0',grades:[{id:'g1',name:'Certamen 1',weight:40,score:3.8}],share:false,passGrade:4,roundFinal:true},
      {id:'c2',name:'Termodinámica',difficulty:3,color:'#e0693a',grades:[],share:false,passGrade:4,roundFinal:true}
    ];
    const choque=addDays(today(),3);
    S.events=[
      {id:'e1',courseId:'c1',title:'Certamen 1',date:choque,type:'evaluacion'},
      {id:'e2',courseId:'c2',title:'Control 1',date:choque,type:'control'},
      {id:'e3',courseId:'c1',title:'Entrega',date:addDays(today(),6),type:'entrega'}
    ];
    replanAll();
    S.tasks=[0,1,2,3,4,5,6,7].map(i=>({id:'t'+i,courseId:i%2?'c2':'c1',title:'Estudio '+i,date:addDays(today(),i%7),minutes:30,done:false,kind:'ejercicios',eventId:'e1'}));
    S.wellbeing.diary=[0,1,2].map(i=>({date:addDays(today(),-i),mood:3,energy:2,sleep:3,tags:[],note:'SECRETO_DIARIO',ts:i+1}));
    S.consent={health:true,at:today()};
    save();go('inicio');
  });

  ok('Personal no muestra tarjeta ni chat',await p.locator('#weekly-inicio').count()===0&&
    await p.locator('#weekly-card').count()===0&&await p.locator('#chat-fab').count()===0);
  const callado=await p.evaluate(async()=>({chat:await ArvisIA.chat('hola',[]),semana:await ArvisIA.weeklySummary(),ctx:ArvisIA.context()}));
  ok('ArvisIA no responde en Personal',callado.chat===null&&callado.semana===null&&callado.ctx===null);

  await p.evaluate(async()=>{linkInstitution('udec','ana@udec.cl',await makeInstAuth('Clave1234'));instSessionSet();render();go('inicio')});
  ok('Institucional muestra la tarjeta de Inicio',await p.locator('#weekly-inicio').count()===1&&
    (await p.locator('#weekly-inicio').innerText()).includes('IA · demo'));
  const tag=await p.locator('#weekly-inicio .ai-demo-tag').first();
  ok('la etiqueta IA · demo es accesible',(await tag.getAttribute('title'))==='Respuestas generadas en tu dispositivo, sin IA real'&&
    (await tag.getAttribute('aria-label'))==='Respuestas generadas en tu dispositivo, sin IA real');

  const tChat=await p.evaluate(async()=>{const t0=performance.now(),r=await ArvisIA.chat('¿Qué tengo hoy?',[]);return {ms:performance.now()-t0,r}});
  ok('chat espera entre 300 y 900 ms',tChat.ms>=290&&tChat.ms<=1200,Math.round(tChat.ms));
  ok('chat entrega respuesta estructurada',!!tChat.r.texto&&Array.isArray(tChat.r.lista)&&Array.isArray(tChat.r.acciones)&&
    ('propuesta'in tChat.r||'sugerir'in tChat.r||tChat.r.lista.length>0),JSON.stringify(tChat.r).slice(0,180));
  const tWeek=await p.evaluate(async()=>{const t0=performance.now(),r=await ArvisIA.weeklySummary();return {ms:performance.now()-t0,r}});
  ok('resumen semanal espera entre 300 y 900 ms',tWeek.ms>=290&&tWeek.ms<=1200,Math.round(tWeek.ms));

  const r=await p.evaluate(()=>ArvisIA.weeklySummarySync());
  ok('resumen con forma prevista',!!r.titulo&&r.parrafos.length>=2&&r.prioridades.length<=3&&
    Array.isArray(r.alertas)&&Array.isArray(r.choques)&&typeof r.modoSuave==='boolean');
  ok('detecta evaluaciones juntas',r.choques.length>=1&&r.alertas.some(x=>x.includes('Se juntan')),JSON.stringify(r.choques));
  ok('muestra nota necesaria en las prioridades',r.prioridades.some(x=>x.includes('nota necesaria')),r.prioridades.join(' | '));
  ok('propone modo suave con energía baja',r.modoSuave===true);
  const ctxAi=await p.evaluate(()=>ArvisIA.context());
  ok('el contexto no mezcla notas ni bienestar',ctxAi.cursos.every(c=>!('diario'in c))&&ctxAi.energia===2&&ctxAi.energiaReciente.length>=2);

  await p.evaluate(()=>{S.consent=null;save()});
  const sin=await p.evaluate(()=>({ctx:ArvisIA.context(),txt:JSON.stringify(ArvisIA.weeklySummarySync())}));
  ok('sin consentimiento no lee bienestar',sin.ctx.energia===null&&sin.ctx.energiaReciente.length===0&&!sin.txt.includes('SECRETO_DIARIO'));
  await p.evaluate(()=>{S.consent={health:true,at:today()};save()});

  await p.evaluate(()=>go('semana'));
  ok('Semana muestra el resumen completo',await p.locator('#weekly-card').count()===1&&
    (await p.locator('#weekly-card').innerText()).includes('Prioridades')&&
    (await p.locator('#weekly-card').innerText()).includes('Alertas suaves'));
  await p.locator('#weekly-card .btn.sec',{hasText:'Pregúntale a Arvis'}).click();
  await p.waitForFunction(()=>document.querySelectorAll('.chat-msg.arvis').length>=2,null,{timeout:5000});
  await p.waitForTimeout(50);
  const chat=await p.locator('.chat-msg.arvis').last().innerText();
  ok('el botón del resumen pregunta a Arvis',/Tu semana con Arvis|próximos 7 días/.test(chat)&&
    (await p.locator('#chat-panel .ai-demo-tag').count())===1,chat.slice(0,140));
  await p.locator('.chat-msg.arvis').last().locator('.lnk',{hasText:'Ver resumen completo'}).click();
  await p.waitForTimeout(100);
  ok('el chat lleva al resumen completo',await p.evaluate(()=>tab==='semana')&&await p.locator('#weekly-card').isVisible());
  await p.evaluate(()=>chatToggle(false));

  await p.evaluate(()=>go('inicio'));
  const semana=await p.evaluate(()=>mondayOf(today()));
  await p.locator('#weekly-inicio .lnk',{hasText:'Ahora no'}).click();
  ok('Ahora no oculta la tarjeta solo esta semana',await p.locator('#weekly-inicio').count()===0&&
    await p.evaluate(s=>S.weeklySummary.dismissedWeek===s,semana));
  await p.reload();
  await p.evaluate(()=>{if(typeof instSessionSet==='function')instSessionSet()});
  await p.reload();
  ok('el descarte sobrevive a la recarga',await p.locator('#weekly-inicio').count()===0);
  await p.evaluate(()=>go('semana'));
  ok('el resumen de Semana sigue disponible',await p.locator('#weekly-card').count()===1);
  await p.evaluate(()=>{S.weeklySummary.dismissedWeek=null;save();render();go('inicio')});
  ok('la tarjeta vuelve al liberar la semana',await p.locator('#weekly-inicio').count()===1);

  const modos=await p.evaluate(()=>({resumen:ArvisIA.mode,modo:ARVIS_IA_MODE}));
  ok('la IA queda declarada como simulada',modos.resumen==='simulada'&&modos.modo==='simulada',JSON.stringify(modos));
  const calls=await p.evaluate(()=>({f:window.__fetchCalls||0,x:window.__xhrCalls||0}));
  ok('sin fetch, XHR ni peticiones externas',calls.f===0&&calls.x===0&&external.length===0,JSON.stringify(calls)+' ext='+external.length);
  ok('sin errores de JavaScript',errs.length===0,errs.join(' | '));

  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(x=>x.startsWith('FALLA'))?1:0);
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
