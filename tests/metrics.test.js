// Métricas anónimas y comentarios: lista blanca, un lote por día, borrado del ID, sin red y universidad institucional.
const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],usage=[],feedback=[],all=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const waitFor=async fn=>{for(let i=0;i<80;i++){if(await fn())return true;await new Promise(r=>setTimeout(r,50))}return false};
  const json=(route,status,obj)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
  const EVENTS=['app_abierta','seccion_vista','pomodoro_completado','flashcards_repasadas','certamen_activado',
    'ics_importado','syllabus_importado','notas_calculadas','amigo_agregado','modo_elegido'];
  const FORBIDDEN=/(energy|mood|sleep|diary|grades|checkin)/i;
  const ALLOWED=['anon_id','evento','seccion','dia','university','career','app_version'];
  const FEEDBACK_ALLOWED=['dia','tipo','mensaje','university','career','app_version'];
  const newCtx=async(withConfig=true,offline=false)=>{
    const ctx=await b.newContext({serviceWorkers:'block'});
    await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
    if(withConfig)await ctx.route('**/js/config.js',r=>r.fulfill({contentType:'text/javascript',
      body:"const SUPABASE_URL='https://supabase.test';const SUPABASE_ANON_KEY='anon-publica';"}));
    if(!offline)await ctx.route('https://supabase.test/**',async r=>{
      const u=new URL(r.request().url()),q=r.request();
      let body=null;try{const raw=q.postData();if(raw)body=JSON.parse(raw)}catch(e){}
      all.push(u.pathname);
      if(u.pathname==='/rest/v1/usage_events'&&q.method()==='POST'){usage.push({body,headers:q.headers()});return json(r,201,[])}
      if(u.pathname==='/rest/v1/feedback'&&q.method()==='POST'){feedback.push({body,headers:q.headers()});return json(r,201,[])}
      return json(r,404,{msg:'Ruta no simulada: '+u.pathname});
    });
    else await ctx.route('https://supabase.test/**',r=>{all.push(new URL(r.request().url()).pathname);r.abort()});
    return ctx;
  };
  const onPage=p=>{
    p.on('pageerror',e=>errs.push('pageerror: '+e.message));
    p.on('dialog',d=>d.accept());
  };
  const onboard=async p=>{
    const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
    if(await p.locator('#reg-name').count()){
      await p.fill('#reg-name','Ana');await p.fill('#reg-career','Medicina');await p.locator('.hud-btn').click();
    }
  };
  const setProfile=async p=>{
    await p.evaluate(()=>go('perfil'));
    await p.fill('#pf-career','Medicina');
    await p.selectOption('#pf-university','Universidad de Concepción');
    await p.click('[data-focus-id="save-profile"]');
  };

  // 1. Apagadas por defecto: ni un evento, ni una petición, ni un ID.
  usage.length=feedback.length=all.length=0;
  const ctx0=await newCtx();const p0=await ctx0.newPage();onPage(p0);
  await p0.goto(base);await onboard(p0);
  await p0.evaluate(()=>{go('hoy');go('notas');go('privacidad');metricsTrack('app_abierta');metricsTrack('checkin',{energy:5})});
  await p0.waitForTimeout(300);
  const off=await p0.evaluate(()=>({state:metricsState(),stored:localStorage.getItem(METRICS_KEY)}));
  ok('estadísticas desactivadas por defecto',off.state.enabled===false&&off.state.anonId===null&&off.stored===null);
  ok('métricas apagadas = ninguna petición',usage.length===0&&all.length===0,JSON.stringify(all));
  const privacyText=await p0.textContent('#app');
  ok('el texto explica qué se envía y qué no',privacyText.includes('Compartir estadísticas de uso anónimas para mejorar Uarvis')&&
    privacyText.includes('Nunca')&&privacyText.includes('día sin hora'));
  await ctx0.close();

  // 2. Encendidas: un solo lote diario, solo la lista blanca y solo claves permitidas.
  usage.length=feedback.length=all.length=0;
  const ctx1=await newCtx();const p1=await ctx1.newPage();onPage(p1);
  await p1.goto(base);await onboard(p1);await setProfile(p1);
  await p1.evaluate(()=>go('privacidad'));
  await p1.click('[data-focus-id="metrics-toggle"]');
  const on=await p1.evaluate(()=>metricsState());
  ok('al activar se genera un ID aleatorio',on.enabled===true&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(on.anonId||''),String(on.anonId));
  await p1.evaluate(()=>{
    metricsTrack('app_abierta');metricsTrack('seccion_vista','hoy');metricsTrack('pomodoro_completado');
    metricsTrack('flashcards_repasadas');metricsTrack('certamen_activado');metricsTrack('ics_importado');
    metricsTrack('syllabus_importado');metricsTrack('notas_calculadas');metricsTrack('amigo_agregado');
    metricsTrack('modo_elegido','personal');
    metricsTrack('checkin_guardado',{energy:5,mood:4,sleep:3,diary:'SECRETO',grades:[6]});
    metricsTrack('calificacion',{grades:[{score:6}],checkin:'x'});
  });
  ok('llega un lote a usage_events',await waitFor(()=>usage.length===1));
  const rows=usage[0].body,raw=JSON.stringify(rows);
  ok('un solo lote por día',usage.length===1&&Array.isArray(rows)&&rows.length===EVENTS.length,String(rows&&rows.length));
  ok('solo eventos de la lista blanca',rows.every(r=>EVENTS.indexOf(r.evento)>=0)&&
    new Set(rows.map(r=>r.evento)).size===EVENTS.length);
  ok('ningún cuerpo contiene claves de bienestar o notas',!FORBIDDEN.test(raw)&&!raw.includes('SECRETO')&&!raw.includes('@'),raw.slice(0,260));
  ok('cada evento lleva solo las claves permitidas',rows.every(r=>Object.keys(r).every(k=>ALLOWED.indexOf(k)>=0)&&
    r.anon_id===on.anonId&&/^\d{4}-\d{2}-\d{2}$/.test(r.dia)&&r.app_version==='1.0.0'));
  ok('sección solo cuando aplica',rows.filter(r=>r.seccion!==undefined).length===2&&
    rows.find(r=>r.evento==='seccion_vista').seccion==='hoy'&&
    rows.find(r=>r.evento==='modo_elegido').seccion==='personal'&&
    rows.filter(r=>r.evento!=='seccion_vista'&&r.evento!=='modo_elegido').every(r=>!('seccion' in r)));
  ok('universidad y carrera se envían solo si están llenas',rows.every(r=>r.university==='Universidad de Concepción'&&r.career==='Medicina'));
  ok('el ID no se liga a la cuenta de Amigos',!('authorization' in usage[0].headers)&&
    !JSON.stringify(usage[0].headers).includes('tk-'));
  await p1.evaluate(()=>{go('perfil');const s=document.querySelector('#pf-university');s.value='Prefiero no decir';saveProfile()});
  const prefs=await p1.evaluate(()=>metricsContext());
  ok('"Prefiero no decir" no se envía',!('university' in prefs)&&prefs.career==='Medicina',JSON.stringify(prefs));
  await p1.evaluate(()=>{go('privacidad');metricsTrack('app_abierta')});
  await p1.waitForTimeout(250);
  const after=await p1.evaluate(()=>metricsState());
  ok('no se envía nada más el mismo día',usage.length===1&&after.queue.length>0,
    usage.length+' petición(es), '+after.queue.length+' en cola');

  // 3. Desactivar borra el ID y la cola.
  await p1.click('[data-focus-id="metrics-toggle"]');
  const cleared=await p1.evaluate(()=>({state:metricsState(),stored:localStorage.getItem(METRICS_KEY),track:metricsTrack('app_abierta')}));
  ok('desactivar borra el ID y la cola pendiente',cleared.state.anonId===null&&cleared.state.queue.length===0&&cleared.stored===null&&cleared.track===false);
  await p1.waitForTimeout(250);
  ok('tras desactivar no se envía la cola borrada',usage.length===1);
  await ctx1.close();

  // 4. Sin red: silencio, sin errores visibles y la cola se conserva.
  usage.length=feedback.length=all.length=0;
  const ctx2=await newCtx(true,true);const p2=await ctx2.newPage();
  const pageErrors=[];p2.on('pageerror',e=>pageErrors.push(e.message));p2.on('dialog',d=>d.accept());
  await p2.goto(base);await onboard(p2);
  await p2.evaluate(()=>go('privacidad'));
  await p2.click('[data-focus-id="metrics-toggle"]');
  await p2.evaluate(()=>metricsTrack('app_abierta'));
  await p2.waitForTimeout(300);
  const noNet=await p2.evaluate(()=>({s:metricsState(),toast:(document.querySelector('#toast')||{}).textContent||''}));
  ok('sin red no aparece ningún error',pageErrors.length===0&&!/error|fall|no se pudo/i.test(noNet.toast),noNet.toast);
  ok('sin red no hay peticiones registradas y la cola espera',usage.length===0&&noNet.s.queue.length>0&&noNet.s.lastSentDay!==null);
  await ctx2.close();

  // 5. Comentarios con Supabase simulado.
  usage.length=feedback.length=all.length=0;
  const ctx3=await newCtx();const p3=await ctx3.newPage();onPage(p3);
  await p3.goto(base);await onboard(p3);await setProfile(p3);
  await p3.evaluate(()=>go('privacidad'));
  await p3.fill('#fb-text','Me gustaría ver más ejemplos.');
  await p3.selectOption('#fb-type','idea');
  await p3.click('[data-focus-id="feedback-send"]');
  ok('comentario enviado a feedback',await waitFor(()=>feedback.length===1));
  const fb=feedback[0].body;
  ok('feedback lleva solo los campos permitidos',fb&&Object.keys(fb).every(k=>FEEDBACK_ALLOWED.indexOf(k)>=0)&&
    fb.tipo==='idea'&&fb.mensaje==='Me gustaría ver más ejemplos.'&&/^\d{4}-\d{2}-\d{2}$/.test(fb.dia)&&
    fb.app_version==='1.0.0'&&fb.university==='Universidad de Concepción'&&fb.career==='Medicina',JSON.stringify(fb));
  ok('comentario sin claves de bienestar ni notas',!FORBIDDEN.test(JSON.stringify(fb)));
  ok('comentario no se liga a una cuenta',!('authorization' in feedback[0].headers));
  ok('enviar comentario no activa métricas',usage.length===0&&(await p3.evaluate(()=>metricsState().enabled))===false);
  await ctx3.close();

  // 6. Sin Supabase: ofrece copiar al portapapeles y no contacta al servidor.
  usage.length=feedback.length=all.length=0;
  const ctx4=await b.newContext({serviceWorkers:'block'});
  await ctx4.addInitScript(()=>{
    try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.__copied=t}}});
  });
  await ctx4.route('https://supabase.test/**',r=>{all.push('sin-config');r.abort()});
  const p4=await ctx4.newPage();onPage(p4);
  await p4.goto(base);await onboard(p4);
  await p4.evaluate(()=>go('privacidad'));
  const copyBtn=p4.locator('[data-focus-id="feedback-copy"]');
  ok('sin Supabase ofrece copiar el comentario',await copyBtn.isVisible());
  await p4.fill('#fb-text','Copiar este texto');
  await copyBtn.click();
  await p4.waitForFunction(()=>window.__copied==='Copiar este texto');
  ok('copia el texto al portapapeles',await p4.evaluate(()=>window.__copied)==='Copiar este texto');
  await p4.click('[data-focus-id="feedback-send"]');await p4.waitForTimeout(200);
  ok('sin Supabase el envío no hace peticiones',all.length===0&&feedback.length===0,JSON.stringify(all));
  await ctx4.close();

  // 7. Migración y universidad institucional.
  const ctx5=await b.newContext({serviceWorkers:'block'});
  await ctx5.addInitScript(estado=>{
    try{
      localStorage.setItem('entrenador-academico-tour-seen-v1','1');
      localStorage.setItem('entrenador-academico-v1',JSON.stringify(estado));
    }catch(e){}
  },{courses:[],classes:[],events:[],tasks:[],sessions:[],profile:{name:'Diego',career:'Ingeniería'},
    settings:{min:60,theme:'cian',mode:'light',style:'calma'}});
  const p5=await ctx5.newPage();onPage(p5);
  await p5.goto(base);
  const mig=await p5.evaluate(()=>({u:S.profile.university,old:cleanState({courses:[],classes:[],events:[],tasks:[],sessions:[],profile:{name:'X'}}).profile.university}));
  ok('perfiles y respaldos antiguos migran con university vacía',mig.u===''&&mig.old==='',JSON.stringify(mig));
  await p5.evaluate(async()=>{linkInstitution('udec','ana@udec.cl',await makeInstAuth('Clave1234'));instSessionSet();save();go('perfil')});
  const inst=await p5.evaluate(()=>({u:S.profile.university,disabled:document.querySelector('#pf-university').disabled,
    value:document.querySelector('#pf-university').value}));
  ok('modo institucional completa la universidad desde la cuenta',inst.u==='Universidad de Concepción'&&inst.disabled&&inst.value===inst.u,JSON.stringify(inst));
  await p5.evaluate(()=>{document.querySelector('#pf-university').value='Otra';saveProfile()});
  ok('la universidad institucional no se puede editar en Perfil',await p5.evaluate(()=>S.profile.university==='Universidad de Concepción'));
  await ctx5.close();

  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(r=>r.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
