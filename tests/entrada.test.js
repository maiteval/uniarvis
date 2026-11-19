const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const newCtx=async(state)=>{
    const ctx=await b.newContext({serviceWorkers:'block'});
    await ctx.addInitScript(s=>{
      try{
        localStorage.setItem('entrenador-academico-tour-seen-v1','1');
        if(s)localStorage.setItem('entrenador-academico-v1',JSON.stringify(s));
      }catch(e){}
      try{document.documentElement.style.scrollBehavior='auto'}catch(e){}
    },state||null);
    await ctx.route('**/*',r=>{
      let u;try{u=new URL(r.request().url())}catch(e){return r.continue()}
      if(/^https?:$/.test(u.protocol)&&u.origin!==local){external.push(u.href);return r.abort()}
      return r.continue();
    });
    return ctx;
  };
  const watch=pg=>{
    pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
    pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
    pg.on('dialog',d=>d.accept());
  };
  const text=pg=>pg.textContent('#app');
  const clean=async(pg,label)=>ok('sin «no oficial» en '+label,!/no oficial/i.test(await text(pg)));
  const confirmOk=async pg=>{
    const d=pg.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    await pg.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };
  const enterPersonal=async(pg,name='Ana',career='Medicina')=>{
    await pg.click('[data-focus-id="account-personal"]');
    if(await pg.locator('#reg-name').count()){
      await pg.fill('#reg-name',name);await pg.fill('#reg-career',career);await pg.locator('.hud-btn').click();
    }
  };
  const submitCode=async pg=>{
    const code=(await pg.textContent('.inst-code')).trim();
    await pg.fill('#inst-code-input',code);await pg.click('[data-focus-id="inst-code-submit"]');
  };

  const ctx=await newCtx(),p=await ctx.newPage();watch(p);
  await p.goto(base);
  ok('almacenamiento vacío: primera pantalla es el selector',
    (await text(p)).includes('¿Cómo quieres usar Uarvis?')&&await p.locator('[data-focus-id="account-personal"]').count()===1&&await p.locator('#reg-name').count()===0);
  await clean(p,'selector inicial');
  await p.click('[data-focus-id="account-personal"]');
  ok('Personal abre el registro con Volver',await p.locator('#reg-name').count()===1&&await p.locator('[data-focus-id="reg-back"]').count()===1&&await p.evaluate(()=>S.account.type===null));
  await p.click('[data-focus-id="reg-back"]');
  ok('Volver del registro regresa al selector',await p.locator('[data-focus-id="account-personal"]').count()===1&&await p.locator('#reg-name').count()===0);
  await enterPersonal(p);
  ok('Personal termina en la app y guarda el modo',(await text(p)).includes('Elige por dónde empezar hoy')&&await p.evaluate(()=>S.account.type==='personal'));
  await p.reload();
  ok('recargar con cuenta Personal entra directo',await p.locator('[data-focus-id="account-personal"]').count()===0&&await p.locator('#reg-name').count()===0&&(await text(p)).includes('Elige por dónde empezar hoy'));
  await ctx.close();

  const ctxMid=await newCtx(),pMid=await ctxMid.newPage();watch(pMid);
  await pMid.goto(base);
  await pMid.click('[data-focus-id="account-personal"]');
  await pMid.fill('#reg-name','Amitad');
  await pMid.reload();
  ok('cerrar a mitad del registro y recargar vuelve al selector',await pMid.locator('[data-focus-id="account-personal"]').count()===1&&await pMid.locator('#reg-name').count()===0&&await pMid.evaluate(()=>S.account.type===null));
  await pMid.click('[data-focus-id="account-institucional"]');
  await pMid.click('[data-focus-id="inst-option-udec"]');
  await pMid.fill('#inst-email','mitad@udec.cl');
  await pMid.reload();
  ok('cerrar a mitad del flujo institucional y recargar vuelve al selector',await pMid.locator('[data-focus-id="account-personal"]').count()===1&&await pMid.locator('#inst-email').count()===0&&await pMid.evaluate(()=>!InstitutionalFlow.get()&&S.account.type===null));
  await ctxMid.close();

  const ctxInst=await newCtx(),pi=await ctxInst.newPage();watch(pi);
  await pi.goto(base);
  await pi.click('[data-focus-id="account-institucional"]');
  ok('selector abre Universidad como primer paso institucional',(await text(pi)).includes('Elige tu universidad')&&await pi.locator('[data-focus-id="inst-option-udec"]').count()===1);
  ok('indicador incluye Tus datos',await pi.locator('.inst-steps span').count()===6&&(await text(pi)).includes('5. Tus datos'));
  await clean(pi,'flujo: Universidad');
  await pi.click('[data-focus-id="account-back"]');
  ok('Volver desde Universidad regresa al selector',await pi.locator('[data-focus-id="account-institucional"]').count()===1&&await pi.evaluate(()=>!InstitutionalFlow.get()));
  await pi.click('[data-focus-id="account-institucional"]');
  await pi.click('[data-focus-id="inst-option-udec"]');
  await clean(pi,'flujo: Correo');
  await pi.fill('#inst-email','ana@udec.cl');await pi.click('[data-focus-id="inst-login"]');
  await pi.waitForSelector('#inst-code-input');
  await clean(pi,'flujo: Código');
  await submitCode(pi);
  await pi.waitForSelector('#inst-pass1');
  await clean(pi,'flujo: Contraseña');
  await pi.fill('#inst-pass1','Clave1234');await pi.fill('#inst-pass2','Clave1234');await pi.click('[data-focus-id="inst-pass-submit"]');
  await pi.waitForSelector('#inst-profile-name');
  ok('después de la contraseña aparece Tus datos con universidad fija',(await text(pi)).includes('Tus datos')&&await pi.evaluate(()=>document.querySelector('#inst-profile-university').disabled&&document.querySelector('#inst-profile-university').value==='Universidad de Concepción')&&await pi.evaluate(()=>InstitutionalFlow.get().step==='profile'&&InstitutionalFlow.get().from==='selection'&&S.account.type===null));
  ok('Volver desde Tus datos regresa a Contraseña',await pi.evaluate(()=>{institutionalBack();return InstitutionalFlow.get().step==='password'})&&await pi.locator('#inst-pass1').count()===1);
  await pi.fill('#inst-pass1','Clave1234');await pi.fill('#inst-pass2','Clave1234');await pi.click('[data-focus-id="inst-pass-submit"]');
  await pi.waitForSelector('#inst-profile-name');
  await clean(pi,'flujo: Tus datos');
  await pi.fill('#inst-profile-name','Ana');await pi.fill('#inst-profile-career','Medicina');await pi.click('[data-focus-id="inst-profile-next"]');
  await pi.waitForSelector('[data-focus-id="inst-consent-ok"]');
  await clean(pi,'flujo: Consentimiento');
  await pi.click('[data-focus-id="inst-consent-ok"]');
  await pi.waitForSelector('[data-focus-id="inst-import-skip"]');
  await clean(pi,'flujo: Importación');
  ok('tras el consentimiento empieza la importación simulada',(await text(pi)).includes('Importando tus datos desde la UdeC'));
  await pi.waitForSelector('[data-focus-id="inst-import-confirm"]',{timeout:5000});
  ok('vista previa de la importación con botón Agregar',(await text(pi)).includes('Revisa lo que traigo desde la UdeC')&&await pi.locator('[data-focus-id="inst-import-confirm"]').count()===1);
  await pi.click('[data-focus-id="inst-import-confirm"]');
  ok('nombre y carrera quedan guardados en S.profile',await pi.evaluate(()=>S.profile.name==='Ana'&&S.profile.career==='Medicina'&&S.profile.university==='Universidad de Concepción'&&S.account.type==='institucional'));
  for(const route of ['inicio','cuenta','perfil','apoyo','semana','ramos','notas','hoy','privacidad']){
    await pi.evaluate(r=>go(r),route);await clean(pi,'modo institucional: '+route);
  }
  await pi.evaluate(()=>{go('inicio');instSessionClear()});
  await pi.reload();
  ok('recargar con cuenta Institucional pide la contraseña',await pi.locator('#inst-login-pass').count()===1&&await pi.locator('[data-focus-id="inst-change-mode"]').count()===1);
  await clean(pi,'inicio de sesión institucional');
  await pi.click('[data-focus-id="inst-change-mode"]');
  ok('Cambiar de modo muestra el selector',await pi.locator('[data-focus-id="account-personal"]').count()===1&&await pi.locator('#inst-login-pass').count()===0);
  await pi.click('[data-focus-id="account-institucional"]');
  ok('elegir Institucional desde Cambiar de modo vuelve al inicio de sesión',await pi.locator('#inst-login-pass').count()===1);
  await pi.click('[data-focus-id="inst-change-mode"]');
  await pi.click('[data-focus-id="account-personal"]');
  ok('elegir Personal desde Cambiar de modo pide confirmación',await pi.locator('#confirm-dialog').isVisible());
  await pi.click('#confirm-ok');
  await pi.waitForFunction(()=>{const t=document.querySelector('#confirm-text');return !!t&&t.textContent.includes('importados')});
  await confirmOk(pi);
  ok('la confirmación desvincula y vuelve a Personal',await pi.evaluate(()=>S.account.type==='personal'&&S.account.auth===null));
  await ctxInst.close();

  const oldState={courses:[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}],
    events:[],tasks:[],sessions:[],profile:{name:'Migrante',career:'Historia',university:'Universidad de Chile'},
    settings:{min:60,theme:'cian',mode:'light',style:'calma'},wellbeing:{diary:[{date:'2026-01-01',mood:3,energy:3,sleep:3,tags:[],note:'DATOS_ANTIGUOS',ts:1}]}};
  const ctxOld=await newCtx(oldState),po=await ctxOld.newPage();watch(po);
  await po.goto(base);
  ok('cuenta antigua con nombre pero sin modo ve el selector',await po.locator('[data-focus-id="account-personal"]').count()===1&&await po.locator('#reg-name').count()===0&&await po.evaluate(()=>S.account.type===null));
  await po.click('[data-focus-id="account-personal"]');
  ok('cuenta antigua elige Personal sin repetir registro y sin perder datos',(await text(po)).includes('Elige por dónde empezar hoy')&&await po.evaluate(()=>S.profile.name==='Migrante'&&S.courses.length===1&&S.wellbeing.diary[0].note==='DATOS_ANTIGUOS'));
  await ctxOld.close();

  const ctxOldInst=await newCtx(oldState),poi=await ctxOldInst.newPage();watch(poi);
  await poi.goto(base);
  await poi.click('[data-focus-id="account-institucional"]');
  await poi.click('[data-focus-id="inst-option-udec"]');
  await poi.fill('#inst-email','mig@udec.cl');await poi.click('[data-focus-id="inst-login"]');
  await submitCode(poi);
  await poi.waitForSelector('#inst-pass1');
  await poi.fill('#inst-pass1','Migra123');await poi.fill('#inst-pass2','Migra123');await poi.click('[data-focus-id="inst-pass-submit"]');
  await poi.waitForSelector('#inst-profile-name');
  ok('cuenta antigua al elegir Institucional ve Tus datos prellenados',await poi.inputValue('#inst-profile-name')==='Migrante'&&await poi.inputValue('#inst-profile-career')==='Historia'&&await poi.evaluate(()=>S.courses.length===1&&S.wellbeing.diary[0].note==='DATOS_ANTIGUOS'));
  await ctxOldInst.close();

  const ctxLock=await newCtx(),pl=await ctxLock.newPage();watch(pl);
  await pl.goto(base);
  await enterPersonal(pl,'Cifrada','Medicina');
  await pl.evaluate(()=>go('privacidad'));
  await pl.fill('#np1','clave-cifrado-1');await pl.fill('#np2','clave-cifrado-1');
  await pl.click('text=Activar cifrado');await confirmOk(pl);
  await pl.waitForFunction(()=>!!KEYOBJ);
  await pl.evaluate(async()=>{linkInstitution('udec','cifrada@udec.cl',await makeInstAuth('Clave1234'));save();await writeQ});
  await pl.reload();
  ok('con cifrado opcional activo primero se pide la contraseña de cifrado',await pl.locator('#lp').count()===1&&await pl.locator('#inst-login-pass').count()===0&&await pl.locator('[data-focus-id="account-personal"]').count()===0);
  await pl.fill('#lp','clave-cifrado-1');await pl.click('text=Desbloquear');
  await pl.waitForSelector('#inst-login-pass',{timeout:10000});
  ok('tras desbloquear se pide la contraseña institucional',await pl.locator('#inst-login-pass').count()===1);
  await ctxLock.close();

  ok('sin peticiones de red externas',external.length===0,external.slice(0,3).join(' | '));
  ok('sin errores en consola',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exitCode=1});
