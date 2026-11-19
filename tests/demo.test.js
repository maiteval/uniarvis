const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];
  fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],external=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const ANA='b2222222-2222-4222-8222-222222222222';
  const BETO='c3333333-3333-4333-8333-333333333333';
  const aviso='Modo demo: los amigos y sus datos son de ejemplo. Nada se envía a ningún lado.';
  const waitFor=async fn=>{for(let i=0;i<120;i++){if(await fn())return true;await new Promise(r=>setTimeout(r,50))}return false};
  const local=new URL(base).origin;
  const open=async(sec,sub)=>{
    await p.locator('.brand').click();
    if(sec!=='Inicio')await p.locator('.home-card').filter({hasText:sec}).click();
    if(sub)await p.click('nav >> text="'+sub+'"');
  };
  const confirmClick=async(sel)=>{
    await p.click(sel);
    const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    await p.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };

  const ctx=await b.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await ctx.route('**/js/config.js',r=>r.fulfill({contentType:'text/javascript',
    body:"const SUPABASE_URL='';const SUPABASE_ANON_KEY='';"}));
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());
  p.on('request',r=>{try{const u=new URL(r.url());if(/^https?:$/.test(u.protocol)&&u.origin!==local)external.push(r.url())}catch(e){}});

  await p.goto(base);
  const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
  if(await p.locator('#reg-name').count()){
    await p.fill('#reg-name','Estudiante');await p.fill('#reg-career','Carrera');
    await p.locator('.hud-btn').click();
  }
  await p.evaluate(()=>{
    S=fresh();S.profile={name:'Estudiante',career:'Carrera'};S.account.type='personal';
    S.consent={health:true,at:today()};
    S.courses=[{id:'c1',name:'Cálculo III',difficulty:3,color:'#3b6df0',grades:[],share:false},
      {id:'c2',name:'Economía',difficulty:2,color:'#e0693a',grades:[],share:false}];
    replanAll();
  });
  await open('Social');
  ok('sin configurar ofrece el modo demo',(await p.textContent('#app')).includes('Probar con datos de ejemplo'));
  ok('sin configurar no hay peticiones externas',external.length===0,String(external.length));

  await p.click('text=Probar con datos de ejemplo');
  ok('aviso de modo demo visible',(await p.textContent('#app')).includes(aviso));
  ok('activar demo no contacta a ningún servidor',external.length===0,String(external.length));

  await p.fill('#soc-email','cualquiera@correo.cl');await p.click('text=Enviar código');
  await p.waitForSelector('#soc-code-otp');
  ok('login demo acepta cualquier correo',(await p.textContent('#app')).includes('cualquier correo'));
  await p.fill('#soc-code-otp','999999');await p.click('text=Ingresar código');
  await p.waitForSelector('#soc-name',{timeout:10000});
  ok('login demo acepta cualquier código de 6 dígitos',true);
  await p.fill('#soc-name','Yo demo');await p.click('text=Crear mi perfil');
  ok('perfil demo listo',await waitFor(()=>p.evaluate(()=>SOC.ready&&!!SOC.profile)));

  ok('tres amigos de ejemplo',await p.evaluate(()=>SOC.friends.length===3),String(await p.evaluate(()=>SOC.friends.length)));
  ok('una solicitud pendiente de ejemplo',await p.evaluate(()=>SOC.incoming.length===1&&SOC.incoming[0].person.display_name==='Diego'));
  ok('dos invitaciones a sesiones',await p.evaluate(()=>SOC.sessions.filter(s=>s.mine==='invited').length===2));
  ok('fechas de amigos en las próximas semanas',await p.evaluate(()=>{const t=today();return SOC.shared.length>=4&&SOC.shared.every(e=>e.date>t)}));
  ok('el aviso sigue visible con la sesión iniciada',(await p.textContent('#app')).includes(aviso));
  ok('la sesión demo no se guarda en localStorage',await p.evaluate(()=>localStorage.getItem('entrenador-academico-social-v1')===null));
  const guardado=await p.evaluate(()=>localStorage.getItem('entrenador-academico-v1')||'');
  ok('los amigos demo no entran en S ni en el respaldo',!/ANADEMOX|Repaso de derivadas|Diego|BETODEMO/.test(guardado));

  await p.fill('#ss-title','Sesión demo');
  await p.fill('#ss-course','Cálculo III');
  await p.fill('#ss-date',await p.evaluate(()=>addDays(today(),2)));
  await p.fill('#ss-start','17:00');await p.fill('#ss-end','18:00');
  await p.check('input[name="ss-guest"][value="'+ANA+'"]');
  await p.check('input[name="ss-guest"][value="'+BETO+'"]');
  await p.click('text=Crear sesión');
  ok('sesión creada en modo demo',await waitFor(()=>p.evaluate(()=>SOC.sessions.some(s=>s.title==='Sesión demo'))));
  ok('amigos de ejemplo aceptan solos',await waitFor(()=>p.evaluate(()=>{const s=SOC.sessions.find(x=>x.title==='Sesión demo');return !!s&&s.invites.filter(i=>i.status==='accepted').length>=2})));
  ok('aparece el aviso de aceptación',(await p.textContent('#app')).includes('aceptaron tu sesión "Sesión demo"'));

  const before=await p.evaluate(()=>S.events.length);
  await p.locator('text=Agregar a mis fechas').first().click();
  await waitFor(n=>p.evaluate(n=>S.events.length>n,before));
  ok('importar fecha demo la agrega a mis fechas reales',await p.evaluate(a=>S.events.some(e=>e.title==='Certamen de derivadas'&&e.src&&e.src.owner===a),ANA));
  ok('la fecha importada queda en el respaldo local',(await p.evaluate(()=>localStorage.getItem('entrenador-academico-v1')||'')).includes('Certamen de derivadas'));

  await confirmClick('text=Salir del modo demo');
  await waitFor(()=>p.evaluate(()=>!SOC.demo));
  ok('salir vuelve al aviso sin configurar',(await p.textContent('#app')).includes('Prototipo')&&(await p.textContent('#app')).includes('Probar con datos de ejemplo'));
  ok('ningún flujo demo hizo peticiones de red',external.length===0,external.slice(0,3).join(' | '));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exitCode=1});
