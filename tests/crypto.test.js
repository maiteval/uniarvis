// Uso: node tests/crypto.test.js <url base> <carpeta temporal>
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1100,height:900},acceptDownloads:true});
  await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  const p=await ctx.newPage();
  const res=[],errs=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());
  const raw=()=>p.evaluate(()=>localStorage.getItem('entrenador-academico-v1'));
  const unlock=async pw=>{await p.fill('#lp',pw);await p.click('text=Desbloquear');await p.waitForTimeout(900)};
  const onboard=async()=>{
    const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
    if(await p.locator('#reg-name').count()){
      await p.fill('#reg-name','Estudiante');
      await p.fill('#reg-career','Carrera');
      await p.locator('.hud-btn').click();
    }
  };
  const open=async(sec,sub)=>{
    await p.locator('.brand').click();
    if(sec!=='Inicio')await p.locator('.home-card').filter({hasText:sec}).click();
    if(sub)await p.click('nav >> text="'+sub+'"');
  };
  const confirmOk=async(word)=>{
    const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    if(word)await p.fill('#confirm-word',word);
    await p.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };
  const confirmClick=async(sel,word)=>{await p.click(sel);await confirmOk(word)};
  await p.goto(base);
  await onboard();
  await open('Ajustes','Datos de ejemplo');await p.click('text=Cargar datos de ejemplo');
  await onboard();
  const before=await p.evaluate(()=>({c:S.courses.length,d:S.wellbeing.diary.length,s:S.sessions.length}));
  ok('hay un modo de cifrado disponible',await p.evaluate(()=>CRYPTO_OK));

  // activar con validaciones
  await open('Ajustes','Privacidad');
  await p.fill('#np1','corta');await p.fill('#np2','corta');await p.click('text=Activar cifrado');
  ok('rechaza contraseñas de menos de 8 caracteres',await p.evaluate(()=>!KEYOBJ));
  await p.fill('#np1','clave-segura-123');await p.fill('#np2','otra-distinta-123');await p.click('text=Activar cifrado');
  ok('rechaza contraseñas que no coinciden',await p.evaluate(()=>!KEYOBJ));
  await p.fill('#np1','clave-segura-123');await p.fill('#np2','clave-segura-123');
  await p.click('text=Activar cifrado');
  await p.locator('#confirm-dialog').waitFor({state:'visible'});
  ok('confirmación propia accesible',await p.evaluate(()=>{const d=document.querySelector('[role="dialog"]');const ok=document.getElementById('confirm-ok');return !!d&&d.getAttribute('aria-modal')==='true'&&!!ok;}));
  await p.click('#confirm-ok');await p.locator('#confirm-dialog').waitFor({state:'hidden'});
  await p.waitForFunction(()=>{const r=localStorage.getItem('entrenador-academico-v1');return !!r&&JSON.parse(r).enc===1});
  let r=await raw();
  ok('al activar, lo guardado queda cifrado (sin texto legible)',r.includes('"enc":1')&&!r.includes('Cálculo')&&!r.includes('courses'),r.slice(0,70));

  // recargar → bloqueado
  await p.reload();
  ok('al abrir pide contraseña y no muestra datos',await p.evaluate(()=>!!LOCKED&&document.querySelector('#lp')!==null&&S.courses.length===0)&&!(await p.textContent('#app')).includes('Cálculo'));
  await unlock('contraseña-equivocada');
  ok('contraseña incorrecta no abre',await p.evaluate(()=>!!LOCKED));
  await unlock('clave-segura-123');
  const after=await p.evaluate(()=>({c:S.courses.length,d:S.wellbeing.diary.length,s:S.sessions.length,locked:!!LOCKED}));
  ok('contraseña correcta abre y recupera todo',!after.locked&&after.c===before.c&&after.d===before.d&&after.s===before.s,JSON.stringify(after));

  // los cambios siguen cifrados y persisten
  await p.evaluate(()=>{S.sessions.push({id:'zz1-marcador-plano',date:today(),courseId:S.courses[0].id,minutes:25});save()});
  await p.waitForTimeout(700);r=await raw();
  ok('los cambios nuevos también se guardan cifrados',r.includes('"enc":1')&&!r.includes('marcador-plano'));
  await p.reload();await unlock('clave-segura-123');
  ok('los cambios persisten tras reabrir',await p.evaluate(()=>S.sessions.some(s=>s.id==='zz1-marcador-plano')));

  // respaldo cifrado
  await open('Ajustes','Privacidad');
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('text=Descargar respaldo (JSON)')]);
  const bk=tmp+'/respaldo-cifrado.json';fs.copyFileSync(await dl.path(),bk);const bt=fs.readFileSync(bk,'utf8');
  ok('con cifrado activo el respaldo sale cifrado',dl.suggestedFilename().includes('cifrado')&&bt.includes('"enc":1')&&!bt.includes('Cálculo'),dl.suggestedFilename());

  // cambiar contraseña
  await p.fill('#np1','nueva-clave-456');await p.fill('#np2','nueva-clave-456');await p.click('text=Cambiar contraseña');await p.waitForTimeout(900);
  await p.reload();await unlock('clave-segura-123');
  ok('la contraseña anterior deja de funcionar tras cambiarla',await p.evaluate(()=>!!LOCKED));
  await unlock('nueva-clave-456');
  ok('la contraseña nueva funciona',await p.evaluate(()=>!LOCKED&&S.courses.length===4));

  // desactivar → vuelve a texto plano
  await open('Ajustes','Privacidad');await confirmClick('text=Desactivar cifrado');
  await p.waitForFunction(()=>{const r=localStorage.getItem('entrenador-academico-v1');return !!r&&JSON.parse(r).enc!==1});
  r=await raw();ok('al desactivar, vuelve a guardarse en claro',!r.includes('"enc"')&&JSON.parse(r).courses.length===4);
  await p.reload();ok('abre sin contraseña tras desactivar',await p.evaluate(()=>!LOCKED&&S.courses.length===4));

  // restaurar el respaldo cifrado (con la contraseña antigua)
  await open('Ajustes','Privacidad');
  await p.setInputFiles('input[onchange="importData(this)"]',bk);await confirmOk();await p.waitForTimeout(1200);
  ok('restaurar respaldo cifrado pide la contraseña',await p.evaluate(()=>!!LOCKED));
  await unlock('clave-segura-123');
  ok('el respaldo cifrado se abre con su contraseña original',await p.evaluate(()=>!LOCKED&&S.courses.length===4&&S.sessions.some(s=>s.id==='zz1-marcador-plano')));

  // olvidé la contraseña
  await p.reload();await p.click('text=¿Olvidaste la contraseña?');await confirmClick('text=Borrar los datos cifrados de este navegador');await p.waitForTimeout(500);
  ok('"olvidé la contraseña" borra lo cifrado y deja la app limpia',await p.evaluate(()=>!LOCKED&&S.courses.length===0)&&(await raw())===null||(await raw())&&!(await raw()).includes('"enc"'));

  // borrar todo desactiva el cifrado
  await onboard();
  await open('Ajustes','Privacidad');await p.fill('#np1','clave-segura-123');await p.fill('#np2','clave-segura-123');await confirmClick('text=Activar cifrado');
  await p.waitForFunction(()=>{const r=localStorage.getItem('entrenador-academico-v1');return !!r&&JSON.parse(r).enc===1});
  await confirmClick('text=Borrar todo','BORRAR');await p.waitForTimeout(700);r=await raw();
  ok('"Borrar todo" también desactiva el cifrado',!!r&&!r.includes('"enc"')&&await p.evaluate(()=>!KEYOBJ));

  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(r=>r.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
