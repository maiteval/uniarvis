// Modo institucional (prototipo): flujo, privacidad, calendario y aislamiento de red.
const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const text=()=>p.textContent('#app');
  const confirmOk=async()=>{
    const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    await p.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };

  const ctx=await b.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await ctx.route('**/*',r=>{
    let u;try{u=new URL(r.request().url())}catch(e){return r.continue()}
    if(/^https?:$/.test(u.protocol)&&u.origin!==local){external.push(u.href);return r.abort()}
    return r.continue();
  });
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());

  // 1. Perfil nuevo: selector, y Personal entra a Inicio como antes
  await p.goto(base);
  ok('perfil nuevo comienza con el registro de siempre',await p.locator('#reg-name').count()===1);
  await p.fill('#reg-name','Ana');await p.fill('#reg-career','Medicina');await p.locator('.hud-btn').click();
  await p.waitForSelector('[data-focus-id="account-personal"]');
  const sel=await text();
  ok('perfil nuevo ve el selector con dos tarjetas grandes',sel.includes('Personal')&&sel.includes('Úsala por tu cuenta')&&sel.includes('Institucional')&&sel.includes('Tu universidad tiene Uarvis'));
  await p.click('[data-focus-id="account-personal"]');
  ok('Personal entra a Inicio igual que antes',(await text()).includes('Elige por dónde empezar hoy')&&await p.evaluate(()=>S.account.type==='personal'));
  ok('Personal no muestra el logo institucional',await p.locator('.inst-logo').count()===0);

  // 2. Perfil existente con datos: migrate lo deja en personal y no ve el selector
  const diario='2026-01-01';
  const ctx2=await b.newContext({serviceWorkers:'block'});
  await ctx2.addInitScript(estado=>{
    try{
      localStorage.setItem('entrenador-academico-tour-seen-v1','1');
      localStorage.setItem('entrenador-academico-v1',JSON.stringify(estado));
    }catch(e){}
  },{courses:[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0'}],classes:[],events:[],tasks:[],sessions:[],
    profile:{name:'Diego',career:'Ingeniería'},settings:{min:60,theme:'cian',mode:'light',style:'calma'},
    wellbeing:{diary:[{date:diario,mood:3,energy:3,sleep:3,tags:[],note:'viejo',ts:1}]}});
  await ctx2.route('**/*',r=>r.continue());
  const p2=await ctx2.newPage();p2.on('pageerror',e=>errs.push('pageerror existente: '+e.message));
  await p2.goto(base);
  ok('perfil existente con datos no ve el selector',await p2.locator('[data-focus-id="account-personal"]').count()===0&&(await p2.textContent('#app')).includes('Elige por dónde empezar hoy'));
  ok('perfil existente queda como personal',await p2.evaluate(()=>S.account.type==='personal'&&S.courses.length===1&&S.wellbeing.diary.length===1));
  await ctx2.close();

  // Datos que deben sobrevivir a todos los cambios de modo
  await p.evaluate(()=>{
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[{id:'g1',name:'Certamen 1',score:6,weight:100}],passGrade:4,roundFinal:true}];
    S.wellbeing.diary=[{date:today(),mood:4,energy:3,sleep:3,tags:[],note:'SECRETO_DIARIO',ts:1}];
    S.events=[];S.tasks=[];S.sessions=[];save();render();
  });

  // 3. Flujo institucional desde Ajustes → Cuenta
  await p.evaluate(()=>go('cuenta'));
  ok('Cuenta existe en Ajustes',(await text()).includes('Conectar con mi universidad'));
  await p.click('[data-focus-id="connect-institution"]');
  ok('flujo: elige tu universidad con la UdeC como única opción',(await text()).includes('Elige tu universidad')&&await p.locator('[data-focus-id="inst-option-udec"]').count()===1);
  await p.click('[data-focus-id="inst-option-udec"]');
  const login=await text();
  ok('flujo: acceso simulado y etiqueta de prototipo',login.includes('Ingresar con mi cuenta institucional')&&login.includes('Prototipo · no oficial')&&login.includes('SSO real'));
  await p.fill('#inst-email','ana@gmail.com');await p.click('[data-focus-id="inst-login"]');
  ok('correo con otro dominio rechazado',(await text()).includes('@udec.cl')&&await p.evaluate(()=>InstitutionalFlow.get().step==='login'));
  await p.fill('#inst-email','ana@udec.cl');await p.click('[data-focus-id="inst-login"]');
  ok('correo @udec.cl aceptado',await p.evaluate(()=>InstitutionalFlow.get().step==='consent'));
  const consent=await text();
  ok('consentimiento explica qué ve y qué no ve la universidad',consent.includes('Estadísticas generales')&&consent.includes('10 o más')&&consent.includes('Check-in')&&consent.includes('Diario')&&consent.includes('Calificaciones'));
  ok('consentimiento ofrece Entendido y Volver',await p.locator('[data-focus-id="inst-consent-ok"]').count()===1&&await p.locator('[data-focus-id="account-back"]').count()===1);
  await p.click('[data-focus-id="account-back"]');
  ok('desde el consentimiento se puede volver al correo',await p.evaluate(()=>InstitutionalFlow.get().step==='login'));
  await p.fill('#inst-email','ana@udec.cl');await p.click('[data-focus-id="inst-login"]');
  await p.click('[data-focus-id="inst-consent-ok"]');
  ok('tras el consentimiento vuelve a Ajustes → Cuenta',(await text()).includes('Cuenta')&&await p.evaluate(()=>section==='ajustes'&&tab==='cuenta'));
  const acc=await p.evaluate(()=>({...S.account}));
  ok('cuenta vinculada a la UdeC',acc.type==='institucional'&&acc.institutionId==='udec'&&/udec\.cl$/.test(acc.email)&&/^\d{4}-\d{2}-\d{2}$/.test(acc.linkedAt),JSON.stringify(acc));

  // Apariencia, contactos y privacidad en modo institucional
  ok('logo institucional en encabezado y en Cuenta',await p.locator('.brand .inst-logo').count()===1&&await p.locator('.account-status .inst-logo').count()===1);
  ok('acento institucional sobre el tema actual',await p.evaluate(()=>document.documentElement.getAttribute('data-institution')==='udec'));
  ok('prototipo no oficial visible en Cuenta',(await text()).includes('Prototipo · no oficial'));
  await p.evaluate(()=>go('cuenta'));
  ok('Ajustes → Cuenta muestra modo, universidad y etiqueta',(await text()).includes('Institucional')&&(await text()).includes('Universidad de Concepción')&&(await text()).includes('Prototipo · no oficial'));
  await p.evaluate(()=>go('apoyo'));
  const apoyo=await text();
  ok('contactos UdeC precargados con etiqueta de ejemplo',apoyo.includes('DISE')&&apoyo.includes('bienestar@udec.cl')&&apoyo.includes('Dato de ejemplo')&&await p.evaluate(()=>/DISE/.test(S.support.name)&&/udec\.cl/.test(S.support.contact)));
  ok('líneas de crisis nacionales siempre visibles',apoyo.includes('*4141')&&apoyo.includes('600 360 7777'));
  const href=decodeURIComponent(await p.getAttribute('#inst-contact-mailto','href'));
  ok('Quiero que me contacten prepara un mailto solo con nombre y correo',href.startsWith('mailto:')&&href.includes('Ana')&&href.includes('ana@udec.cl')&&!href.includes('SECRETO_DIARIO')&&!/\b(mood|energía|ánimo|sueño|diario|calificaciones|check-in)\b/i.test(href),href.slice(0,180));

  // Semana: calendario, semanas críticas y sin micro-tareas en recesos/feriados
  await p.evaluate(()=>{weekStart=mondayOf(today());go('semana')});
  const semana=await text();
  ok('Semana muestra certámenes, recesos y feriados',semana.includes('Semanas de certámenes')&&semana.includes('Receso')&&semana.includes('Feriado'));
  ok('semanas de certámenes cuentan como semanas críticas',semana.includes('Semana exigente')&&semana.includes('certámenes'));
  const sinTarea=await p.evaluate(()=>institutionNoTaskDates());
  ok('hay recesos y feriados de ejemplo relativos a hoy',sinTarea.length>=3,JSON.stringify(sinTarea));
  await p.evaluate(()=>{
    S.events=[{id:'ev1',courseId:'c1',title:'Certamen',date:addDays(today(),40),type:'evaluacion'}];
    S.lastPlan=null;replanAll();render();
  });
  ok('los feriados y recesos no reciben micro-tareas',await p.evaluate(ds=>S.tasks.length>0&&S.tasks.every(t=>!ds.includes(t.date)),sinTarea));

  // 4. Cambiar de modo sin perder datos, y consentimiento una sola vez
  const antes=await p.evaluate(()=>({c:S.courses.length,g:S.courses[0].grades.length,d:S.wellbeing.diary.length,n:S.wellbeing.diary[0].note}));
  await p.evaluate(()=>go('cuenta'));
  await p.click('text=Desconectar de mi universidad');await confirmOk();
  const despues=await p.evaluate(()=>({type:S.account.type,...{c:S.courses.length,g:S.courses[0].grades.length,d:S.wellbeing.diary.length,n:S.wellbeing.diary[0].note}}));
  ok('desconectar vuelve a personal sin borrar datos',despues.type==='personal'&&JSON.stringify(antes)===JSON.stringify({c:despues.c,g:despues.g,d:despues.d,n:despues.n}),JSON.stringify(despues));
  ok('al desconectar desaparece el logo institucional',await p.locator('.inst-logo').count()===0);
  await p.click('[data-focus-id="connect-institution"]');
  await p.click('[data-focus-id="inst-option-udec"]');
  await p.fill('#inst-email','ana@udec.cl');await p.click('[data-focus-id="inst-login"]');
  ok('el consentimiento se pide una sola vez',await p.evaluate(()=>InstitutionalFlow.get()===null&&S.account.type==='institucional'&&S.account.email==='ana@udec.cl'));
  ok('reconectar conserva ramos, notas y diario',await p.evaluate(a=>S.courses.length===a.c&&S.courses[0].grades.length===a.g&&S.wellbeing.diary[0].note===a.n,antes));

  // Selector → Institucional y volver atrás desde cualquier paso
  await p.evaluate(()=>{section='inicio';tab='';S.account.type=null;save();render()});
  await p.click('[data-focus-id="account-institucional"]');
  ok('el selector abre el mismo flujo institucional',(await text()).includes('Elige tu universidad'));
  await p.click('[data-focus-id="account-back"]');
  ok('desde el primer paso se puede volver al selector',await p.locator('[data-focus-id="account-personal"]').count()===1);
  await p.click('[data-focus-id="account-institucional"]');
  await p.click('[data-focus-id="inst-option-udec"]');
  await p.fill('#inst-email','ana@udec.cl');await p.click('[data-focus-id="inst-login"]');
  ok('selector → Institucional entra a Inicio',(await text()).includes('Elige por dónde empezar hoy')&&await p.evaluate(()=>section==='inicio'&&S.account.type==='institucional'));

  await p.evaluate(()=>{S.account.type='personal';save();render()});

  // 5. Respaldo y restauración de S.account, con validación del catálogo
  await p.evaluate(()=>{S.account={type:'institucional',institutionId:'udec',email:'ana@udec.cl',linkedAt:today()};save();go('privacidad')});
  const [bk]=await Promise.all([p.waitForEvent('download'),p.click('text=Descargar respaldo (JSON)')]);
  const bkPath=tmp+'/respaldo-institucional.json';fs.copyFileSync(await bk.path(),bkPath);
  const bj=JSON.parse(fs.readFileSync(bkPath,'utf8'));
  ok('el respaldo conserva S.account',bj.account&&bj.account.type==='institucional'&&bj.account.institutionId==='udec'&&bj.account.email==='ana@udec.cl',JSON.stringify(bj.account));
  const inval=JSON.parse(JSON.stringify(bj));inval.account.institutionId='otra-universidad';
  const invalPath=tmp+'/respaldo-invalido.json';fs.writeFileSync(invalPath,JSON.stringify(inval));
  await p.evaluate(()=>{S=fresh();S.profile={name:'Ana',career:'Medicina'};S.account.type='personal';save();render()});
  await p.setInputFiles('input[onchange="importData(this)"]',invalPath);await confirmOk();await p.waitForTimeout(200);
  ok('institutionId inválido vuelve a personal',await p.evaluate(()=>S.account.type==='personal'&&S.account.institutionId===''));
  await p.setInputFiles('input[onchange="importData(this)"]',bkPath);await confirmOk();await p.waitForTimeout(200);
  ok('un respaldo válido restaura la cuenta institucional',await p.evaluate(()=>S.account.type==='institucional'&&S.account.institutionId==='udec'&&S.account.email==='ana@udec.cl'));

  ok('el modo institucional no hace peticiones de red',external.length===0,external.slice(0,3).join(' | '));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exitCode=1});
