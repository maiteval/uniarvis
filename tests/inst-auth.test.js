// Pruebas del prototipo de autenticación institucional (sin backend ni red).
const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const local=new URL(base).origin;
  const newCtx=async()=>{
    const ctx=await b.newContext({serviceWorkers:'block',acceptDownloads:true});
    await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
    await ctx.route('**/*',r=>{
      let u;try{u=new URL(r.request().url())}catch(e){return r.continue()}
      if(/^https?:$/.test(u.protocol)&&u.origin!==local){external.push(u.href);return r.abort()}
      return r.continue();
    });
    return ctx;
  };
  const pageEvents=(pg,tag)=>{
    pg.on('pageerror',e=>errs.push(tag+' pageerror: '+e.message));
    pg.on('console',m=>{if(m.type()==='error')errs.push(tag+' console: '+m.text())});
    pg.on('dialog',d=>d.accept());
  };
  const ctx=await newCtx(),p=await ctx.newPage();pageEvents(p,'auth');
  const text=pg=>pg.textContent('#app');
  const confirmOk=async(pg,word)=>{
    const d=pg.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    if(word)await pg.fill('#confirm-word',word);
    await pg.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };
  const codeOf=async(pg)=>(await pg.textContent('.inst-code')).trim();
  const wrong=code=>code==='000000'?'111111':'000000';
  const onboard=async(pg)=>{
    await pg.goto(base);
    await pg.click('[data-focus-id="account-personal"]');
    if(await pg.locator('#reg-name').count()){
      await pg.fill('#reg-name','Ana');await pg.fill('#reg-career','Medicina');await pg.locator('.hud-btn').click();
    }
  };
  const startFlow=async(pg,email='ana@udec.cl')=>{
    await pg.evaluate(()=>{S.institutionConsentAt=today();save();go('cuenta')});
    await pg.click('[data-focus-id="connect-institution"]');
    await pg.click('[data-focus-id="inst-option-udec"]');
    await pg.fill('#inst-email',email);await pg.click('[data-focus-id="inst-login"]');
    await pg.waitForSelector('#inst-code-input');
  };
  const verify=async(pg,code)=>{
    await pg.fill('#inst-code-input',code);await pg.click('[data-focus-id="inst-code-submit"]');
  };
  const createPass=async(pg,pass)=>{
    await pg.fill('#inst-pass1',pass);await pg.fill('#inst-pass2',pass);await pg.click('[data-focus-id="inst-pass-submit"]');
    await pg.waitForFunction(()=>!InstitutionalFlow.get()||!!document.querySelector('[data-focus-id="inst-consent-ok"]')||!!document.querySelector('[data-focus-id="inst-import-skip"]'));
    if(await pg.locator('[data-focus-id="inst-consent-ok"]').count())await pg.click('[data-focus-id="inst-consent-ok"]');
  };
  const signIn=async(pg,pass='Clave1234')=>{
    await pg.fill('#inst-login-pass',pass);await pg.click('[data-focus-id="inst-login-submit"]');
    await pg.waitForSelector('#inst-login-pass',{state:'detached'});
  };
  const logout=async(pg)=>{
    await pg.evaluate(()=>go('cuenta'));await pg.click('[data-focus-id="inst-logout"]');await pg.waitForSelector('#inst-login-pass');
  };

  await onboard(p);
  ok('el modo Personal no pide nada de autenticación institucional',
    await p.locator('#inst-login-pass').count()===0&&await p.evaluate(()=>!needsInstLogin()&&!needsInstitutionSetup()));
  await startFlow(p);
  const firstCode=await codeOf(p);
  ok('el correo genera un código de 6 dígitos y muestra la bandeja simulada',
    /^\d{6}$/.test(firstCode)&&(await text(p)).includes('Bandeja de entrada simulada')&&
    await p.evaluate(()=>InstitutionalFlow.get().code.length===6&&!('code' in S)&&!localStorage.getItem('entrenador-academico-v1').includes(InstitutionalFlow.get().code)),firstCode);

  for(let i=0;i<5;i++){
    await verify(p,wrong(firstCode));
    await p.waitForFunction(n=>{const f=InstitutionalFlow.get();return f.attempts===n},i+1);
  }
  const failText=await text(p);
  ok('código incorrecto muestra intentos restantes',failText.includes('Código incorrecto. Te quedan 0 intentos.'));
  ok('tras 5 fallos exige pedir uno nuevo',failText.includes('Pide un código nuevo.')&&
    await p.evaluate(()=>InstitutionalFlow.get().needsResend===true));
  ok('Reenviar código respeta los 30 segundos',
    await p.locator('[data-focus-id="inst-resend"]').isDisabled()&&
    await p.evaluate(()=>Math.round((InstitutionalFlow.get().resendAt-Date.now())/1000)<=30)&&
    (await text(p)).includes('Reenviar código'));
  await p.evaluate(()=>{const f=InstitutionalFlow.get();f.resendAt=Date.now()-1;render()});
  await p.click('[data-focus-id="inst-resend"]');
  const secondCode=await codeOf(p);
  ok('reenviar invalida el código anterior y reinicia los intentos',secondCode!==firstCode&&
    await p.evaluate(()=>{const f=InstitutionalFlow.get();return f.attempts===0&&!f.needsResend}));
  await verify(p,firstCode);
  ok('el código anterior ya no sirve',(await text(p)).includes('Código incorrecto. Te quedan 4 intentos.'));
  await p.evaluate(()=>{InstitutionalFlow.get().expiresAt=Date.now()-1;render()});
  await verify(p,secondCode);
  ok('un código vencido se rechaza con mensaje claro',(await text(p)).includes('El código venció. Pide uno nuevo.'));
  await p.evaluate(()=>{const f=InstitutionalFlow.get();f.resendAt=Date.now()-1;render()});
  await p.click('[data-focus-id="inst-resend"]');
  const finalCode=await codeOf(p);
  await p.fill('#inst-code-input',finalCode);
  ok('acepta pegar el código completo',await p.inputValue('#inst-code-input')===finalCode);
  await p.click('[data-focus-id="inst-code-submit"]');
  await p.waitForSelector('#inst-pass1');
  ok('código correcto pasa a Contraseña',await p.evaluate(()=>InstitutionalFlow.get().step==='password'));

  await p.fill('#inst-pass1','abc');
  await p.evaluate(()=>instPasswordInput());
  ok('contraseña corta no cumple y se marca débil',
    !(await p.locator('#inst-rule-len').getAttribute('class')).includes('ok')&&
    (await p.textContent('#inst-pass-strength'))==='Débil');
  await p.fill('#inst-pass1','Abcdefgh');await p.evaluate(()=>instPasswordInput());
  ok('exige al menos un número',!(await p.locator('#inst-rule-number').getAttribute('class')).includes('ok'));
  await p.fill('#inst-pass1','Abcdefg1');await p.evaluate(()=>instPasswordInput());
  ok('8 caracteres, letra y número cumplen los requisitos en vivo',
    (await p.locator('#inst-rule-len').getAttribute('class')).includes('ok')&&
    (await p.locator('#inst-rule-letter').getAttribute('class')).includes('ok')&&
    (await p.locator('#inst-rule-number').getAttribute('class')).includes('ok'));
  await p.fill('#inst-pass2','Otra1234');await p.click('[data-focus-id="inst-pass-submit"]');
  ok('las contraseñas deben coincidir',(await text(p)).includes('Las contraseñas no coinciden.'));
  await p.fill('#inst-pass1','Abcdefg1');await p.fill('#inst-pass2','Abcdefg1');await p.click('[data-focus-id="inst-pass-submit"]');
  await p.waitForFunction(()=>InstitutionalFlow.get()===null);
  const saved=await p.evaluate(()=>({auth:{...S.account.auth},raw:localStorage.getItem('entrenador-academico-v1'),ss:JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))}));
  ok('guarda solo salt y hash PBKDF2 con sal de 16 bytes',
    saved.auth.it===250000&&/^[A-Za-z0-9+/]+={0,2}$/.test(saved.auth.salt)&&
    Buffer.from(saved.auth.salt,'base64').length===16&&Buffer.from(saved.auth.hash,'base64').length===32&&
    !Number.isNaN(new Date(saved.auth.createdAt).getTime()),JSON.stringify(saved.auth));
  ok('ni localStorage ni sessionStorage contienen contraseña, código o hash de sesión',
    !saved.raw.includes('Abcdefg1')&&!saved.raw.includes(finalCode)&&saved.raw.includes('"salt"')&&
    !saved.ss.includes('Abcdefg1')&&!saved.ss.includes(finalCode)&&!saved.ss.includes('hash')&&
    Object.keys(JSON.parse(saved.ss)).length===1);

  await p.evaluate(()=>instSessionClear());
  await p.reload();
  ok('al recargar pide la contraseña institucional antes que cualquier vista',
    await p.locator('#inst-login-pass').count()===1&&
    await p.evaluate(()=>document.querySelector('#inst-login-email').readOnly&&document.querySelector('#inst-login-email').value==='ana@udec.cl')&&
    await p.getAttribute('#inst-login-pass','autocomplete')==='current-password');
  await p.fill('#inst-login-pass','Mala1234');await p.click('[data-focus-id="inst-login-submit"]');
  await p.waitForFunction(()=>instAuthFailures===1);
  ok('contraseña incorrecta falla y muestra intentos',(await text(p)).includes('Contraseña incorrecta. Te quedan 4 intentos.'));
  await signIn(p,'Abcdefg1');
  ok('contraseña correcta entra',await p.evaluate(()=>!needsInstLogin()&&instSessionActive()));

  await logout(p);
  for(let i=0;i<5;i++){
    await p.fill('#inst-login-pass','Mala1234');await p.click('[data-focus-id="inst-login-submit"]');
    await p.waitForFunction(n=>instAuthFailures===n||instAuthLockUntil>0,Math.min(i+1,5));
  }
  ok('5 contraseñas incorrectas activan espera de 30 segundos',
    (await text(p)).includes('Espera 30 segundos')&&await p.locator('[data-auth-countdown]').count()===1&&
    await p.locator('[data-focus-id="inst-login-submit"]').isDisabled());
  await p.evaluate(()=>{instAuthLockUntil=Date.now()-1;render()});
  await signIn(p,'Abcdefg1');
  ok('terminada la espera se puede entrar',await p.evaluate(()=>!needsInstLogin()&&instAuthFailures===0));

  await p.reload();
  ok('la sesión se mantiene al recargar en la misma pestaña',await p.locator('#inst-login-pass').count()===0&&
    await p.evaluate(()=>sessionStorage.getItem('uarvis-inst-session-v1')==='1'));
  await logout(p);
  await p.reload();
  ok('Cerrar sesión termina la sesión también tras recargar',await p.locator('#inst-login-pass').count()===1);
  await signIn(p,'Abcdefg1');

  await p.evaluate(()=>go('cuenta'));
  const oldHash=await p.evaluate(()=>S.account.auth.hash);
  await p.click('[data-focus-id="inst-change-password"]');
  await p.fill('#inst-current-pass','Abcdefg1');await p.fill('#inst-new-pass','Nueva1234');await p.fill('#inst-new-pass2','Nueva1234');
  await p.click('[data-focus-id="inst-save-password"]');
  await p.waitForFunction(h=>S.account.auth.hash!==h,oldHash,{timeout:10000});
  ok('Cambiar contraseña guarda un hash nuevo',await p.evaluate(h=>S.account.auth.hash!==h,oldHash));
  await logout(p);
  await p.fill('#inst-login-pass','Abcdefg1');await p.click('[data-focus-id="inst-login-submit"]');
  await p.waitForFunction(()=>instAuthFailures===1);
  ok('la contraseña anterior deja de funcionar',(await text(p)).includes('Contraseña incorrecta.'));
  await signIn(p,'Nueva1234');

  await logout(p);
  await p.click('[data-focus-id="inst-forgot-pass"]');
  await p.waitForSelector('#inst-code-input');
  ok('¿Olvidaste tu contraseña? envía un nuevo código a la bandeja simulada',
    (await text(p)).includes('Bandeja de entrada simulada')&&/^\d{6}$/.test(await codeOf(p))&&
    await p.evaluate(()=>InstitutionalFlow.get().from==='forgot'));
  await verify(p,await codeOf(p));await p.waitForSelector('#inst-pass1');
  await createPass(p,'Otra1234');await p.waitForFunction(()=>InstitutionalFlow.get()===null);
  await logout(p);
  await p.fill('#inst-login-pass','Nueva1234');await p.click('[data-focus-id="inst-login-submit"]');
  await p.waitForFunction(()=>instAuthFailures===1);
  ok('la contraseña anterior falla tras recuperación',(await text(p)).includes('Contraseña incorrecta.'));
  await signIn(p,'Otra1234');

  await logout(p);
  await p.click('[data-focus-id="inst-change-mode"]');
  ok('Cambiar de modo desde el inicio de sesión muestra el selector',await p.locator('[data-focus-id="account-personal"]').count()===1&&await p.locator('#inst-login-pass').count()===0);
  await p.click('[data-focus-id="account-personal"]');
  await confirmOk(p);
  if(await p.locator('#confirm-dialog').isVisible())await confirmOk(p);
  ok('Cambiar de modo a Personal pide confirmación y desvincula',
    await p.evaluate(()=>S.account.type==='personal'&&S.account.auth===null&&!instSessionActive()&&!needsInstLogin()));
  await p.reload();
  ok('el modo Personal no vuelve a pedir credenciales',await p.locator('#inst-login-pass').count()===0&&
    await p.locator('#inst-code-input').count()===0);

  await p.evaluate(async()=>{
    S=fresh();S.profile={name:'Migrante',career:'Ingeniería'};
    S.account={type:'institucional',institutionId:'udec',email:'mig@udec.cl',linkedAt:today(),auth:null};
    S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],passGrade:4,roundFinal:true}];
    S.wellbeing.diary=[{date:today(),mood:4,energy:3,sleep:3,tags:[],note:'DATOS_MIGRADOS',ts:1}];
    instSessionClear();save();render();
  });
  ok('una cuenta institucional antigua sin auth pide Código y Contraseña',
    await p.locator('#inst-code-input').count()===1&&(await text(p)).includes('mig@udec.cl')&&
    await p.evaluate(()=>InstitutionalFlow.get().step==='code'&&InstitutionalFlow.get().from==='migration'));
  ok('la migración no borra los datos',await p.evaluate(()=>S.courses.length===1&&S.wellbeing.diary[0].note==='DATOS_MIGRADOS'));
  ok('la cuenta antigua conserva el nombre manual como apodo y usa el del directorio',await p.evaluate(()=>{
    const demo=fetchInstitutionProfileSync('udec',S.account.email);
    return S.profile.name===demo.name&&S.profile.nickname==='Migrante'&&S.profile.career===demo.career&&S.profile.university==='Universidad de Concepción'&&S.account.studentId===demo.studentId;
  }));
  const migCode=await codeOf(p);
  await verify(p,migCode);await p.waitForSelector('#inst-pass1');
  await createPass(p,'Migra123');await p.waitForFunction(()=>InstitutionalFlow.get()===null);
  ok('la migración termina con auth y sin perder datos',
    await p.evaluate(()=>!!S.account.auth&&S.account.email==='mig@udec.cl'&&S.courses.length===1&&S.wellbeing.diary[0].note==='DATOS_MIGRADOS'));

  await p.evaluate(()=>go('privacidad'));
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('text=Descargar respaldo (JSON)')]);
  const bkPath=tmp+'/respaldo-inst-auth.json';fs.copyFileSync(await dl.path(),bkPath);
  const backup=fs.readFileSync(bkPath,'utf8');
  ok('el respaldo exportado no contiene la contraseña ni el código',
    backup.includes('"auth"')&&backup.includes('"salt"')&&backup.includes('"hash"')&&!backup.includes('Migra123')&&
    !backup.includes(migCode));
  const bad=JSON.parse(backup);bad.account.auth.password='Migra123';
  const badPath=tmp+'/respaldo-auth-invalido.json';fs.writeFileSync(badPath,JSON.stringify(bad));
  await p.evaluate(()=>{S=fresh();S.profile={name:'Ana',career:'Medicina'};S.account.type='personal';save();render()});
  await p.setInputFiles('input[onchange="importData(this)"]',badPath);await p.waitForTimeout(150);
  ok('un respaldo con auth inválida se rechaza al importar',
    await p.evaluate(()=>S.account.type==='personal'&&S.account.auth===null)&&
    (await p.textContent('#toast')).includes('cuenta'));

  await p.evaluate(async()=>{S.account={type:'institucional',institutionId:'udec',email:'ana@udec.cl',linkedAt:today(),auth:await makeInstAuth('Clave1234')};instSessionSet();save();go('privacidad')});
  await p.click('text=Borrar todo');await confirmOk(p,'BORRAR');await p.waitForTimeout(200);
  ok('Borrar todo elimina S.account.auth',await p.evaluate(()=>S.account.auth===null&&S.account.type===null));

  const ctx2=await newCtx(),p2=await ctx2.newPage();pageEvents(p2,'cifrado');
  await onboard(p2);
  await p2.evaluate(()=>go('privacidad'));
  await p2.fill('#np1','clave-cifrado-1');await p2.fill('#np2','clave-cifrado-1');
  await p2.click('text=Activar cifrado');await confirmOk(p2);
  await p2.waitForFunction(()=>{const r=localStorage.getItem('entrenador-academico-v1');return !!r&&JSON.parse(r).enc===1});
  await p2.evaluate(async()=>{linkInstitution('udec','ana@udec.cl',await makeInstAuth('Clave1234'));save();await writeQ});
  await p2.reload();
  ok('con cifrado activo primero se pide la contraseña de cifrado',
    await p2.locator('#lp').count()===1&&await p2.locator('#inst-login-pass').count()===0);
  await p2.fill('#lp','clave-cifrado-1');await p2.click('text=Desbloquear');
  await p2.waitForSelector('#inst-login-pass',{timeout:10000});
  ok('descifrado el estado se pide la contraseña institucional',await p2.locator('#inst-login-pass').count()===1);
  await signIn(p2,'Clave1234');
  ok('cifrado e institucional funcionan en serie sin romper el cifrado',
    await p2.evaluate(()=>!LOCKED&&!!KEYOBJ&&!needsInstLogin()));

  ok('sin peticiones de red externas',external.length===0,external.slice(0,3).join(' | '));
  ok('sin errores en consola',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exitCode=1});
