const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const file=process.argv[2]||path.join(__dirname,'..','index.html');
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1200,height:900}});
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
    S.lastPlan=today();save();go('inicio');
  });

  const base=await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';save();go('inicio');
    const b=document.querySelector('#arvis-inicio .arvis-tocable');
    return {boton:!!b,label:b&&b.getAttribute('aria-label'),tipo:b&&b.getAttribute('type'),
      figura:!!(b&&b.querySelector('.arvis-figura')),src:b&&b.querySelector('img.arvis-base').getAttribute('src'),
      sinHeader:!document.querySelector('#arvis-header')&&typeof arvisHeaderHtml==='undefined',
      rutas:Object.keys(ROUTE).indexOf('arvis')>=0&&typeof viewArvis==='function'};
  });
  ok('el inicio tiene un botón de Arvis y no hay botón en el header',base.boton&&base.label==='Personalizar a Arvis'&&
    base.tipo==='button'&&base.figura&&base.src==='icons/arvis/arvis-normal.svg'&&base.sinHeader&&base.rutas,JSON.stringify(base));

  const logro=await p.evaluate(()=>{
    const c=logrosCfg();c.desbloqueados=[];c.vistos=[];c.equipados={cabeza:'',cara:'',espalda:'',mano:''};
    S.tools.pomodoro.completed=9;save();logrosRevisar('pomodoro');
    const antes=logrosDesbloqueados().indexOf('audifonos')>=0;
    S.tools.pomodoro.completed=10;logrosRevisar('pomodoro');
    const a=document.querySelector('#logro-root .logro-aviso');
    return {antes,despues:logrosDesbloqueados().indexOf('audifonos')>=0,texto:a&&a.textContent,
      ponerselos:!!(a&&[...a.querySelectorAll('button')].some(x=>x.textContent==='Ponérselo')),
      celebrando:!!(a&&a.querySelector('img[src*="arvis-celebrando.svg"]'))};
  });
  ok('al cumplir 10 pomodoros se desbloquea Foco con aviso',!logro.antes&&logro.despues&&/¡Logro: Foco! Desbloqueaste los audífonos/.test(logro.texto||'')&&logro.ponerselos&&logro.celebrando,JSON.stringify(logro.texto));

  const puesto=await p.evaluate(()=>{
    const b=[...document.querySelectorAll('#logro-root button')].find(x=>x.textContent==='Ponérselo');if(b)b.click();
    const a=document.querySelector('#arvis-inicio .arvis-tocable');
    return {mano:logrosCfg().equipados.mano,inicio:!!(a&&a.querySelector('img[src*="audifonos.svg"]'))};
  });
  ok('Ponérselo equipa y el accesorio aparece en el Arvis del inicio',puesto.mano==='audifonos'&&puesto.inicio,JSON.stringify(puesto));

  const alterna=await p.evaluate(()=>{
    go('arvis');
    const tarjeta=document.querySelector('[data-focus-id="item-audifonos"]');
    const puesto=tarjeta&&tarjeta.getAttribute('aria-pressed')==='true';
    if(tarjeta)tarjeta.click();
    const vez1=logrosCfg().equipados.mano;
    const h1=!!document.querySelector('.arvis-preview img[src*="audifonos.svg"]');
    go('arvis');document.querySelector('[data-focus-id="item-audifonos"]').click();
    return {puesto,vez1,h1,vez2:logrosCfg().equipados.mano,h2:!!document.querySelector('.arvis-preview img[src*="audifonos.svg"]')};
  });
  ok('tocar de nuevo quita el accesorio y vuelve a ponerlo',alterna.puesto&&alterna.vez1===''&&!alterna.h1&&alterna.vez2==='audifonos'&&alterna.h2,JSON.stringify(alterna));

  const estado=await p.evaluate(()=>{
    const c=logrosCfg();c.desbloqueados=['gorro-lana'];c.vistos=[];c.equipados.cabeza='';
    S.tools.pomodoro.completed=0;save();go('inicio');
    const punto=!!document.querySelector('#arvis-inicio .arvis-tocable .arvis-nuevo');
    go('arvis');
    const vista=!!document.querySelector('.arvis-personalizar'),figura=!!document.querySelector('.arvis-preview .arvis-figura');
    const vistos=logrosCfg().vistos.slice();
    go('inicio');
    return {punto,despues:!!document.querySelector('#arvis-inicio .arvis-tocable .arvis-nuevo'),vistos,vista,figura};
  });
  ok('punto en el Arvis del inicio y se marca como visto al abrir la vista',estado.punto&&!estado.despues&&estado.vistos.indexOf('gorro-lana')>=0&&estado.vista&&estado.figura,JSON.stringify(estado));

  const bloqueado=await p.evaluate(()=>{
    const c=logrosCfg();c.desbloqueados=[];c.vistos=[];c.equipados={cabeza:'',cara:'',espalda:'',mano:''};
    S.tools.pomodoro.completed=4;save();go('arvis');
    const t=document.querySelector('[data-focus-id="item-audifonos"]');
    const fila=[...document.querySelectorAll('.logro-fila')].find(x=>x.textContent.includes('Foco'));
    return {bloqueado:t&&t.disabled,texto:t&&t.textContent,barra:!!(t&&t.querySelector('.logro-bar')),
      ancho:t&&t.querySelector('.logro-bar span').style.width,lista:!!(fila&&fila.textContent.includes('4/10'))};
  });
  ok('logro bloqueado muestra progreso y barra',bloqueado.bloqueado&&/Completa 10 pomodoros: 4\/10/.test(bloqueado.texto||'')&&bloqueado.barra&&bloqueado.ancho==='40%'&&bloqueado.lista,JSON.stringify(bloqueado.texto));

  const pronto=await p.evaluate(()=>{
    go('arvis');
    const t=document.querySelector('[data-focus-id="item-gorro-dormir"]');
    return {texto:t&&t.textContent,barra:!!(t&&t.querySelector('.logro-bar'))};
  });
  ok('dato inexistente queda como Próximamente',/Próximamente/.test(pronto.texto||'')&&!pronto.barra,JSON.stringify(pronto.texto));

  const migrado=await p.evaluate(()=>{
    const antiguo={courses:[],classes:[],events:[],tasks:[],sessions:[],settings:{min:60,theme:'cian',mode:'light',style:'calma',arvis:false},
      profile:{name:'Viejo',career:'Carrera'},wellbeing:{diary:[]},tools:freshTools(),account:{type:'personal'}};
    S=migrate(antiguo);
    const c=S.settings.arvis;
    return {apagado:c.enabled===false,equipados:c.equipados,desbloqueados:c.desbloqueados,vistos:c.vistos,err:validState(S)};
  });
  ok('perfil antiguo sin datos de Arvis migra con valores vacíos',migrado.apagado&&Object.keys(migrado.equipados).length===4&&
    Object.values(migrado.equipados).every(x=>x==='')&&migrado.desbloqueados.length===0&&migrado.vistos.length===0&&migrado.err===null,JSON.stringify(migrado));

  const respaldo=await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';
    const c=logrosCfg();c.desbloqueados=['audifonos','mochila'];c.vistos=['audifonos'];c.equipados.mano='audifonos';c.equipados.espalda='mochila';
    save();
    const j=JSON.parse(JSON.stringify(S)),err=validState(j),limpio=cleanState(j);
    const malo=JSON.parse(JSON.stringify(j));malo.settings.arvis='no';
    return {err,mano:limpio.settings.arvis.equipados.mano,espalda:limpio.settings.arvis.equipados.espalda,
      desbloqueados:limpio.settings.arvis.desbloqueados,json:JSON.stringify(j).includes('"equipados"'),malo:validState(malo)};
  });
  ok('respaldo y restauración conservan accesorios y validan el formato',respaldo.err===null&&respaldo.mano==='audifonos'&&respaldo.espalda==='mochila'&&
    respaldo.desbloqueados.join()==='audifonos,mochila'&&respaldo.json&&respaldo.malo==='ajustes',JSON.stringify(respaldo));

  const cifrado=await p.evaluate(()=>{
    S=fresh();const c=logrosCfg();c.desbloqueados=['constancia'];c.equipados.cabeza='gorro-lana';save();
    return localStorage.getItem('entrenador-academico-v1').includes('gorro-lana');
  });
  ok('los accesorios se guardan en el mismo almacenamiento local',cifrado,String(cifrado));

  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';
    S.consent={health:true,at:today()};S.wellbeing.diary=[];
    document.getElementById('logro-root').innerHTML='';
    save();loadDraft();go('checkin');
  });
  await p.click('[data-focus-id="ci-energy-4"]');
  await p.click('[data-focus-id="ci-mood-3"]');
  await p.click('[data-focus-id="ci-sleep-3"]');
  await p.click('[onclick="saveCheckin()"]');
  const checkin=await p.evaluate(()=>({
    desbloqueado:logrosDesbloqueados().indexOf('lentes-sol')>=0,
    aviso:(document.querySelector('#logro-root .logro-aviso')||{}).textContent||''
  }));
  ok('check-in desde la interfaz desbloquea Batería cargada y muestra el aviso',checkin.desbloqueado&&
    /¡Logro: Batería cargada! Desbloqueaste los lentes de sol/.test(checkin.aviso),JSON.stringify(checkin.aviso));

  await p.evaluate(()=>{
    S=fresh();S.settings.style='calma';S.account=accountBlank();S.settings.arvis=cleanArvisConfig(null,false);
    document.getElementById('logro-root').innerHTML='';
    save();render();
  });
  await p.click('[data-focus-id="account-personal"]');
  await p.fill('#reg-name','Nueva');await p.fill('#reg-career','Carrera');
  await p.click('.hud-btn');
  const onboarding=await p.evaluate(()=>({
    desbloqueado:logrosDesbloqueados().indexOf('mochila')>=0,
    aviso:(document.querySelector('#logro-root .logro-aviso')||{}).textContent||''
  }));
  ok('onboarding desde la interfaz desbloquea la mochila',onboarding.desbloqueado&&
    /¡Logro: Primer paso! Desbloqueaste la mochila/.test(onboarding.aviso),JSON.stringify(onboarding.aviso));

  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
    document.getElementById('logro-root').innerHTML='';
    save();go('notas');
  });
  await p.fill('#gn-c1','Certamen 1');await p.fill('#gs-c1','5');await p.fill('#gw-c1','40');
  await p.click('[data-focus-id="add-grade-c1"]');
  const notas=await p.evaluate(()=>({
    desbloqueado:logrosDesbloqueados().indexOf('lentes-redondos')>=0,
    aviso:(document.querySelector('#logro-root .logro-aviso')||{}).textContent||''
  }));
  ok('usar la calculadora de notas desbloquea los lentes redondos',notas.desbloqueado&&
    /¡Logro: Sabe sus números! Desbloqueaste los lentes redondos/.test(notas.aviso),JSON.stringify(notas.aviso));

  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';save();go('inicio');
  });
  const sinHeader=await p.evaluate(()=>!document.querySelector('#arvis-header')&&typeof arvisHeaderHtml==='undefined'&&
    !document.querySelector('header [aria-label="Personalizar a Arvis"]'));
  await p.locator('#arvis-inicio .arvis-tocable').click();
  const clic=await p.evaluate(()=>tab==='arvis'&&!!document.querySelector('.arvis-personalizar'));
  await p.evaluate(()=>go('inicio'));
  await p.locator('#arvis-inicio .arvis-tocable').focus();
  await p.keyboard.press('Enter');
  const enter=await p.evaluate(()=>tab==='arvis');
  ok('tocar a Arvis en el inicio abre personalizar con clic y Enter, sin botón en el header',sinHeader&&clic&&enter,
    JSON.stringify({sinHeader,clic,enter}));

  await p.evaluate(()=>{S.profile.name='Otro Nombre';save();go('arvis')});
  const titulo=await p.evaluate(()=>{
    const card=document.querySelector('.arvis-personalizar');
    return {h3:card&&card.querySelector('h3').textContent.trim(),texto:card&&card.textContent};
  });
  ok('la vista de personalizar dice Arvis aunque el perfil tenga otro nombre',titulo.h3==='Arvis'&&
    !/Otro Nombre/.test(titulo.texto||''),JSON.stringify(titulo.h3));

  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
