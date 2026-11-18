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
  const confirmCancel=async()=>{
    const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    await p.click('#confirm-cancel');await d.waitFor({state:'hidden'});
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
  ok('tras el consentimiento ofrece la importación simulada',(await text()).includes('Importando tus datos desde la UdeC'));
  await p.click('[data-focus-id="inst-import-skip"]');
  ok('tras la importación vuelve a Ajustes → Cuenta',(await text()).includes('Cuenta')&&await p.evaluate(()=>section==='ajustes'&&tab==='cuenta'));
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
  await p.click('text=Desconectar de mi universidad');
  const desDialog=await p.locator('#confirm-dialog').isVisible();
  if(desDialog){ok('al desconectar pregunta si conservar o quitar lo importado',(await p.textContent('#confirm-dialog')).includes('importados'));await confirmOk()}
  const despues=await p.evaluate(()=>({type:S.account.type,...{c:S.courses.length,g:S.courses[0].grades.length,d:S.wellbeing.diary.length,n:S.wellbeing.diary[0].note}}));
  ok('desconectar vuelve a personal sin borrar datos',despues.type==='personal'&&JSON.stringify(antes)===JSON.stringify({c:despues.c,g:despues.g,d:despues.d,n:despues.n}),JSON.stringify(despues));
  ok('al desconectar desaparece el logo institucional',await p.locator('.inst-logo').count()===0);
  await p.click('[data-focus-id="connect-institution"]');
  await p.click('[data-focus-id="inst-option-udec"]');
  await p.fill('#inst-email','ana@udec.cl');await p.click('[data-focus-id="inst-login"]');
  ok('el consentimiento se pide una sola vez',await p.evaluate(()=>InstitutionalFlow.get()===null&&S.account.type==='institucional'&&S.account.email==='ana@udec.cl'));
  ok('reconectar conserva ramos, notas y diario',await p.evaluate(a=>S.courses.length===a.c&&S.courses[0].grades.length===a.g&&S.wellbeing.diary[0].note===a.n,antes));
  if(await p.locator('[data-focus-id="inst-import-skip"]').count())await p.click('[data-focus-id="inst-import-skip"]');

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

  // 6. Importación simulada desde la UdeC: pasos, vista previa, confirmación y datos.
  await p.evaluate(()=>{S=fresh();S.profile={name:'Ana',career:'Ingeniería Civil'};S.account={type:'institucional',institutionId:'udec',email:'ana@udec.cl',linkedAt:today()};
    S.institutionConsentAt=today();S.courses=[{id:'c1',name:'Cálculo Numérico',difficulty:3,color:'#3b6df0',grades:[],passGrade:4,roundFinal:true}];
    S.wellbeing.diary=[{date:today(),mood:4,energy:3,sleep:3,tags:[],note:'SECRETO_IMPORT',ts:1}];
    S.events=[];S.tasks=[];S.sessions=[];S.certamen={plans:[],topicsByCourse:{c1:['Derivadas']}};save();go('cuenta');
  });
  await p.evaluate(()=>{S.institutionConsentAt=null;save()});
  await p.click('text=Desconectar de mi universidad');
  if(await p.locator('#confirm-dialog').isVisible())await confirmOk();
  await p.click('[data-focus-id="connect-institution"]');
  await p.click('[data-focus-id="inst-option-udec"]');
  await p.fill('#inst-email','ana@udec.cl');await p.click('[data-focus-id="inst-login"]');
  await p.click('[data-focus-id="inst-consent-ok"]');
  const importing=await text();
  ok('justo tras el consentimiento aparece la pantalla de importación con pasos',
    importing.includes('Importando tus datos desde la UdeC')&&['Ramos inscritos','Horario','Fechas de evaluación','Notas'].every(s=>importing.includes(s)));
  ok('la pantalla de importación está marcada como Datos de ejemplo',importing.includes('Datos de ejemplo'));
  await p.waitForSelector('[data-focus-id="inst-import-confirm"]',{timeout:5000});
  const preview=await text();
  ok('vista previa para confirmar con botones Agregar / Ahora no',preview.includes('Revisa lo que traigo desde la UdeC')&&await p.locator('[data-focus-id="inst-import-confirm"]').count()===1&&await p.locator('[data-focus-id="inst-import-later"]').count()===1);
  const data=await p.evaluate(()=>({n:instImport.data.courses.length,weights:instImport.data.courses.map(c=>c.grades.reduce((s,g)=>s+g.weight,0)),needs:instImport.data.courses.map(c=>gradeSummary(c.grades,c).need),
    past:instImport.data.courses.map(c=>c.grades.filter(g=>g.score!=null).reduce((s,g)=>s+g.weight,0)),
    days:[...new Set(instImport.data.classes.map(k=>k.day))].sort(),soon:instImport.data.events.filter(e=>e.type==='evaluacion'&&diffDays(today(),e.date)<=7&&diffDays(today(),e.date)>=0).length,
    cluster:instImport.data.events.filter(e=>{const w=instImport.data.events.filter(x=>x.date>=e.date&&diffDays(e.date,x.date)<=4);return w.length>=3}).length,
    origins:[...instImport.data.courses,...instImport.data.classes,...instImport.data.events].every(x=>x.origin==='udec-demo'),
    k:instImport.data.classes.length,e:instImport.data.events.length,keepC:instImport.courses.filter(x=>x.keep).length,
    keepK:instImport.data.classes.filter(k=>instImport.courses.some(x=>x.keep&&x.course.id===k.courseId)).length,
    keepE:instImport.data.events.filter(e=>instImport.courses.some(x=>x.keep&&x.course.id===e.courseId)).length}));
  ok('5 ramos de Ingeniería Civil con ponderaciones de 100% y origin',data.n===5&&data.weights.filter(w=>w===100).length>=4&&data.origins&&data.needs.some(n=>n>2&&n<=7),JSON.stringify(data));
  ok('las notas 1–7 solo están en lo ya rendido',data.past.every((w,i)=>w<=data.weights[i])&&await p.evaluate(()=>instImport.data.courses.every(c=>c.grades.every(g=>g.score==null||(g.score>=1&&g.score<=7)))));
  ok('horario de lunes a viernes y certamen dentro de 7 días',data.days.join(',')==='0,1,2,3,4'&&data.soon>=1,JSON.stringify(data));
  ok('semana con 3 evaluaciones en 5 días',data.cluster>=3,JSON.stringify(data.cluster));
  ok('ramo previo con el mismo nombre se marca Ya lo tienes y se omite',preview.includes('Ya lo tienes')&&await p.evaluate(()=>instImport.courses.filter(x=>x.keep).length===4));
  await p.click('[data-focus-id="inst-import-confirm"]');
  const doneHtml=await p.evaluate(()=>{
    const done=document.querySelector('#inst-import-done');
    return done?done.textContent+' '+done.innerHTML:'';
  });
  const imported=await p.evaluate(()=>({c:S.courses.length,udec:S.courses.filter(c=>c.origin==='udec-demo').length,k:S.classes.length,e:S.events.length,
    grades:S.courses.filter(c=>c.origin==='udec-demo').map(c=>gradeSummary(c.grades,c).need),diary:S.wellbeing.diary[0].note,
    old:S.courses.filter(c=>c.name==='Cálculo Numérico'&&!c.origin).length,notice:instImportNotice}));
  ok('no se duplica el ramo previo del mismo nombre',imported.c===5&&imported.udec===4&&imported.old===1,JSON.stringify(imported));
  ok('se importan horario, fechas y notas sin tocar bienestar',imported.k===data.keepK&&imported.e===data.keepE&&imported.diary==='SECRETO_IMPORT'&&imported.grades.some(n=>n>0)&&imported.grades.some(n=>n===null),JSON.stringify(imported));
  ok('se importan notas con su ponderación y nota necesaria calculada',await p.evaluate(()=>S.courses.filter(c=>c.origin==='udec-demo').some(c=>c.grades.some(g=>g.weight>0&&g.score!=null)&&gradeSummary(c.grades,c).need>2)));
  ok('Arvis avisa que falta el syllabus con enlace',imported.notice.includes('Listo. Lo único que falta es el syllabus')&&doneHtml.includes("go('syllabus')"),JSON.stringify({notice:imported.notice,done:doneHtml.slice(0,200)}));
  await p.evaluate(()=>go('syllabus'));
  const syl=await text();
  ok('los ramos importados sin syllabus aparecen como pendientes',syl.includes('Syllabus pendiente')&&syl.includes('Cálculo Numérico'));
  await p.evaluate(()=>go('semana'));
  ok('el horario importado aparece en Semana',await p.locator('.blk').count()>=data.keepK);
  await p.evaluate(()=>go('ramos'));
  const ramos=await text();
  ok('cada ramo importado lleva Datos de ejemplo y Syllabus pendiente',(ramos.match(/Datos de ejemplo/g)||[]).length>=4&&(ramos.match(/Syllabus pendiente/g)||[]).length>=4&&await p.evaluate(()=>hasSyllabus('c1')));
  await p.evaluate(()=>go('notas'));
  ok('Notas muestra la nota necesaria calculada',(await text()).includes('Nota necesaria en lo que queda'));
  await p.evaluate(()=>go('hoy'));
  const hoy=await text();
  const certInfo=await p.evaluate(()=>({candidates:certCandidates().map(e=>({id:e.id,title:e.title,date:e.date,type:e.type,d:diffDays(today(),e.date)})),plans:certPlans().map(p=>p.eventId),hoy:document.body.innerText.includes('Preparar en modo certamen')}));
  ok('se ofrece el modo certamen tras la importación',hoy.includes('Preparar en modo certamen')&&await p.locator('[data-focus-id^="cert-open-"]').count()>0,JSON.stringify(certInfo));
  ok('aparece el aviso de semana crítica tras la importación',hoy.includes('Semana exigente'));
  await p.evaluate(()=>go('privacidad'));
  const [bk2]=await Promise.all([p.waitForEvent('download'),p.click('text=Descargar respaldo (JSON)')]);
  const bk2Path=tmp+'/respaldo-importado.json';fs.copyFileSync(await bk2.path(),bk2Path);
  const bj2=JSON.parse(fs.readFileSync(bk2Path,'utf8'));
  ok('el respaldo conserva origin y el syllabus pendiente',bj2.courses.filter(c=>c.origin==='udec-demo').length===data.keepC&&bj2.classes.filter(k=>k.origin==='udec-demo').length===data.keepK&&bj2.events.filter(e=>e.origin==='udec-demo').length===data.keepE&&bj2.certamen.topicsByCourse.c1.length===1);
  await p.setInputFiles('input[onchange="importData(this)"]',bk2Path);await confirmOk();await p.waitForTimeout(200);
  ok('la restauración conserva origin',await p.evaluate(d=>S.courses.filter(c=>c.origin==='udec-demo').length===d.keepC&&S.events.filter(e=>e.origin==='udec-demo').length===d.keepE,data));

  // 7. Quitar los datos importados y "Ahora no".
  await p.evaluate(()=>go('cuenta'));
  await p.click('[data-focus-id="remove-institution-data"]');await confirmOk();
  const removed=await p.evaluate(()=>({c:S.courses.length,udec:S.courses.filter(c=>c.origin==='udec-demo').length,k:S.classes.length,e:S.events.length,diary:S.wellbeing.diary[0].note}));
  ok('Quitar los datos importados borra solo origin udec-demo',removed.c===1&&removed.udec===0&&removed.k===0&&removed.e===0&&removed.diary==='SECRETO_IMPORT',JSON.stringify(removed));
  await p.click('[data-focus-id="reimport-institution"]');
  await p.waitForSelector('[data-focus-id="inst-import-later"]',{timeout:5000});
  await p.click('[data-focus-id="inst-import-later"]');
  ok('Ahora no no agrega nada',await p.evaluate(()=>S.courses.length===1&&S.classes.length===0&&S.events.length===0&&instImport===null));

  await p.click('[data-focus-id="reimport-institution"]');
  await p.waitForSelector('[data-focus-id="inst-import-confirm"]',{timeout:5000});
  await p.click('[data-focus-id="inst-import-confirm"]');
  await p.evaluate(()=>go('cuenta'));
  await p.click('text=Desconectar de mi universidad');await confirmOk();
  ok('al desconectar Conservar mis datos mantiene lo importado',await p.evaluate(()=>S.account.type==='personal'&&importedCount()>0));
  await p.evaluate(()=>{S.account={type:'institucional',institutionId:'udec',email:'ana@udec.cl',linkedAt:today()};save();go('cuenta')});
  await p.click('text=Desconectar de mi universidad');await confirmCancel();
  ok('al desconectar Quitar los importados borra solo lo importado',await p.evaluate(()=>S.account.type==='personal'&&S.courses.length===1&&S.classes.length===0&&S.events.length===0&&S.wellbeing.diary[0].note==='SECRETO_IMPORT'));

  ok('el modo institucional no hace peticiones de red',external.length===0,external.slice(0,3).join(' | '));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exitCode=1});
