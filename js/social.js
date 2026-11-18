const SOCIAL_KEY='entrenador-academico-social-v1';
const socialBlank=()=>({ready:false,loading:false,syncing:false,error:'',msg:'',busy:false,step:'email',email:'',
  demo:false,demoAuth:null,profile:null,people:{},friends:[],incoming:[],outgoing:[],sessions:[],shared:[],syncedSig:null});
let SOC_AUTH=null;
let SOC=socialBlank();
let socialSyncTimer=null;

function socialRealConfigured(){
  try{return !!(typeof SUPABASE_URL==='string'&&SUPABASE_URL.trim()&&typeof SUPABASE_ANON_KEY==='string'&&SUPABASE_ANON_KEY.trim())}catch(e){return false}
}
function socialDemoActive(){return SOC.demo===true}
function socialConfigured(){return socialRealConfigured()||socialDemoActive()}
function socialBase(){return SUPABASE_URL.replace(/\/+$/,'')}
function socialAuth(){
  if(socialDemoActive())return SOC.demoAuth;
  if(SOC_AUTH)return SOC_AUTH;
  try{
    const j=JSON.parse(localStorage.getItem(SOCIAL_KEY)||'null');
    if(j&&j.access_token&&j.user_id)SOC_AUTH=j;
  }catch(e){}
  return SOC_AUTH;
}
function socialSaveAuth(a){
  if(socialDemoActive()){SOC.demoAuth=a;return}
  SOC_AUTH=a;try{localStorage.setItem(SOCIAL_KEY,JSON.stringify(a))}catch(e){}
}
function socialClearAuth(){
  SOC_AUTH=null;SOC.demoAuth=null;try{localStorage.removeItem(SOCIAL_KEY)}catch(e){}
}
function socialMockFetch(path,opt){
  if(typeof SocialMock==='undefined'||!SocialMock.ready())throw new Error('El modo demo no está disponible.');
  return SocialMock.request(path,opt||{});
}
function socialDemoNotice(){
  if(!socialDemoActive()||typeof SocialMock==='undefined')return;
  const msg=SocialMock.consumeNotice();
  if(!msg)return;
  SOC.msg=msg;toast(msg);
  if(typeof tab!=='undefined'&&tab==='amigos')render();
}
if(typeof SocialMock!=='undefined'&&SocialMock.onNotice)SocialMock.onNotice(socialDemoNotice);
const socialMessage=e=>e&&e.message?e.message:String(e||'No se pudo completar la acción.');
function socialErrMsg(status,detail){
  if(status===401)return 'Tu sesión venció. Inicia sesión de nuevo para usar Amigos.';
  if(status===403)return 'No tienes permiso para hacer eso.';
  if(status===404)return 'No encontramos lo que buscabas.';
  if(status===409)return 'Ese cambio ya está registrado o entra en conflicto con otro.';
  if(status===429)return 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.';
  if(status>=500)return 'El servicio de Amigos no está disponible ahora. Tu app local sigue funcionando.';
  return detail?String(detail).slice(0,180):'No se pudo completar la acción. Revisa tu conexión.';
}
function socialHeaders(withAuth){
  const h={'apikey':SUPABASE_ANON_KEY,'Accept':'application/json'};
  if(withAuth&&socialAuth())h.Authorization='Bearer '+socialAuth().access_token;
  return h;
}
async function socialRefresh(){
  if(socialDemoActive())return true;
  const a=socialAuth();if(!a||!a.refresh_token)return false;
  try{
    const j=await socialFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,
      body:{refresh_token:a.refresh_token}});
    if(!j||!j.access_token)throw new Error('refresh');
    socialSaveAuth({access_token:j.access_token,refresh_token:j.refresh_token||a.refresh_token,
      expires_at:Math.floor(Date.now()/1000)+(Number(j.expires_in)||3600),user_id:a.user_id,email:a.email});
    return true;
  }catch(e){socialClearAuth();return false}
}
async function socialEnsureToken(){
  const a=socialAuth();if(!a)return false;
  if(a.expires_at&&a.expires_at>Math.floor(Date.now()/1000)+30)return true;
  return socialRefresh();
}
async function socialFetch(path,opt){
  opt=opt||{};
  if(socialDemoActive())return socialMockFetch(path,opt);
  const withAuth=opt.auth!==false;
  if(withAuth&&!(await socialEnsureToken()))throw new Error('Tu sesión venció. Inicia sesión de nuevo para usar Amigos.');
  const h=socialHeaders(withAuth);
  if(opt.body!=null)h['Content-Type']='application/json';
  if(opt.prefer)h['Prefer']=opt.prefer;
  let r;
  try{
    r=await fetch(socialBase()+path,{method:opt.method||'GET',headers:h,
      body:opt.body==null?undefined:JSON.stringify(opt.body)});
  }catch(e){throw new Error('No se pudo conectar con Amigos. Revisa tu conexión: el resto de la app sigue funcionando.')}
  if(r.status===401&&withAuth){socialClearAuth();throw new Error('Tu sesión venció. Inicia sesión de nuevo para usar Amigos.')}
  if(!r.ok){
    let d='';try{const j=await r.json();d=(j&&(j.msg||j.message||j.error_description||j.error))||''}catch(e){}
    throw new Error(socialErrMsg(r.status,d));
  }
  if(r.status===204)return null;
  let txt='';try{txt=await r.text()}catch(e){}
  if(!txt)return null;
  try{return JSON.parse(txt)}catch(e){throw new Error('Respuesta inesperada del servidor.')}
}

function socialCode(){
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ',buf=new Uint8Array(8);
  try{crypto.getRandomValues(buf)}catch(e){for(let i=0;i<8;i++)buf[i]=Math.floor(Math.random()*256)}
  return Array.from(buf,b=>A[b%A.length]).join('');
}
async function socialSendOtp(email){
  const e=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))throw new Error('Ingresa un correo válido.');
  await socialFetch('/auth/v1/otp',{method:'POST',auth:false,body:{email:e,create_user:true}});
  return e;
}
async function socialVerifyOtp(email,token){
  const e=String(email||'').trim().toLowerCase(),code=String(token||'').replace(/\s/g,'');
  if(!/^\d{6}$/.test(code))throw new Error('El código debe tener 6 dígitos.');
  const j=await socialFetch('/auth/v1/verify',{method:'POST',auth:false,
    body:{type:'email',email:e,token:code}});
  if(!j||!j.access_token)throw new Error('No se pudo iniciar sesión con ese código.');
  const u=j.user||{};
  socialSaveAuth({access_token:j.access_token,refresh_token:j.refresh_token||'',
    expires_at:Math.floor(Date.now()/1000)+(Number(j.expires_in)||3600),
    user_id:u.id||j.user_id||'',email:e});
  await socialLoad();
  toast(socialDemoActive()?'Sesión demo iniciada. Tu información de bienestar sigue solo en este navegador.':'Sesión iniciada. Tu información de bienestar sigue solo en este navegador.');
}
async function socialLoadProfile(){
  const rows=await socialFetch('/rest/v1/profiles?id=eq.'+encodeURIComponent(socialAuth().user_id)+
    '&select=id,display_name,friend_code');
  SOC.profile=(rows&&rows[0])||null;
  SOC.people={};if(SOC.profile)SOC.people[SOC.profile.id]=SOC.profile;
}
async function socialCreateProfile(name){
  const n=String(name||'').trim().slice(0,60);
  if(n.length<1)throw new Error('Escribe el nombre que verán tus amigos.');
  const id=socialAuth().user_id;
  for(let k=0;k<3;k++){
    try{
      const rows=await socialFetch('/rest/v1/profiles',{method:'POST',
        body:{id:id,display_name:n,friend_code:socialCode()},prefer:'return=representation'});
      SOC.profile=(Array.isArray(rows)&&rows[0])||rows||null;
      await socialLoad();
      return;
    }catch(e){if(k===2||!/unique|conflict|friend_code|409/i.test(e.message))throw e}
  }
}

function socialSig(rows){
  return JSON.stringify(rows.map(r=>[r.local_id,r.course_name,r.title,r.date,r.type])
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
function socialSharedRows(){
  const shared=new Set(S.courses.filter(c=>c.share===true).map(c=>c.id));
  return S.events.filter(e=>shared.has(e.courseId)&&!e.src).map(e=>({
    local_id:String(e.id),course_name:cname(e.courseId),title:String(e.title).slice(0,200),
    date:e.date,type:e.type
  }));
}
async function socialLoad(){
  if(!socialConfigured()||!socialAuth())return;
  SOC.loading=true;SOC.error='';
  try{
    if(!(await socialEnsureToken()))throw new Error('Tu sesión venció. Inicia sesión de nuevo para usar Amigos.');
    await socialLoadProfile();
    if(!SOC.profile){SOC.step='name';SOC.ready=false;return}
    const uid=socialAuth().user_id,enc=encodeURIComponent;
    const f=(rows)=>Array.isArray(rows)?rows:[];
    const [friendRows,sessionRows,inviteRows,sharedRows]=await Promise.all([
      socialFetch('/rest/v1/friendships?select=id,requester,addressee,status,created_at&or='+
        enc('(requester.eq.'+uid+',addressee.eq.'+uid+')')).then(f),
      socialFetch('/rest/v1/study_sessions?select=id,host,title,course_name,date,start_time,end_time,place,note,created_at&order='+
        enc('date.asc,start_time.asc')).then(f),
      socialFetch('/rest/v1/session_invites?select=session_id,user_id,status').then(f),
      socialFetch('/rest/v1/shared_events?select=id,owner,local_id,course_name,title,date,type,updated_at&order='+
        enc('date.asc')).then(f)
    ]);
    const ids=new Set([uid]);
    friendRows.forEach(x=>{ids.add(x.requester);ids.add(x.addressee)});
    sessionRows.forEach(x=>ids.add(x.host));
    inviteRows.forEach(x=>ids.add(x.user_id));
    sharedRows.forEach(x=>ids.add(x.owner));
    const rest=[...ids].filter(x=>x&&x!==uid);
    if(rest.length){
      const people=await socialFetch('/rest/v1/profiles?id=in.'+enc('('+rest.join(',')+')')+
        '&select=id,display_name,friend_code').then(f);
      people.forEach(p=>{SOC.people[p.id]=p});
    }
    const other=fr=>fr.requester===uid?fr.addressee:fr.requester;
    const person=id=>SOC.people[id]||null;
    SOC.friends=friendRows.filter(x=>x.status==='accepted').map(x=>person(other(x))).filter(Boolean);
    SOC.incoming=friendRows.filter(x=>x.status==='pending'&&x.addressee===uid)
      .map(x=>({id:x.id,person:person(x.requester)})).filter(x=>x.person);
    SOC.outgoing=friendRows.filter(x=>x.status==='pending'&&x.requester===uid)
      .map(x=>({id:x.id,person:person(x.addressee)})).filter(x=>x.person);
    SOC.sessions=sessionRows.map(s=>{
      const inv=inviteRows.filter(i=>i.session_id===s.id);
      const mine=s.host===uid?'host':((inv.find(i=>i.user_id===uid)||{}).status||null);
      return Object.assign({},s,{invites:inv,mine:mine});
    });
    SOC.shared=sharedRows;
    SOC.syncedSig=socialSig(sharedRows.filter(x=>x.owner===uid)
      .map(x=>({local_id:x.local_id,course_name:x.course_name,title:x.title,date:x.date,type:x.type})));
    SOC.step='ready';SOC.ready=true;SOC.msg='';
  }catch(e){SOC.error=socialMessage(e);SOC.ready=false}
  finally{SOC.loading=false;if(typeof tab!=='undefined'&&tab==='amigos')render()}
}
function socialBoot(){
  if(!socialConfigured()||!socialAuth())return;
  socialLoad();
}
function socialOpenTab(){
  if(!socialConfigured()||!socialAuth())return;
  socialLoad();
}

async function socialSyncShared(force){
  if(!socialConfigured()||!socialAuth()||!SOC.profile||SOC.syncing)return;
  const rows=socialSharedRows(),sig=socialSig(rows);
  if(!force&&sig===SOC.syncedSig)return;
  SOC.syncing=true;
  const uid=socialAuth().user_id,enc=encodeURIComponent;
  try{
    const payload=rows.map(r=>Object.assign({owner:uid},r));
    if(payload.length)await socialFetch('/rest/v1/shared_events?on_conflict='+enc('owner,local_id'),
      {method:'POST',body:payload,prefer:'resolution=merge-duplicates,return=minimal'});
    const stale=(SOC.shared||[]).filter(x=>x.owner===uid&&!rows.some(r=>r.local_id===x.local_id))
      .map(x=>x.local_id);
    if(stale.length)await socialFetch('/rest/v1/shared_events?owner=eq.'+enc(uid)+
      '&local_id=in.'+enc('('+stale.join(',')+')'),{method:'DELETE',prefer:'return=minimal'});
    const kept=SOC.shared.filter(x=>x.owner!==uid);
    SOC.shared=kept.concat(payload.map(p=>{
      const old=(SOC.shared||[]).find(x=>x.owner===uid&&x.local_id===p.local_id);
      return Object.assign({id:old&&old.id||p.local_id,updated_at:new Date().toISOString()},p);
    }));
    SOC.syncedSig=sig;
  }catch(e){SOC.error=socialMessage(e)}
  finally{SOC.syncing=false;if(typeof tab!=='undefined'&&tab==='amigos')render()}
}
function socialAfterSave(){
  if(!socialConfigured()||!socialAuth())return;
  clearTimeout(socialSyncTimer);
  socialSyncTimer=setTimeout(()=>{socialSyncShared().catch(()=>{})},800);
}

function socialStartDemo(){
  if(typeof SocialMock==='undefined'||!SocialMock.start){toast('La capa de ejemplo no está disponible.');return}
  SocialMock.start();
  SOC=socialBlank();SOC.demo=true;SOC.demoAuth=null;
  SOC.msg='Modo demo: los amigos y sus datos son de ejemplo. Nada se envía a ningún lado.';
  toast('Modo demo activado. Usa cualquier correo y cualquier código de 6 dígitos.');
  render();
}
async function socialStopDemo(){
  if(!await askConfirm({title:'Salir del modo demo',text:'Tus datos locales y tu respaldo no se tocan.',okLabel:'Salir'}))return;
  if(typeof SocialMock!=='undefined')SocialMock.stop();
  SOC=socialBlank();
  toast('Saliste del modo demo.');
  render();
}
function socialDemoBanner(){
  if(!socialDemoActive())return '';
  return `<div class="banner go"><b>Modo demo:</b> los amigos y sus datos son de ejemplo. Nada se envía a ningún lado.
    <div class="mute" style="margin-top:6px">Códigos: Ana <b>ANADEMOX</b> · Beto <b>BETODEMO</b> · Camila <b>CAMIDEMO</b> · Diego <b>DIEGODEM</b>.</div>
    <div class="row" style="margin-top:8px"><button class="btn sec" onclick="socialStopDemo()">Salir del modo demo</button></div></div>`;
}
function socialReset(){
  if(socialDemoActive()&&typeof SocialMock!=='undefined')SocialMock.stop();
  socialClearAuth();
  SOC=socialBlank();
}
async function socialSubmitEmail(){
  const e=(($('#soc-email')||{}).value)||'';
  SOC.email=String(e).trim().toLowerCase();SOC.busy=true;SOC.msg='';render();
  try{await socialSendOtp(SOC.email);SOC.step='code';SOC.msg=socialDemoActive()?'Modo demo: escribe cualquier código de 6 dígitos (por ejemplo 123456).':'Te enviamos un código de 6 dígitos a tu correo.'}
  catch(e){SOC.msg=socialMessage(e)}
  finally{SOC.busy=false;render()}
}
async function socialSubmitCode(){
  const c=(($('#soc-code-otp')||{}).value)||'';
  SOC.busy=true;SOC.msg='';render();
  try{await socialVerifyOtp(SOC.email,c)}
  catch(e){SOC.msg=socialMessage(e)}
  finally{SOC.busy=false;render()}
}
async function socialSubmitName(){
  const n=(($('#soc-name')||{}).value)||'';
  SOC.busy=true;SOC.msg='';render();
  try{await socialCreateProfile(n);toast('Tu perfil está listo. Ya puedes compartir con amigos.')}
  catch(e){SOC.msg=socialMessage(e)}
  finally{SOC.busy=false;render()}
}
async function socialLogout(){
  const demo=socialDemoActive();
  if(!await askConfirm({title:demo?'Salir del modo demo':'Cerrar sesión',text:'Tus datos locales y tu respaldo no se tocan.',okLabel:demo?'Salir':'Cerrar sesión'}))return;
  socialReset();toast(demo?'Saliste del modo demo. La app sigue funcionando con tus datos locales.':'Sesión cerrada. La app sigue funcionando sin conexión a Amigos.');render();
}
async function socialDeleteAccount(){
  if(!await askConfirm({title:'Eliminar cuenta de Amigos',text:'Se borrarán del servidor tu perfil, amistades, fechas compartidas y sesiones. Esta acción no se puede deshacer. Tus datos locales NO se borran.',okLabel:'Eliminar',danger:true}))return;
  SOC.busy=true;render();
  try{
    await socialFetch('/rest/v1/rpc/delete_my_account',{method:'POST',body:{}});
    socialReset();toast('Tu cuenta y tus datos del servidor fueron eliminados.');
  }catch(e){toast(socialMessage(e))}
  finally{SOC.busy=false;render()}
}
async function socialCopyCode(){
  const code=SOC.profile&&SOC.profile.friend_code;if(!code)return;
  try{await navigator.clipboard.writeText(code);toast('Código copiado: '+code)}
  catch(e){toast('Tu código de amigo es '+code)}
}
async function socialSendRequest(){
  const v=(($('#soc-add-code')||{}).value)||'';
  const code=String(v).trim().toUpperCase();
  if(code.length!==8)return toast('El código de amigo tiene 8 letras.');
  SOC.busy=true;render();
  try{
    await socialFetch('/rest/v1/rpc/send_friend_request',{method:'POST',body:{code:code}});
    if(typeof metricsTrack==='function')metricsTrack('amigo_agregado');
    toast('Solicitud enviada. Si la otra persona también te había agregado, ya son amigos.');
    await socialLoad();
  }catch(e){toast(socialMessage(e))}
  finally{SOC.busy=false;render()}
}
async function socialRespondFriend(id,accept){
  try{
    await socialFetch('/rest/v1/rpc/respond_friend_request',{method:'POST',body:{id:id,accept:!!accept}});
    if(accept&&typeof metricsTrack==='function')metricsTrack('amigo_agregado');
    toast(accept?'Listo: ya son amigos.':'Solicitud rechazada.');
    await socialLoad();
  }catch(e){toast(socialMessage(e))}
}
async function socialRemoveFriend(id){
  const name=socialName(id);
  try{
    await socialFetch('/rest/v1/rpc/remove_friend',{method:'POST',body:{other:id}});
    toast(name+' ya no es tu amiga.',()=>{
      socialFetch('/rest/v1/rpc/restore_friend',{method:'POST',body:{other:id}})
        .then(()=>{toast('Amistad restaurada.');return socialLoad()})
        .catch(e=>toast(socialMessage(e)));
    });
    await socialLoad();
  }catch(e){toast(socialMessage(e))}
}

const socialSessionFields=()=>SOC.sessions.filter(s=>s.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||String(a.start_time).localeCompare(String(b.start_time)));
const socialName=id=>(SOC.people[id]&&SOC.people[id].display_name)||'Alguien';
const socialSessionCourse=s=>S.courses.find(c=>norm(c.name)===norm(s.course_name))||null;
async function socialCreateSession(){
  const g=id=>{const el=$('#'+id);return el?el.value:''};
  const title=String(g('ss-title')||'').trim(),course_name=String(g('ss-course')||'').trim();
  const date=g('ss-date'),start=g('ss-start'),end=g('ss-end'),place=String(g('ss-place')||'').trim(),note=String(g('ss-note')||'').trim();
  const guests=[...document.querySelectorAll('input[name="ss-guest"]:checked')].map(x=>x.value);
  if(!title||!course_name||!date||!start||!end)return toast('Completa título, ramo, fecha y horarios.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return toast('Revisa la fecha y los horarios.');
  if(toMin(end)<=toMin(start))return toast('La hora de término debe ser posterior al inicio.');
  SOC.busy=true;render();
  try{
    const created=await socialFetch('/rest/v1/study_sessions',{method:'POST',prefer:'return=representation',
      body:{host:socialAuth().user_id,title:title.slice(0,200),course_name:course_name.slice(0,120),
        date:date,start_time:start,end_time:end,place:place?place.slice(0,200):null,note:note?note.slice(0,1000):null}});
    const s=(Array.isArray(created)&&created[0])||created;
    if(!s||!s.id)throw new Error('No se pudo crear la sesión.');
    for(const gid of guests){
      await socialFetch('/rest/v1/session_invites',{method:'POST',prefer:'return=minimal',
        body:{session_id:s.id,user_id:gid}});
    }
    toast(guests.length?'Sesión creada y amigos invitados.':'Sesión creada. Puedes invitar después.');
    await socialLoad();
  }catch(e){toast(socialMessage(e))}
  finally{SOC.busy=false;render()}
}
async function socialRespondSession(id,status){
  try{
    await socialFetch('/rest/v1/rpc/respond_session',{method:'POST',body:{sid:id,status:status}});
    toast(status==='accepted'?'Listo: la sesión aparece en tu semana.':'Avisamos que no puedes asistir.');
    await socialLoad();
  }catch(e){toast(socialMessage(e))}
}
async function socialCancelSession(id){
  if(!await askConfirm({title:'Cancelar sesión',text:'Se borrará también para los invitados.',okLabel:'Cancelar sesión',danger:true}))return;
  try{
    await socialFetch('/rest/v1/study_sessions?id=eq.'+encodeURIComponent(id),{method:'DELETE',prefer:'return=minimal'});
    toast('Sesión cancelada.');
    await socialLoad();
  }catch(e){toast(socialMessage(e))}
}
function socialRegisterSession(id){
  const s=SOC.sessions.find(x=>x.id===id);if(!s||(s.mine!=='accepted'&&s.host!==socialMyId()))return;
  if(S.sessions.some(x=>x.socialId===id))return toast('Ya registraste esta sesión.');
  if(doneToday()>=capFor(today()))return toast('Hoy ya completaste tu capacidad. Descansar también es parte del plan.');
  const c=socialSessionCourse(s);
  if(!c)return toast('Agrega un ramo con ese nombre para registrar la sesión.');
  S.sessions.push({id:uid(),date:today(),courseId:c.id,minutes:Math.max(1,toMin(s.end_time)-toMin(s.start_time)),socialId:id});
  if(typeof arvisCelebrar==='function')arvisCelebrar();
  save();replanAll();toast('Sesión registrada en tu día.');
  render();
}

async function socialImportEvent(owner,id,courseId){
  const ev=SOC.shared.find(e=>e.owner===owner&&e.id===id);
  if(!ev)return;
  if(!course(courseId))return toast('Elige uno de tus ramos.');
  if(S.events.some(e=>e.src&&e.src.owner===owner&&e.src.id===id))return toast('Ya importaste esta fecha: no la duplico.');
  S.events.push({id:uid(),courseId:courseId,title:String(ev.title).slice(0,200),date:ev.date,type:ev.type,src:{owner:owner,id:id}});
  save();replanAll();
  toast('Fecha agregada a tus ramos y a tu plan.');
  if(typeof tab!=='undefined'&&tab==='amigos')render();
}
function socialFriendsShared(){
  const friends=new Set(SOC.friends.map(p=>p.id));
  return SOC.shared.filter(e=>friends.has(e.owner)&&!S.events.some(x=>x.src&&x.src.owner===e.owner&&x.src.id===e.id));
}
function socialMyId(){return socialAuth()&&socialAuth().user_id}
function socialWeekBlocks(date){
  if(!socialConfigured()||!socialMyId()||!SOC.ready)return '';
  const H0=7,H1=22,HH=44;
  return SOC.sessions.filter(s=>s.date===date&&(s.host===socialMyId()||s.mine==='accepted'||s.mine==='invited')).map(s=>{
    const a=Math.max(toMin(s.start_time),H0*60),b=Math.min(toMin(s.end_time),H1*60);
    if(b<=a)return '';
    const pending=s.mine==='invited',c=socialSessionCourse(s);
    return `<div class="blk ses ${pending?'pend':''}" style="top:${(a-H0*60)/60*HH}px;height:${(b-a)/60*HH}px;background:${c?c.color:'var(--accent)'}" title="${esc(s.title)}">${pending?'? ':''}${esc(s.title)}<br>${esc(s.start_time)}–${esc(s.end_time)}</div>`;
  }).join('');
}
function socialAgendaItems(date){
  if(!socialConfigured()||!socialMyId()||!SOC.ready)return [];
  const me=socialMyId();
  return SOC.sessions.filter(s=>s.date===date&&(s.host===me||s.mine==='accepted'||s.mine==='invited'))
    .map(s=>({time:String(s.start_time||''),order:0,html:`<b>${esc(s.title)}</b><br><span class="mute">${esc(s.course_name)} · ${s.host===me?'tú':socialName(s.host)}${s.place?' · '+esc(s.place):''}</span>`}));
}
function socialTodayHtml(){
  if(!socialConfigured()||!socialMyId()||!SOC.ready)return '';
  const me=socialMyId(),n=new Date(),now=n.getHours()*60+n.getMinutes();
  return SOC.sessions.filter(s=>s.date===today()&&(s.mine==='accepted'||s.host===me))
    .sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time))).map(s=>{
      const who=s.host===me?'tú':socialName(s.host),ended=toMin(s.end_time)<=now;
      const done=S.sessions.some(x=>x.socialId===s.id);
      return `<div class="banner ${ended?'min':'info'}">Hoy ${esc(s.start_time)}–${esc(s.end_time)}: sesión de ${esc(s.course_name)} con ${esc(who)}${s.place?' en '+esc(s.place):''}.
        ${ended&&!done?`<div class="row" style="margin-top:8px"><button class="btn" onclick="socialRegisterSession('${esc(s.id)}')">Registrar esta sesión</button></div>`:''}
        ${done?'<span class="tag soc-ok">Ya registrada</span>':''}</div>`;
    }).join('');
}
