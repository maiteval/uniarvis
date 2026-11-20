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
    S=fresh();S.profile={name:'Prueba',career:'Carrera'};S.account.type='personal';save();
    const b=document.querySelector('#arvis-header button');
    return {boton:!!b,label:b&&b.getAttribute('aria-label'),estado:b&&b.title,texto:b&&b.textContent.trim(),
      figura:!!(b&&b.querySelector('.arvis-figura')),src:b&&b.querySelector('img.arvis-base').getAttribute('src'),
      rutas:Object.keys(ROUTE).indexOf('arvis')>=0&&typeof viewArvis==='function'};
  });
  ok('header tiene botón real de Arvis con cara, estado y ruta',base.boton&&base.label==='Personalizar a Arvis'&&
    /^Estado de hoy: /.test(base.estado||'')&&base.texto==='Aquí'&&base.figura&&base.src==='icons/arvis/arvis-normal.svg'&&base.rutas,JSON.stringify(base));

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
    const h=document.querySelector('#arvis-header button');
    return {mano:logrosCfg().equipados.mano,header:!!(h&&h.querySelector('img[src*="audifonos.svg"]'))};
  });
  ok('Ponérselo equipa y el accesorio aparece en el header',puesto.mano==='audifonos'&&puesto.header,JSON.stringify(puesto));

  const alterna=await p.evaluate(()=>{
    go('arvis');
    const tarjeta=document.querySelector('[data-focus-id="item-audifonos"]');
    const puesto=tarjeta&&tarjeta.getAttribute('aria-pressed')==='true';
    if(tarjeta)tarjeta.click();
    const vez1=logrosCfg().equipados.mano;
    const h1=!!document.querySelector('#arvis-header img[src*="audifonos.svg"]');
    go('arvis');document.querySelector('[data-focus-id="item-audifonos"]').click();
    return {puesto,vez1,h1,vez2:logrosCfg().equipados.mano,h2:!!document.querySelector('#arvis-header img[src*="audifonos.svg"]')};
  });
  ok('tocar de nuevo quita el accesorio y vuelve a ponerlo',alterna.puesto&&alterna.vez1===''&&!alterna.h1&&alterna.vez2==='audifonos'&&alterna.h2,JSON.stringify(alterna));

  const estado=await p.evaluate(()=>{
    const c=logrosCfg();c.desbloqueados=['gorro-lana'];c.vistos=[];c.equipados.cabeza='';save();go('inicio');
    const punto=!!document.querySelector('#arvis-header .arvis-nuevo');
    go('arvis');
    return {punto,despues:!!document.querySelector('#arvis-header .arvis-nuevo'),vistos:logrosCfg().vistos.slice(),
      vista:!!document.querySelector('.arvis-personalizar'),figura:!!document.querySelector('.arvis-preview .arvis-figura')};
  });
  ok('punto por accesorio nuevo y se marca como visto al abrir la vista',estado.punto&&!estado.despues&&estado.vistos.indexOf('gorro-lana')>=0&&estado.vista&&estado.figura,JSON.stringify(estado));

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

  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
