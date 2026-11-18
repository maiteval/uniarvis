const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const base=process.argv[2],tmp=process.argv[3];
  fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const res=[],errs=[],requests=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  const ME='11111111-1111-4111-8111-111111111111';
  const ANA='22222222-2222-4222-8222-222222222222';
  const BETO='33333333-3333-4333-8333-333333333333';
  const DB={profiles:{},friendships:[],sessions:[],invites:[],shared:[],otp:null,seq:0};
  DB.profiles[ANA]={id:ANA,display_name:'Ana',friend_code:'FRIENAAA'};
  DB.profiles[BETO]={id:BETO,display_name:'Beto',friend_code:'BETOAAAA'};
  DB.friendships.push({id:'fr-in-1',requester:BETO,addressee:ME,status:'pending'});
  const json=(route,status,obj)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj)});
  const empty=route=>route.fulfill({status:204});
  const idsFrom=raw=>{const out=[],re=/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g;let m;while((m=re.exec(raw||'')))out.push(m[0]);return out};
  const visibleSessions=()=>DB.sessions.filter(s=>s.host===ME||DB.invites.some(i=>i.session_id===s.id&&i.user_id===ME));
  const waitFor=async fn=>{for(let i=0;i<60;i++){if(await fn())return true;await new Promise(r=>setTimeout(r,50))}return false};
  const setup=async ctx=>{
    await ctx.route('**/js/config.js',r=>r.fulfill({contentType:'text/javascript',
      body:"const SUPABASE_URL='https://supabase.test';const SUPABASE_ANON_KEY='anon-publica';"}));
    await ctx.route('https://supabase.test/**',async r=>{
      const q=r.request(),u=new URL(q.url()),p=u.pathname,params=u.searchParams,method=q.method();
      let body=null;
      try{const raw=q.postData();if(raw)body=JSON.parse(raw)}catch(e){}
      requests.push({url:p,method,body,headers:q.headers()});
      if(p==='/auth/v1/otp'&&method==='POST')return json(r,200,{});
      if(p==='/auth/v1/token'&&method==='POST')return json(r,200,{access_token:'tk-'+(++DB.seq),refresh_token:'rf',expires_in:3600});
      if(p==='/auth/v1/verify'&&method==='POST'){
        if(body&&body.token==='123456')return json(r,200,{access_token:'tk-1',refresh_token:'rf-1',expires_in:3600,user:{id:ME,email:body.email}});
        return json(r,400,{msg:'Código incorrecto.'});
      }
      if(p==='/rest/v1/profiles'&&method==='GET'){
        const id=params.get('id')||'';
        if(id.startsWith('eq.'))return json(r,200,DB.profiles[id.slice(3)]?[DB.profiles[id.slice(3)]]:[]);
        if(id.startsWith('in.'))return json(r,200,idsFrom(id).map(x=>DB.profiles[x]).filter(Boolean));
        return json(r,200,[]);
      }
      if(p==='/rest/v1/profiles'&&method==='POST'){
        DB.profiles[body.id]={id:body.id,display_name:body.display_name,friend_code:body.friend_code};
        return json(r,201,[DB.profiles[body.id]]);
      }
      if(p==='/rest/v1/friendships'&&method==='GET'){
        const me=idsFrom(params.get('or')||'')[0]||ME;
        return json(r,200,DB.friendships.filter(f=>f.requester===me||f.addressee===me));
      }
      if(p==='/rest/v1/friendships'&&method==='DELETE')return empty(r);
      if(p==='/rest/v1/rpc/send_friend_request'&&method==='POST'){
        const target=Object.values(DB.profiles).find(x=>x.friend_code===String(body.code).toUpperCase());
        DB.otp=body.code;
        if(!target)return json(r,400,{msg:'No encontramos ese código de amigo.'});
        const inv=DB.friendships.find(f=>f.requester===target.id&&f.addressee===ME&&f.status==='pending');
        if(inv)inv.status='accepted';
        else if(!DB.friendships.some(f=>f.requester===ME&&f.addressee===target.id))DB.friendships.push({id:'fr-'+(++DB.seq),requester:ME,addressee:target.id,status:'pending'});
        return json(r,200,null);
      }
      if(p==='/rest/v1/rpc/respond_friend_request'&&method==='POST'){
        const f=DB.friendships.find(x=>x.id===body.id&&x.addressee===ME);
        if(!f)return json(r,400,{msg:'No encontramos esa solicitud.'});
        if(body.accept)f.status='accepted';else DB.friendships=DB.friendships.filter(x=>x!==f);
        return json(r,200,null);
      }
      if(p==='/rest/v1/rpc/remove_friend'&&method==='POST'){
        DB.friendships=DB.friendships.filter(f=>!(f.status==='accepted'&&((f.requester===ME&&f.addressee===body.other)||(f.addressee===ME&&f.requester===body.other))));
        return json(r,200,null);
      }
      if(p==='/rest/v1/rpc/restore_friend'&&method==='POST'){
        if(!DB.friendships.some(f=>f.status==='accepted'&&((f.requester===ME&&f.addressee===body.other)||(f.addressee===ME&&f.requester===body.other))))
          DB.friendships.push({id:'fr-'+(++DB.seq),requester:ME,addressee:body.other,status:'accepted'});
        return json(r,200,null);
      }
      if(p==='/rest/v1/study_sessions'&&method==='GET')return json(r,200,visibleSessions());
      if(p==='/rest/v1/study_sessions'&&method==='POST'){
        const s=Object.assign({id:'s-'+(++DB.seq)},body);DB.sessions.push(s);return json(r,201,[s]);
      }
      if(p==='/rest/v1/study_sessions'&&method==='DELETE'){
        const id=(params.get('id')||'').replace('eq.','');
        DB.sessions=DB.sessions.filter(s=>s.id!==id);DB.invites=DB.invites.filter(i=>i.session_id!==id);
        return empty(r);
      }
      if(p==='/rest/v1/session_invites'&&method==='GET'){
        const vis=new Set(visibleSessions().map(s=>s.id));
        return json(r,200,DB.invites.filter(i=>vis.has(i.session_id)));
      }
      if(p==='/rest/v1/session_invites'&&method==='POST'){
        DB.invites.push({session_id:body.session_id,user_id:body.user_id,status:'invited'});return empty(r);
      }
      if(p==='/rest/v1/rpc/respond_session'&&method==='POST'){
        const i=DB.invites.find(x=>x.session_id===body.sid&&x.user_id===ME);
        if(!i)return json(r,400,{msg:'No tienes una invitación para esa sesión.'});
        i.status=body.status;return json(r,200,null);
      }
      if(p==='/rest/v1/shared_events'&&method==='GET'){
        const friends=new Set(DB.friendships.filter(f=>f.status==='accepted').map(f=>f.requester===ME?f.addressee:f.requester));
        return json(r,200,DB.shared.filter(e=>e.owner===ME||friends.has(e.owner)));
      }
      if(p==='/rest/v1/shared_events'&&method==='POST'){
        body.forEach(row=>{
          const old=DB.shared.find(e=>e.owner===row.owner&&e.local_id===row.local_id);
          if(old)Object.assign(old,row);else DB.shared.push(Object.assign({id:'e-'+(++DB.seq)},row));
        });
        return empty(r);
      }
      if(p==='/rest/v1/shared_events'&&method==='DELETE'){
        const owned=idsFrom(params.get('owner')||''),locals=(params.get('local_id')||'').replace(/^in\.\(?|\)?$/g,'').split(',');
        DB.shared=DB.shared.filter(e=>!(owned.includes(e.owner)&&locals.includes(e.local_id)));
        return empty(r);
      }
      if(p==='/rest/v1/rpc/delete_my_account'&&method==='POST'){
        DB.friendships=[];DB.sessions=[];DB.invites=[];DB.shared=[];return json(r,200,null);
      }
      return json(r,404,{msg:'Ruta no simulada: '+p});
    });
  };
  const onboard=async p=>{
    if(await p.locator('#reg-name').count()){
      await p.fill('#reg-name','Estudiante');await p.fill('#reg-career','Carrera');
      await p.locator('.hud-btn').click();
    }
    const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
  };
  const open=async(p,sec,sub)=>{
    await p.locator('.brand').click();
    if(sec!=='Inicio')await p.locator('.home-card').filter({hasText:sec}).click();
    if(sub)await p.click('nav >> text="'+sub+'"');
  };

  const ctx0=await b.newContext({serviceWorkers:'block'});
  await ctx0.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  const p0=await ctx0.newPage();
  p0.on('pageerror',e=>errs.push('sin config: '+e.message));
  let sinConfig=0;
  await p0.route('https://supabase.test/**',r=>{sinConfig++;r.abort()});
  await p0.goto(base);await onboard(p0);
  await open(p0,'Social');
  ok('sin configurar muestra el aviso',(await p0.textContent('#app')).includes('todavía no está configurada'));
  ok('sin configurar no contacta a Supabase',sinConfig===0,String(sinConfig));
  await open(p0,'Planificación','Hoy');
  ok('sin configurar el resto de la app funciona',(await p0.textContent('#app')).includes('Hoy'));
  await ctx0.close();

  const ctx=await b.newContext({serviceWorkers:'block'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  await setup(ctx);
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());
  await p.goto(base);await onboard(p);
  const ids=await p.evaluate(()=>{
    S=fresh();S.profile={name:'Estudiante',career:'Carrera'};S.account.type='personal';
    S.consent={health:true,at:today()};
    S.courses=[{id:'c1',name:'Cálculo III',difficulty:3,color:'#3b6df0',grades:[]},
      {id:'c2',name:'Economía',difficulty:2,color:'#e0693a',grades:[]}];
    S.wellbeing.diary=[{date:today(),mood:1,energy:1,sleep:1,tags:['SECRETO_ESTADO_ANIMO'],note:'SECRETO_DIARIO',ts:1}];
    S.events=[{id:'ev-share',courseId:'c1',title:'Certamen compartido',date:addDays(today(),5),type:'evaluacion'},
      {id:'ev-private',courseId:'c2',title:'SECRETO_FECHA',date:addDays(today(),6),type:'entrega'}];
    replanAll();
    return {c1:S.courses[0].id,c2:S.courses[1].id};
  });
  await open(p,'Social');
  ok('configurado sin sesión pide correo',(await p.textContent('#app')).includes('Enviar código'));
  ok('sin sesión no hay peticiones remotas',requests.filter(r=>r.url.startsWith('/auth')||r.url.startsWith('/rest')).length===0);

  await p.fill('#soc-email','yo@correo.cl');await p.click('text=Enviar código');
  await p.waitForSelector('#soc-code-otp');
  const otp=requests.find(r=>r.url==='/auth/v1/otp');
  ok('OTP con create_user y sin enlace mágico',!!otp&&otp.body.create_user===true&&otp.body.email==='yo@correo.cl',JSON.stringify(otp&&otp.body));
  await p.fill('#soc-code-otp','123456');await p.click('text=Ingresar código');
  await p.waitForSelector('#soc-name',{timeout:10000});
  const ver=requests.find(r=>r.url==='/auth/v1/verify');
  ok('verificación con tipo email y código de 6 dígitos',!!ver&&ver.body.type==='email'&&ver.body.token==='123456',JSON.stringify(ver&&ver.body));
  await p.fill('#soc-name','Yo');await p.click('text=Crear mi perfil');
  const ready=await waitFor(()=>p.evaluate(()=>SOC.ready&&!!SOC.profile));
  ok('perfil creado con código de amigo',ready&&(await p.evaluate(()=>SOC.profile.friend_code.length===8&&SOC.profile.display_name==='Yo')));
  ok('sesión guardada fuera del estado S',await p.evaluate(()=>!JSON.stringify(S).includes('access_token')&&!!localStorage.getItem('entrenador-academico-social-v1')));

  await p.fill('#soc-add-code','FRIENAAA');await p.click('text=Enviar solicitud');
  ok('solicitud enviada por código',await waitFor(()=>DB.friendships.some(f=>f.requester===ME&&f.addressee===ANA&&f.status==='pending')));
  DB.friendships.find(f=>f.requester===ME&&f.addressee===ANA).status='accepted';
  await p.click('text=Actualizar');
  await waitFor(()=>p.evaluate(()=>SOC.friends.some(x=>x.display_name==='Ana')));
  ok('solicitud aceptada por el otro lado se ve como amiga',await p.evaluate(()=>SOC.friends.some(x=>x.display_name==='Ana')));
  ok('solicitud recibida se puede aceptar',(await p.textContent('#app')).includes('Beto'));
  await p.locator('.task').filter({hasText:'Beto'}).locator('text=Aceptar').click();
  await waitFor(()=>DB.friendships.some(f=>f.id==='fr-in-1'&&f.status==='accepted'));
  await waitFor(()=>p.locator('.task').filter({hasText:'Beto'}).locator('text=Quitar').count());
  ok('aceptar solicitud entrante desde la interfaz',DB.friendships.find(f=>f.id==='fr-in-1').status==='accepted');
  const beto=DB.friendships.find(f=>f.id==='fr-in-1').requester;
  await p.locator('.task').filter({hasText:'Beto'}).locator('text=Quitar').click();
  await waitFor(()=>!DB.friendships.some(f=>f.status==='accepted'&&(f.requester===beto||f.addressee===beto)));
  ok('quitar amigo ofrece Deshacer',await waitFor(async()=>await p.locator('.toast-undo').count()===1));
  await p.click('.toast-undo');
  ok('Deshacer recupera la amistad',await waitFor(()=>DB.friendships.some(f=>f.status==='accepted'&&(f.requester===beto||f.addressee===beto))));
  await waitFor(()=>p.evaluate(()=>SOC.friends.some(x=>x.display_name==='Beto')));

  await p.fill('#ss-title','Repasar certamen');await p.fill('#ss-course','Cálculo III');
  await p.fill('#ss-date',await p.evaluate(()=>today()));
  await p.fill('#ss-start','18:00');await p.fill('#ss-end','19:30');
  await p.check('input[name="ss-guest"][value="'+ANA+'"]');
  await p.click('text=Crear sesión');
  ok('sesión creada e invitación enviada',await waitFor(()=>DB.sessions.some(s=>s.title==='Repasar certamen')&&DB.invites.some(i=>i.user_id===ANA)));
  DB.sessions.push({id:'s-ana',host:ANA,title:'Sesión de Ana',course_name:'Cálculo III',date:await p.evaluate(()=>today()),start_time:'20:00',end_time:'20:30',place:'Biblioteca',note:null});
  DB.invites.push({session_id:'s-ana',user_id:ME,status:'invited'});
  await p.click('text=Actualizar');
  await waitFor(()=>p.evaluate(()=>SOC.sessions.some(s=>s.title==='Sesión de Ana')));
  await p.locator('.task').filter({hasText:'Sesión de Ana'}).locator('text=Aceptar').click();
  ok('aceptar invitación recibida desde la interfaz',await waitFor(()=>DB.invites.some(i=>i.session_id==='s-ana'&&i.status==='accepted')));
  DB.invites.find(i=>i.user_id===ANA).status='accepted';
  await p.click('text=Actualizar');
  await waitFor(()=>p.evaluate(()=>SOC.sessions.every(s=>s.invites.every(i=>i.status!=='invited'))||SOC.sessions.some(s=>s.title==='Sesión de Ana')));

  await open(p,'Planificación','Semana');
  const week=await p.textContent('#app');
  ok('sesiones aceptadas dibujadas en la grilla',(await p.locator('.blk.ses:not(.pend)').count())>=2&&week.includes('Repasar certamen')&&week.includes('Sesión de Ana'));
  await open(p,'Planificación','Hoy');
  const hoy=await p.textContent('#app');
  ok('aviso de sesión en Hoy',hoy.includes('sesión de Cálculo III con Ana'));
  const anaSes=DB.sessions.find(s=>s.title==='Sesión de Ana');
  anaSes.start_time='23:30';anaSes.end_time='23:59';
  DB.sessions.find(s=>s.title==='Repasar certamen').start_time='00:00';
  DB.sessions.find(s=>s.title==='Repasar certamen').end_time='00:30';
  await open(p,'Social');await p.click('text=Actualizar');
  await open(p,'Planificación','Hoy');
  const boton=p.locator('button:has-text("Registrar esta sesión")');
  ok('botón de registrar aparece al terminar la sesión',await boton.count()===1,String(await boton.count()));
  await boton.click();
  const reg=await p.evaluate(()=>S.sessions.filter(x=>x.socialId).map(x=>({m:x.minutes,c:x.courseId})));
  ok('registrar sesión suma minutos al ramo',reg.length===1&&reg[0].m===30&&reg[0].c===ids.c1,JSON.stringify(reg));
  ok('sesión registrada una sola vez',!(await p.textContent('#app')).includes('Registrar esta sesión'));

  await open(p,'Social');
  await p.locator('.share-row').filter({hasText:'Cálculo III'}).locator('input[type=checkbox]').check();
  await waitFor(()=>DB.shared.some(e=>e.local_id==='ev-share'));
  const upserts=requests.filter(r=>r.url.startsWith('/rest/v1/shared_events')&&r.method==='POST');
  const last=upserts[upserts.length-1];
  const fields=last&&last.body[0]&&Object.keys(last.body[0]).sort().join(',');
  ok('sincroniza solo las fechas del ramo compartido',fields==='course_name,date,local_id,owner,title,type'&&last.body.length===1,fields+' / '+JSON.stringify(last&&last.body));
  ok('no comparte la fecha del ramo privado',!DB.shared.some(e=>e.local_id==='ev-private'));
  await p.locator('.share-row').filter({hasText:'Cálculo III'}).locator('input[type=checkbox]').uncheck();
  await waitFor(()=>DB.shared.length===0);
  ok('quita del servidor las fechas que deja de compartir',DB.shared.length===0&&requests.some(r=>r.url.startsWith('/rest/v1/shared_events')&&r.method==='DELETE'));

  const friendDate=await p.evaluate(()=>addDays(today(),7));
  DB.shared.push({id:'e-amigo',owner:ANA,local_id:'ev-amigo',course_name:'Cálculo III',title:'Certamen del amigo',date:friendDate,type:'evaluacion',updated_at:new Date().toISOString()});
  await p.click('text=Actualizar');
  await waitFor(()=>p.evaluate(()=>SOC.shared.some(e=>e.title==='Certamen del amigo')));
  ok('muestra fechas compartidas por amigos',(await p.textContent('#app')).includes('Certamen del amigo'));
  const presel=await p.locator('select[id^="soc-imp-"]').first().inputValue();
  ok('preselecciona el ramo por nombre normalizado',presel===ids.c1,presel+' vs '+ids.c1);
  await p.locator('text=Agregar a mis fechas').first().click();
  await waitFor(()=>p.evaluate(()=>S.events.some(e=>e.title==='Certamen del amigo')));
  const imp=await p.evaluate(()=>{const e=S.events.find(x=>x.title==='Certamen del amigo');return {src:e.src,tasks:S.tasks.length}});
  ok('importa la fecha guardando su origen',!!imp.src&&imp.src.owner===ANA&&imp.src.id==='e-amigo'&&imp.tasks>0,JSON.stringify(imp.src));
  await p.evaluate(o=>socialImportEvent(o,'e-amigo','c1'),ANA);
  const dup=await p.evaluate(()=>S.events.filter(e=>e.title==='Certamen del amigo').length);
  ok('no duplica una fecha ya importada',dup===1,String(dup));

  const bannedKeys=['mood','energy','sleep','diary','grades','career','consent','ratings','wellbeing','difficulty','score','weight','minFor','profile'];
  const bannedValues=['SECRETO_ESTADO_ANIMO','SECRETO_DIARIO','SECRETO_FECHA','Estudiante'];
  const bad=[];
  requests.forEach(r=>{
    const scan=(v,path)=>{
      if(v&&typeof v==='object')for(const k in v){if(bannedKeys.includes(k)&&path.indexOf('/auth')<0)bad.push(r.url+':'+path+'.'+k);scan(v[k],path+'.'+k)}
      else if(typeof v==='string'&&bannedValues.includes(v))bad.push(r.url+':'+path+'='+v);
    };
    scan(r.body,r.method+' '+r.url);
  });
  ok('ningún cuerpo de petición contiene datos de bienestar',bad.length===0,bad.slice(0,8).join(' | '));
  ok('todas las peticiones llevan apikey',requests.every(r=>!!r.headers.apikey),String(requests.length));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(x=>x.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
