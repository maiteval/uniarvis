// Uso: node tests/ui.test.js <ruta-al-html> <carpeta-capturas>
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
  const file=process.argv[2],shots=process.argv[3];
  fs.mkdirSync(shots,{recursive:true});
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1100,height:900}});
  const errs=[],res=[];
  const ok=(name,cond,extra='')=>res.push((cond?'OK   ':'FALLA')+' '+name+(extra?'  → '+extra:''));
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());
  const onboard=async()=>{
    const choice=p.locator('[data-focus-id="account-personal"]');
    if(await choice.count())await choice.click();
    if(await p.locator('#reg-name').count()){
      await p.fill('#reg-name','Estudiante');
      await p.fill('#reg-career','Carrera');
      await p.locator('.hud-btn').click();
    }
  };
  const acceptConsent=async()=>{
    const b=p.locator('text=Acepto y quiero usar el check-in');
    if(await b.count())await b.click();
  };
  const open=async(sec,sub)=>{
    await p.locator('.brand').click();
    if(sec!=='Inicio')await p.locator('.home-card').filter({hasText:sec}).click();
    if(sub){
      const chip=p.locator('.subchips').locator('button',{hasText:sub}).first();
      const navBtn=p.locator('nav .subtabs').locator('button',{hasText:sub}).first();
      if(await chip.count()){
        try{ if(await chip.isVisible()) { await chip.click(); return; } }catch(e){}
      }
      await navBtn.click();
    }
  };
  const confirmOk=async(word)=>{
    const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    if(word)await p.fill('#confirm-word',word);
    await p.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };
  await p.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await p.goto('file://'+file);

  // 1. Primera pantalla: selector de modo y app completa sin pedir consentimiento
  let t=await p.textContent('#app');
  ok('primera vez muestra el selector de modo',t.includes('¿Cómo quieres usar Uarvis?')&&await p.locator('[data-focus-id="account-personal"]').count()===1&&await p.locator('#reg-name').count()===0);
  const st0=await p.evaluate(()=>({style:S.settings.style,attr:document.documentElement.getAttribute('data-style')}));
  ok('estilo Calma predeterminado para perfiles nuevos',st0.style==='calma'&&st0.attr==='calma',JSON.stringify(st0));
  await onboard();
  t=await p.textContent('#app');
  ok('tras el perfil la app se muestra sin pedir consentimiento',!t.includes('Antes de empezar')&&t.includes('Elige por dónde empezar hoy'));
  ok('no hay introducción de 3 pasos',await p.locator('#onboarding').count()===0&&!t.includes('1/3'));
  const orden=await p.evaluate(()=>[...document.querySelectorAll('.home-card .home-copy b')].map(x=>x.textContent));
  ok('inicio ordena Bienestar, Académico, Herramientas, Planificación, Social y Ajustes',orden.join(',')==='Bienestar,Académico,Herramientas,Planificación,Social,Ajustes',orden.join(','));
  await open('Bienestar','Check-in');
  ok('el consentimiento aparece al abrir el check-in en Bienestar',(await p.textContent('#app')).includes('Antes de empezar'));
  await acceptConsent();
  await open('Planificación','Hoy');
  ok('el check-in no aparece en Hoy',await p.locator('.ci-row').count()===0);
  const ml=await p.evaluate(()=>({mode:S.settings.mode,attr:document.documentElement.getAttribute('data-mode')}));
  ok('modo claro por defecto',ml.mode==='light'&&ml.attr==='light',JSON.stringify(ml));

  // 1b. Panel de apariencia: color y modo claro/oscuro
  await open('Ajustes','Apariencia');
  ok('el panel ofrece estilos, 8 colores y 2 modos',await p.locator('.swatch').count()===8&&await p.locator('.mode-btn').count()===4);
  ok('el estilo HUD sigue disponible',(await p.textContent('#app')).includes('HUD'));
  ok('Apariencia ya no ofrece repetir la introducción',!(await p.textContent('#app')).includes('Ver la introducción de nuevo'));
  await p.locator('.swatch').filter({hasText:'Morado'}).click();
  await p.locator('.mode-btn').filter({hasText:'Claro'}).click();
  const th=await p.evaluate(()=>({accent:document.documentElement.getAttribute('data-accent'),mode:document.documentElement.getAttribute('data-mode'),theme:S.settings.theme,modeS:S.settings.mode}));
  ok('el panel aplica color y modo',th.accent==='morado'&&th.mode==='light'&&th.theme==='morado'&&th.modeS==='light',JSON.stringify(th));
  await p.reload();
  ok('recarga conserva la ruta',p.url().includes('#/ajustes/tema'),p.url());
  await open('Ajustes','Apariencia');
  const th2=await p.evaluate(()=>({accent:document.documentElement.getAttribute('data-accent'),mode:document.documentElement.getAttribute('data-mode')}));
  ok('el tema se conserva al recargar',th2.accent==='morado'&&th2.mode==='light',JSON.stringify(th2));
  await p.locator('.swatch').filter({hasText:'Cian'}).click();
  await p.locator('.mode-btn').filter({hasText:'Oscuro'}).click();

  // 1c. Navegación por secciones y URL
  await open('Académico','Notas');
  ok('la URL refleja la subsección',p.url().endsWith('#/academico/notas'),p.url());
  await p.locator('.brand').click();
  await p.goBack();
  ok('Atrás vuelve a la subsección anterior',(await p.textContent('#app')).includes('Notas'));
  await open('Ajustes','Perfil');
  await p.fill('#pf-name','Maite');await p.fill('#pf-career','Ingeniería');await p.click('text=Guardar cambios');
  ok('el perfil se puede editar',await p.evaluate(()=>S.profile.name==='Maite'&&S.profile.career==='Ingeniería'));
  await open('Ajustes','Privacidad');
  ok('Privacidad está en Ajustes',(await p.textContent('#app')).includes('Privacidad y mis datos'));
  await p.locator('button[onclick="wipe()"]').focus();
  await p.click('text=Borrar todo');
  const dlg=p.locator('#confirm-dialog');await dlg.waitFor({state:'visible'});
  await p.waitForFunction(()=>document.activeElement&&document.activeElement.id==='confirm-word');
  const m=await p.evaluate(()=>({role:document.querySelector('[role="dialog"]').getAttribute('aria-modal'),
    focus:document.activeElement.id,disabled:document.getElementById('confirm-ok').disabled}));
  ok('modal accesible y exige BORRAR',m.role==='true'&&m.focus==='confirm-word'&&m.disabled,JSON.stringify(m));
  await p.keyboard.press('Tab');
  ok('el foco queda dentro del modal',await p.evaluate(()=>!!document.activeElement.closest('#confirm-dialog')));
  await p.keyboard.press('Escape');await dlg.waitFor({state:'hidden'});
  ok('Escape cierra y devuelve el foco',await p.evaluate(()=>document.activeElement.getAttribute('onclick')==='wipe()'));
  await p.locator('.skip').focus();
  ok('enlace Saltar al contenido visible al enfocarlo',await p.locator('.skip').isVisible());
  await p.evaluate(()=>document.activeElement.blur());
  const landmarks=await p.evaluate(()=>({main:document.querySelector('main').getAttribute('aria-label'),nav:document.querySelector('nav').getAttribute('aria-label')}));
  ok('puntos de referencia accesibles',landmarks.main==='Contenido principal'&&landmarks.nav==='Navegación de secciones',JSON.stringify(landmarks));
  await open('Bienestar','Apoyo');
  ok('Apoyo ya no contiene Privacidad',!(await p.textContent('#app')).includes('Privacidad y mis datos'));

  // 2. Datos de ejemplo
  await open('Ajustes','Datos de ejemplo');
  await p.click('text=Cargar datos de ejemplo');
  await onboard();
  await open('Académico','Ramos');
  ok('Ramos mantiene visible Cargar datos de ejemplo',await p.locator('[data-focus-id="load-demo"]').count()===1);
  const dif=await p.evaluate(()=>({
    label:document.querySelector('label[for="cd"]').textContent.trim(),
    opts:[...document.querySelectorAll('#cd option')].map(o=>o.value+'|'+o.textContent.trim()),
    listLabel:document.querySelector('.task label[for^="diff-"]').textContent.trim(),
    help:document.querySelector('label[for="cd"]').closest('.row').nextElementSibling.textContent.trim()
  }));
  ok('dificultad con etiqueta, pistas y valores numéricos',dif.label==='Dificultad percibida'&&dif.listLabel==='Dificultad percibida'&&
    dif.opts.join(',')==='1|1 · Muy fácil,2|2 · Fácil,3|3 · Media,4|4 · Difícil,5|5 · Muy difícil'&&
    dif.help.startsWith('La dificultad percibida es qué tan pesado sientes el ramo, de 1 a 5.'),JSON.stringify(dif));
  await open('Académico','Fechas');
  ok('Syllabus mantiene visible Cargar datos de ejemplo',await p.locator('[data-focus-id="load-demo"]').count()===1);
  await open('Planificación','Hoy');
  const base=await p.evaluate(()=>({tasks:S.tasks.length,sizes:[...new Set(S.tasks.map(t=>t.minutes))].sort((a,b)=>a-b),
    cap:capFor(today()),min:minFor(today())}));
  ok('plan generado con sesiones de estudio',base.tasks>5,JSON.stringify(base));
  ok('sesiones largas, sin restos sueltos',base.sizes.every(x=>x>=30),'tamaños '+base.sizes.join(','));
  const hoyTxt=await p.textContent('#app');
  ok('Hoy muestra agenda con horas',hoyTxt.includes('Agenda de hoy')&&/\d{1,2}:\d{2}/.test(hoyTxt));
  ok('pestaña activa marcada para lectores de pantalla',(await p.textContent('nav button[aria-current="page"]'))==='Hoy');
  ok('casillas del plan tienen etiqueta accesible',await p.locator('input[type="checkbox"][aria-label]').count()>0);
  const nCourses=await p.evaluate(()=>S.courses.length);
  await p.evaluate(()=>delCourse(S.courses[0].id));
  ok('borrado simple ofrece Deshacer',await p.locator('.toast-undo').count()===1);
  await p.click('.toast-undo');
  ok('Deshacer recupera el ramo',await p.evaluate(n=>S.courses.length===n,nCourses));

  // 2b. Redibujar en la misma ruta no mueve foco ni scroll ni reinicia la animación
  await p.evaluate(()=>{const m=document.getElementById('hoy-mas');if(m)m.open=true;window.scrollTo({top:320,behavior:'instant'})});   // el mínimo viable vive en "Más opciones"
  await p.waitForTimeout(80);
  const y0=await p.evaluate(()=>window.scrollY);
  await p.evaluate(()=>{const e=document.querySelector('#smin');e.focus();e.value='61';e.dispatchEvent(new Event('change',{bubbles:true}))});
  const keep=await p.evaluate(()=>({id:document.activeElement.id,y:window.scrollY,anim:getComputedStyle(document.querySelector('#app')).animationName}));
  ok('render conserva foco y scroll en la misma ruta',keep.id==='smin'&&Math.abs(keep.y-y0)<=2&&keep.anim==='none',JSON.stringify(keep)+' antes '+y0);
  await p.evaluate(()=>{S.settings.min=60;save()});
  await p.evaluate(()=>go('semana'));
  const animA=await p.evaluate(()=>getComputedStyle(document.querySelector('#app')).animationName);
  await p.evaluate(()=>render());
  const animB=await p.evaluate(()=>getComputedStyle(document.querySelector('#app')).animationName);
  ok('la animación solo corre al cambiar de ruta',animA==='fadeSlide'&&animB==='none',animA+' / '+animB);
  await p.evaluate(()=>go('hoy'));

  // 3. Ningún día supera su capacidad (salvo que se avise)
  const over=await p.evaluate(()=>{const m={};S.tasks.filter(t=>!t.done).forEach(t=>m[t.date]=(m[t.date]||0)+t.minutes);
    return Object.entries(m).filter(([d,v])=>v+0>planCap(d)).map(([d,v])=>d+':'+v+'>'+planCap(d))});
  ok('ningún día planificado supera su capacidad',over.length===0,over.join(' '));

  // 4. Check-in con energía baja → solo el mínimo y se mueve el resto
  const before=await p.evaluate(()=>S.tasks.filter(t=>t.date===today()&&!t.done).reduce((a,t)=>a+t.minutes,0));
  const totalBefore=await p.evaluate(()=>S.tasks.filter(t=>!t.done).reduce((a,t)=>a+t.minutes,0));
  await open('Bienestar','Check-in');
  await p.locator('.ci-row').nth(0).locator('.sc').nth(0).click();
  await p.locator('.ci-row').nth(1).locator('.sc').nth(1).click();
  await p.locator('.ci-row').nth(2).locator('.sc').nth(1).click();
  await p.click('text=Guardar y ajustar mi plan');
  await p.evaluate(()=>go('hoy'));
  const low=await p.evaluate(()=>({low:lowMode(today()),min:minFor(today()),cap:capFor(today()),ses:sessionMin(),
    pend:S.tasks.filter(t=>t.date===today()&&!t.done).reduce((a,t)=>a+t.minutes,0),
    total:S.tasks.filter(t=>!t.done).reduce((a,t)=>a+t.minutes,0)}));
  const lost=totalBefore-low.total;
  ok('energía baja activa el modo suave',low.low);
  ok('hoy queda solo el mínimo viable',low.pend<=low.min,`pendiente hoy ${low.pend} (antes ${before}) / mínimo ${low.min}`);
  ok('lo que no cabe se reparte o se explica sin culpa',lost>=0&&lost<=before+low.ses&&low.total>0,
    `antes ${totalBefore} después ${low.total}, se liberaron ${before} min y caben ${low.ses} por sesión`);
  t=await p.textContent('#app');
  ok('el mensaje explica el ajuste sin culpa',t.includes('solo lo esencial'));
  ok('no aparece la palabra "atrasad"',!/atrasad/i.test(t));
  await p.screenshot({path:shots+'/01-hoy-energia-baja.png',fullPage:true});

  // 5. Semanas críticas del ejemplo
  const cr=await p.evaluate(()=>criticalClusters().map(g=>g.events.length));
  ok('detecta la semana crítica del ejemplo',cr.length>=1&&cr[0]>=3,JSON.stringify(cr));
  const startBefore=await p.evaluate(()=>firstTaskDate(criticalClusters()[0].events));
  if(await p.locator('text=Reservar margen extra').count()){
    await p.click('text=Reservar margen extra');
    const startAfter=await p.evaluate(()=>firstTaskDate(criticalClusters()[0].events));
    ok('"reservar margen extra" adelanta el inicio',startAfter<=startBefore,`${startBefore} → ${startAfter}`);
  }else ok('botón de margen extra visible',false);

  // 6. Reprogramación sin culpa: tareas pendientes del pasado se reacomodan
  const mv=await p.evaluate(()=>{const d=addDays(today(),-2);S.tasks.filter(t=>!t.done).slice(0,3).forEach(t=>t.date=d);
    replanAll();return {stale:S.tasks.filter(t=>!t.done&&t.date<today()).length,moved:S.moved}});
  ok('tareas pendientes viejas se reacomodan solas',mv.stale===0&&mv.moved&&mv.moved.n===3,JSON.stringify(mv));
  const nd=await p.evaluate(()=>{
    const ayer=addDays(today(),-1);
    S.lastPlan=ayer;
    S.tasks.push({id:'vieja-prueba',eventId:S.events[0].id,courseId:S.events[0].courseId,title:'Pendiente de ayer',date:ayer,minutes:15,done:false});
    const changed=checkNewDay(ayer);
    return {changed,lastPlan:S.lastPlan,stale:S.tasks.filter(t=>!t.done&&t.date<today()).length};
  });
  ok('cambio de día reprograma automáticamente',nd.changed&&nd.lastPlan===await p.evaluate(()=>today())&&nd.stale===0,JSON.stringify(nd));

  // 7. Patrones del diario
  const pt=await p.evaluate(()=>{const r=patterns();return {need:r.need,n:r.items.length}});
  ok('patrones con datos de ejemplo',!pt.need&&pt.n>=1,JSON.stringify(pt));

  // 8. Alerta temprana (ánimo bajo 3 días) y apoyo
  await p.evaluate(()=>{[0,1,2].forEach(k=>{const d=addDays(today(),-k);S.wellbeing.diary=S.wellbeing.diary.filter(e=>e.date!==d);
    S.wellbeing.diary.push({date:d,energy:2,mood:1,sleep:2,tags:[],note:'',ts:1})});save();render()});
  t=await p.textContent('#app');
  ok('alerta temprana amable aparece',t.includes('ánimo bajo')&&t.includes('Ver opciones de apoyo'));
  await p.screenshot({path:shots+'/02-hoy-alerta.png',fullPage:true});

  // 9. Pausas ligadas al calendario (evento hoy y mañana)
  await p.evaluate(()=>{const c=S.courses[0].id;S.events.push({id:'x1',courseId:c,title:'Prueba hoy',date:today(),type:'evaluacion'},
    {id:'x2',courseId:c,title:'Prueba mañana',date:addDays(today(),1),type:'evaluacion'});save();render()});
  const pi=await p.evaluate(()=>pauseItems().map(x=>x.t));
  ok('pausas antes/después de pruebas',pi.some(x=>x.includes('Hoy'))&&pi.some(x=>x.includes('Mañana')),pi.join(' | '));

  // 11. Consentimiento: al revocar, el check-in deja de influir en la capacidad
  const capWith=await p.evaluate(()=>capFor(today()));
  await p.evaluate(()=>{S.consent={health:false,at:today()};save()});
  const capWithout=await p.evaluate(()=>capFor(today()));
  ok('sin consentimiento el check-in no cambia la capacidad',capWithout>capWith,`con ${capWith} sin ${capWithout}`);
  await p.evaluate(()=>{S.consent={health:true,at:today()};save()});

  // 11b. Sesiones: bloques del tamaño elegido, sin restos menores a 20 min
  const sp=await p.evaluate(()=>{const bad=[];for(const ch of [45,60,90])for(let t=30;t<=900;t+=15){const s=splitMinutes(t,ch);
    if(s.reduce((a,x)=>a+x,0)!==t||s.some((x,i)=>i<s.length-1&&(x<ch||x>ch+19))||s.some(x=>x<20))bad.push(t+'/'+ch+':'+s.join(','))}return bad.slice(0,5)});
  ok('splitMinutes: bloques largos que suman el total',sp.length===0,sp.join(' | '));
  const sz=await p.evaluate(()=>[...new Set(S.tasks.map(t=>t.minutes))].sort((a,b)=>a-b));
  ok('plan real sin restos sueltos',sz.every(x=>x>=20),sz.join(','));

  // 11c. Revocar consentimiento borra (si aceptas) y deja de usar el check-in
  const consentPromise=p.evaluate(()=>setConsent(false));await confirmOk();await consentPromise;
  const rv=await p.evaluate(()=>({diary:S.wellbeing.diary.length,ci:ci(today()),consent:S.consent.health}));
  ok('revocar consentimiento borra los check-ins y no se usan',rv.diary===0&&rv.ci===null&&rv.consent===false,JSON.stringify(rv));
  await p.evaluate(()=>setConsent(true));

  // 11d. Apoyo: sugerencia UdeC editable
  await p.evaluate(()=>{S.support={name:'',contact:''};save();go('apoyo')});
  t=await p.textContent('#app');ok('Apoyo sugiere datos de la DISE UdeC',t.includes('dise.udec.cl')&&t.includes('*4141')&&t.includes('600 360 7777'));
  await p.evaluate(()=>fillUdeC());t=await p.textContent('#app');
  ok('guardar datos UdeC los deja visibles',t.includes('bienestar@udec.cl')&&!t.includes('Guardar estos datos'));
  await p.screenshot({path:shots+'/03-apoyo.png',fullPage:true});

  // 11e. Lectura de syllabus: rango de fechas, fecha pasada, tipo desconocido
  const dv=await p.evaluate(()=>detectEvents('Certamen 1: 12 de noviembre\nEntrega informe 20/12/2026\nSemana 3 (15-19 de marzo)\nControl 2 - 5-12-2026\nTaller 1 de enero de 2020',S.courses[0].id).map(e=>e.date+'|'+e.type+'|keep='+e.keep));
  ok('syllabus: detecta fechas y las deja para confirmar',dv.length>=4,dv.join(' ; '));

  // 12. Migración desde el estado de la versión anterior (con reseñas de texto libre)
  await p.evaluate(()=>{localStorage.setItem('entrenador-academico-v1',JSON.stringify({courses:[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0'}],
    classes:[],events:[],tasks:[],sessions:[],reviews:[{id:'r',courseId:'c1',cat:'cuello',src:'Docente',text:'texto libre',votes:1}],
    ratings:[{id:'v',course:'Cálculo',load:5,diff:5,evalType:'certamenes',hours:12}],
    profile:{name:'Ana',career:'Medicina',onboarded:true},intro:{status:'pending',at:null},
    settings:{min:90,max:240},lastPlan:null,wellbeing:{diary:[{date:'2026-10-27',mood:2,tags:['Estrés'],note:'hola',ts:1}],practices:[]}}))});
  await p.reload();
  const mg=await p.evaluate(()=>({reviews:('reviews' in S),ratings:('ratings' in S),consent:S.consent,courses:S.courses.length,min:S.settings.min,mode:S.settings.mode,attr:document.documentElement.getAttribute('data-mode'),style:S.settings.style,styleAttr:document.documentElement.getAttribute('data-style'),profile:S.profile.name,intro:('intro' in S),onboarded:('onboarded' in S.profile)}));
  ok('migración conserva ramos y mínimo',mg.courses===1&&mg.min===90,JSON.stringify(mg));
  ok('migración elimina reseñas y aportes antiguos',!mg.reviews&&!mg.ratings);
  ok('migración deja el check-in sin consentir',mg.consent===null);
  ok('migración usa modo claro',mg.mode==='light'&&mg.attr==='light',JSON.stringify(mg));
  ok('migración conserva estilo HUD para perfiles existentes',mg.style==='hud'&&mg.styleAttr==='hud',JSON.stringify(mg));
  ok('respaldo antiguo con introducción se restaura e ignora esos campos',mg.profile==='Ana'&&!mg.intro&&!mg.onboarded,JSON.stringify(mg));

  // 13. Todas las pestañas renderizan sin errores
  await p.evaluate(()=>{S=fresh();save()});await p.reload();
  await onboard();
  await acceptConsent();
  await open('Ajustes','Datos de ejemplo');await p.click('text=Cargar datos de ejemplo');
  if(await p.locator('#confirm-ok').isVisible().catch(()=>false))await p.click('#confirm-ok');   // ya había ramos: confirma el reemplazo
  await onboard();
  const screens=[['inicio','Inicio'],['hoy','Planificación','Hoy'],['semana','Planificación','Semana'],
    ['ramos','Académico','Ramos'],['syllabus','Académico','Fechas'],['notas','Académico','Notas'],
    ['herramientas','Herramientas'],
    ['checkin','Bienestar','Check-in'],['apoyo','Bienestar','Apoyo'],
    ['amigos','Social'],['perfil','Ajustes','Perfil'],['tema','Ajustes','Apariencia'],['privacidad','Ajustes','Privacidad'],['ejemplos','Ajustes','Datos de ejemplo']];
  for(const [k,sec,sub] of screens){
    await open(sec,sub);
    const txt=await p.textContent('#app'),len=txt.length;
    ok('sección '+(sub||sec)+' renderiza',k==='amigos'?(len>40&&txt.includes('Probar con datos de ejemplo')):len>180,len+' caracteres');
    await p.screenshot({path:shots+'/tab-'+k+'.png',fullPage:true});
  }
  await open('Planificación','Semana');
  ok('navegación de semanas tiene nombres accesibles',await p.locator('button[aria-label="Semana anterior"]').count()===1&&await p.locator('button[aria-label="Semana siguiente"]').count()===1);
  ok('en escritorio el header ocupa todo el ancho',await p.evaluate(()=>{const r=document.querySelector('header').getBoundingClientRect();return Math.round(r.width)===innerWidth&&Math.round(r.left)===0}));
  ok('sin scroll horizontal en escritorio',await p.evaluate(()=>document.documentElement.scrollWidth<=1100));
  // 14. Móvil
  await p.setViewportSize({width:390,height:800});await open('Planificación','Hoy');
  const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
  ok('sin scroll horizontal en móvil (390px)',sw<=392,'ancho '+sw);
  ok('móvil muestra barra de navegación inferior',await p.locator('#mobile-nav .mobile-nav, .mobile-nav').first().isVisible());
  ok('móvil muestra subpestañas como chips',await p.locator('.subchips').isVisible());
  const head=await p.evaluate(()=>{
    const h=document.querySelector('header').getBoundingClientRect(),b=document.getElementById('help-btn');
    const r=b&&b.getBoundingClientRect();
    const tapa=r&&[...document.querySelectorAll('.subchip')].some(c=>{const k=c.getBoundingClientRect();return k.left<r.right&&k.right>r.left&&k.top<r.bottom&&k.bottom>r.top});
    return {ancho:Math.round(h.width),alto:Math.round(h.height),ayuda:!!(r&&r.top>=h.top&&r.bottom<=h.bottom&&!tapa)};
  });
  ok('header móvil compacto, a ancho completo y ? en el header sin tapar subpestañas',head.ancho===390&&head.alto<=60&&head.ayuda,JSON.stringify(head));
  await p.screenshot({path:shots+'/mobile-hoy.png',fullPage:false});
  await open('Planificación','Semana');
  ok('Semana móvil usa agenda vertical',await p.locator('.agenda-movil').isVisible()&&!await p.locator('.calwrap').isVisible());
  const sw2=await p.evaluate(()=>document.documentElement.scrollWidth);
  ok('agenda móvil sin scroll horizontal',sw2<=392,'ancho '+sw2);
  await p.screenshot({path:shots+'/mobile-semana.png',fullPage:false});
  const revisarMovil=async ancho=>{
    await p.setViewportSize({width:ancho,height:800});
    await p.evaluate(()=>{if(S.courses[0]){S.courses[0].origin='udec-demo';S.certamen.topicsByCourse={};save();render()}});
    await open('Académico','Ramos');
    const r=await p.evaluate(()=>{
      const row=document.querySelector('.course-row');if(!row)return null;
      const main=row.querySelector('.course-main').getBoundingClientRect(),diff=row.querySelector('.diff-field').getBoundingClientRect();
      const del=row.querySelector('.btn.del').getBoundingClientRect(),sel=row.querySelector('select'),pending=row.querySelector('.inst-pending');
      return {sw:document.documentElement.scrollWidth,filas:main.bottom<=diff.top+1&&diff.right<=del.left+1,
        sel:sel.getBoundingClientRect().width,texto:sel.options[sel.selectedIndex].textContent.trim(),
        etiqueta:row.querySelector('label').textContent.trim(),pending:!!pending&&getComputedStyle(pending).whiteSpace==='nowrap',
        contraste:pending?getComputedStyle(pending).color:'',sinTag:!row.querySelector('.tag.inst-example'),padding:getComputedStyle(row).padding};
    });
    ok('Mis ramos sin desborde en '+ancho+'px',r&&r.sw<=ancho+2,String(r&&r.sw));
    ok('Mis ramos en 2 filas, etiqueta y dificultad legible en '+ancho+'px',r&&r.filas&&r.sel>=128&&/^[1-5] · /.test(r.texto)&&r.etiqueta==='Dificultad percibida'&&r.pending&&r.contraste==='rgb(138, 90, 0)'&&r.sinTag&&r.padding==='12px',JSON.stringify(r));
    await open('Académico','Fechas');
    const s=await p.evaluate(()=>{
      const input=document.getElementById('syl-file'),label=document.querySelector('label[for="syl-file"]'),name=input.closest('.file-pick').querySelector('.file-name');
      const ec=document.getElementById('ec'),card=ec.closest('.card').getBoundingClientRect();
      const over=[...document.querySelectorAll('.card input,.card select,.card textarea')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.right>card.right+1||b.left<card.left-1)}).length;
      return {sw:document.documentElement.scrollWidth,oculto:getComputedStyle(input).opacity==='0',label:label.textContent.trim(),
        nombre:name.textContent.trim(),opcion:ec.options[0].textContent.trim(),anchoEc:ec.getBoundingClientRect().width,sobre:over};
    });
    ok('Syllabus usa selector de archivo propio y sin desborde en '+ancho+'px',s.sw<=ancho+2&&s.oculto&&s.label==='Elegir archivo (PDF o texto)'&&s.nombre==='Ningún archivo'&&s.opcion==='Ramo…'&&s.anchoEc>250&&s.sobre===0,JSON.stringify(s));
    for(const modo of ['light','dark']){
      await p.evaluate(m=>{S.settings.mode=m;save();applyTheme()},modo);
      const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
      ok('Syllabus sin desborde en '+ancho+'px modo '+modo,sw<=ancho+2,String(sw));
    }
    await p.evaluate(()=>{S.settings.mode='light';save();applyTheme()});
  };
  await revisarMovil(390);
  await revisarMovil(375);

  ok('sin errores de JavaScript en consola',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(r=>r.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
