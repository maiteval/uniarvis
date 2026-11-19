/* U.A.R.V.I.S. · Catálogo institucional y flujo simulado (prototipo, sin backend) */
/* Agregar otra universidad = agregar un objeto a INSTITUTIONS y sus datos de ejemplo. */
const accountBlank=()=>({type:null,institutionId:'',email:'',linkedAt:null,auth:null});
const INST_SESSION_KEY='uarvis-inst-session-v1';
const INST_CODE_MS=10*60*1000,INST_RESEND_MS=30000,INST_CODE_ATTEMPTS=5,INST_LOGIN_ATTEMPTS=5,INST_LOGIN_LOCK_MS=30000;
const INST_FLOW_STEPS=['Universidad','Correo','Código','Contraseña','Tus datos','Consentimiento'];
let entryChoice=null,choiceOrigin='entry';
const instSessionActive=()=>{try{return sessionStorage.getItem(INST_SESSION_KEY)==='1'}catch(e){return false}};
function instSessionSet(){try{sessionStorage.setItem(INST_SESSION_KEY,'1')}catch(e){}}
function instSessionClear(){try{sessionStorage.removeItem(INST_SESSION_KEY)}catch(e){}}
const needsInstLogin=()=>!!(S&&S.account&&S.account.type==='institucional'&&S.account.auth&&!instSessionActive());
const needsInstitutionSetup=()=>!!(S&&S.account&&S.account.type==='institucional'&&!S.account.auth);
function instPassRules(pass){
  const p=String(pass||'');
  return {len:p.length>=8,letter:/[A-Za-zÁÉÍÓÚÜáéíóúüñÑ]/.test(p),number:/\d/.test(p)};
}
const instPassValid=pass=>{const r=instPassRules(pass);return r.len&&r.letter&&r.number};
function instPassStrength(pass){
  const p=String(pass||''),r=instPassRules(pass);
  if(!r.len||!r.letter||!r.number)return p.length<5?'Débil':'Media';
  return p.length>=12&&/[A-Z]/.test(p)&&/[a-z]/.test(p)?'Fuerte':'Media';
}
/* TODO: en producción la contraseña la gestiona Supabase Auth (updateUser) y no se guarda en el dispositivo.
   Este hash local existe solo para el prototipo: PBKDF2-SHA-256, sal de 16 bytes y 250000 iteraciones. */
async function deriveInstHash(pass,salt,it){
  const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);
  return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:it,hash:'SHA-256'},km,256));
}
async function makeInstAuth(pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)),it=PBKDF2_IT;
  return {salt:b64(salt),hash:await deriveInstHash(pass,b64(salt),it),it,createdAt:new Date().toISOString()};
}
function constantTimeEqual(x,y){
  const A=unb64(x),B=unb64(y),n=Math.max(A.length,B.length);
  let diff=A.length^B.length;
  for(let i=0;i<n;i++)diff|=(A[i]||0)^(B[i]||0);
  return diff===0;
}
async function checkInstPassword(pass,auth){
  if(!validAuth(auth))return false;
  return constantTimeEqual(auth.hash,await deriveInstHash(pass,auth.salt,auth.it));
}
const UDEC_SUPPORT={                                   // TODO: completar con datos oficiales de la UdeC
  service:'DISE · Bienestar Estudiantil',email:'bienestar@udec.cl',
  phone:'+56 41 220 0000',hours:'Lunes a viernes de 9:00 a 17:00',example:true
};
const UDEC_CALENDAR={                                  // TODO: completar con datos oficiales de la UdeC
  startRelative:-45,endRelative:75,
  examWeeks:[
    {label:'Semanas de certámenes · parciales',start:3,end:9},
    {label:'Semanas de certámenes · finales',start:70,end:76}
  ],
  breaks:[{label:'Receso académico',start:12,end:18}],
  holidays:[{label:'Feriado de ejemplo',offset:5},{label:'Feriado de ejemplo',offset:33}]
};
const calendarDate=offset=>addDays(today(),offset);
function institutionCalendar(inst){
  if(!inst||!inst.calendar)return null;
  const c=inst.calendar;
  return {
    classesStart:calendarDate(c.startRelative),classesEnd:calendarDate(c.endRelative),
    examWeeks:(c.examWeeks||[]).map(w=>({label:w.label,start:calendarDate(w.start),end:calendarDate(w.end)})),
    breaks:(c.breaks||[]).map(b=>({label:b.label,start:calendarDate(b.start),end:calendarDate(b.end)})),
    holidays:(c.holidays||[]).map(h=>({label:h.label,date:calendarDate(h.offset)}))
  };
}
const INSTITUTIONS=[{
  id:'udec',name:'Universidad de Concepción',short:'UdeC',emailDomain:'udec.cl',passGrade:4,
  prototype:true,support:UDEC_SUPPORT,calendar:UDEC_CALENDAR
}];
const institutionById=id=>INSTITUTIONS.find(i=>i.id===id)||null;
const currentInstitution=()=> S&&S.account&&S.account.type==='institucional'?institutionById(S.account.institutionId):null;
const isInstitutional=()=>!!currentInstitution();
const institutionPassGrade=()=>{const i=currentInstitution();return i?i.passGrade:4};
function institutionSupportHtml(){
  const i=currentInstitution();if(!i)return '';
  const s=i.support;
  return `<div class="banner info inst-support"><b>${esc(s.service)}</b><br>
    Correo: ${esc(s.email)} · Teléfono: ${esc(s.phone)}<br>Horario: ${esc(s.hours)}
    <span class="tag inst-example">Dato de ejemplo</span></div>`;
}
function institutionContactHref(){
  const i=currentInstitution();if(!i)return '#';
  const name=(S.profile&&S.profile.name)||'',email=(S.account&&S.account.email)||'';
  const body=`Nombre: ${name}\nCorreo: ${email}\n\nQuiero que me contacten desde el servicio de apoyo de ${i.name}.`;
  return 'mailto:'+encodeURIComponent(i.support.email)+'?subject='+encodeURIComponent('Solicitud de contacto · Uarvis UdeC (prototipo)')+'&body='+encodeURIComponent(body);
}
function institutionNoTaskDates(){
  const i=currentInstitution();if(!i)return [];
  const c=institutionCalendar(i),out=[];
  (c.breaks||[]).forEach(b=>{for(let d=b.start;d<=b.end;d=addDays(d,1))out.push(d)});
  (c.holidays||[]).forEach(h=>out.push(h.date));
  return [...new Set(out)];
}
function institutionCalendarHtml(days){
  const i=currentInstitution();if(!i)return '';
  const c=institutionCalendar(i),t0=today();
  const weekEnd=days[days.length-1];
  const items=[
    ...c.examWeeks.map(x=>({...x,type:'exam'})),
    ...c.breaks.map(x=>({...x,type:'break'})),
    ...c.holidays.map(x=>({date:x.date,label:x.label,type:'holiday'}))
  ].filter(x=>(x.end||x.date)>=t0).sort((a,b)=>String(a.start||a.date).localeCompare(String(b.start||b.date)));
  const label=x=>x.type==='exam'?'Certámenes':(x.type==='break'?'Receso':'Feriado');
  return `<div class="card inst-calendar"><h3>Calendario académico · ${esc(i.short)} <span class="tag inst-example">Dato de ejemplo</span></h3>
    <p class="mute">Período: ${dshort(c.classesStart)} – ${dshort(c.classesEnd)}. Semanas de certámenes, recesos y feriados de la demo.</p>
    ${items.map(x=>`<div class="task inst-item ${x.type}"><span class="tag">${label(x)}</span>
      <span style="flex:1"><b>${esc(x.label)}</b><br><span class="mute">${x.end?`${dshort(x.start)} – ${dshort(x.end)}`:dshort(x.date)}${x.end&&x.end>=days[0]&&x.start<=weekEnd?' · esta semana':''}</span></span></div>`).join('')}
    <p class="mute" style="margin-bottom:0">Los recesos y feriados no reciben micro-tareas. Las semanas de certámenes se consideran exigentes.</p></div>`;
}
function institutionDayMark(date){
  const i=currentInstitution();if(!i)return null;
  const c=institutionCalendar(i);
  if(c.holidays.some(h=>h.date===date))return {cls:'holiday',mark:'✦'};
  if(c.breaks.some(b=>date>=b.start&&date<=b.end))return {cls:'break',mark:'◦'};
  if(c.examWeeks.some(w=>date>=w.start&&date<=w.end))return {cls:'exam',mark:'!'};
  return null;
}
function finishPersonalMode(){
  S.account=accountBlank();S.account.type='personal';
  entryChoice=null;choiceOrigin='entry';
  if(typeof metricsTrack==='function')metricsTrack('modo_elegido','personal');
  if(typeof save==='function')save();
  if(typeof render==='function')render();
}
function choosePersonal(){
  if(choiceOrigin==='inst-login')return instUsePersonal();
  if(S&&S.profile&&S.profile.name)return finishPersonalMode();
  entryChoice='personal';choiceOrigin='entry';
  if(typeof render==='function')render();
}
function choosePersonalBack(){entryChoice=null;choiceOrigin='entry';if(typeof render==='function')render()}
function showAccountChoice(origin){
  entryChoice=null;choiceOrigin=origin||'entry';
  if(typeof InstitutionalFlow!=='undefined'&&InstitutionalFlow.get())InstitutionalFlow.cancel();
  if(typeof render==='function')render();
}
function linkInstitution(id,email,auth){
  const i=institutionById(id);if(!i)return false;
  S.account={type:'institucional',institutionId:id,email:String(email||'').trim().slice(0,120),linkedAt:today(),auth:auth||null};
  S.institutionConsentAt=today();
  if(!S.profile||typeof S.profile!=='object')S.profile={name:'',career:'',university:''};
  S.profile.university=i.name;
  if(typeof metricsTrack==='function')metricsTrack('modo_elegido','institucional');
  if(!S.support||(!S.support.name&&!S.support.contact))S.support={name:i.support.service,contact:i.support.email+' · '+i.support.phone};
  if(typeof save==='function')save();
  return true;
}
function unlinkInstitution(){
  S.account=accountBlank();S.account.type='personal';
  instSessionClear();
  if(typeof save==='function')save();
}

/* Modo demo en memoria, igual que Amigos: ni el código ni la contraseña se guardan en S ni en localStorage. */
let instAuthFailures=0,instAuthLockUntil=0,instLoginError='',instPwMode='',instTimer=null;
const instLoginLockRemaining=()=>Math.max(0,instAuthLockUntil-Date.now());
function instLoginResetExpiredLock(){
  if(instAuthLockUntil&&instLoginLockRemaining()===0){instAuthLockUntil=0;instAuthFailures=0;instLoginError=''}
}
const InstitutionalFlow=(function(){
  let flow=null;
  const get=()=>flow;
  function invalidateCode(){
    if(!flow)return;
    flow.code=null;flow.codeInput='';flow.attempts=0;flow.expiresAt=0;flow.resendAt=0;flow.verified=false;flow.needsResend=false;
  }
  function issueCode(){
    if(!flow)return;
    // TODO: en producción usar Supabase Auth (signInWithOtp por correo) y eliminar la bandeja simulada.
    const bytes=crypto.getRandomValues(new Uint8Array(6));
    flow.code=Array.from(bytes,b=>String(b%10)).join('');
    flow.codeInput='';flow.attempts=0;flow.expiresAt=Date.now()+INST_CODE_MS;flow.resendAt=Date.now()+INST_RESEND_MS;
    flow.verified=false;flow.needsResend=false;flow.error='';
  }
  function start(from,email){
    flow={step:'choose',email:String(email||'').trim().slice(0,120),error:'',from:from||'selection',
      code:null,codeInput:'',attempts:0,expiresAt:0,resendAt:0,verified:false,needsResend:false,auth:null,
      profile:{name:(S&&S.profile&&S.profile.name)||'',career:(S&&S.profile&&S.profile.career)||''}};
    if((flow.from==='migration'||flow.from==='forgot')&&flow.email){flow.step='code';issueCode()}
    return flow;
  }
  function cancel(){flow=null}
  function back(){
    if(!flow)return null;
    if(flow.step==='login')flow.step='choose';
    else if(flow.step==='code'){invalidateCode();flow.step='login'}
    else if(flow.step==='password')flow.step='code';
    else if(flow.step==='profile')flow.step='password';
    else if(flow.step==='consent')flow.step='profile';
    else flow=null;
    if(flow)flow.error='';
    return flow;
  }
  function next(){if(flow&&flow.step==='choose'){flow.step='login';flow.error=''}}
  function setEmail(v){if(flow){flow.email=String(v||'').trim().slice(0,120);flow.error='';invalidateCode()}}
  function setCode(v){if(flow){flow.codeInput=String(v||'').replace(/\D/g,'').slice(0,6);flow.error=''}}
  function submitProfile(name,career){
    if(!flow||flow.step!=='profile')return false;
    const n=String(name||'').trim(),c=String(career||'').trim();
    if(!n||!c){flow.error='Ingresa tu nombre y carrera.';return false}
    flow.profile={name:n.slice(0,60),career:c.slice(0,80)};
    flow.step='consent';flow.error='';return true;
  }
  function submitEmail(){
    if(!flow)return false;
    const i=INSTITUTIONS[0];
    if(!flow.email||!flow.email.toLowerCase().endsWith('@'+i.emailDomain.toLowerCase())){
      flow.error=`Usa tu correo institucional terminado en @${i.emailDomain}.`;return false;
    }
    flow.error='';flow.step='code';issueCode();return true;
  }
  function resendCode(){
    if(!flow||Date.now()<flow.resendAt)return false;
    issueCode();return true;
  }
  function submitCode(raw){
    if(!flow||flow.verified)return true;
    const v=String(raw||'').replace(/\D/g,'').slice(0,6);
    if(v.length!==6){flow.error='Escribe los 6 dígitos del código.';return false}
    if(Date.now()>=flow.expiresAt){flow.error='El código venció. Pide uno nuevo.';flow.needsResend=true;return false}
    if(flow.needsResend){flow.error='Pide un código nuevo para continuar.';return false}
    if(v!==flow.code){
      flow.attempts++;
      const left=Math.max(0,INST_CODE_ATTEMPTS-flow.attempts);
      flow.error=`Código incorrecto. Te quedan ${left} intentos.`;
      if(flow.attempts>=INST_CODE_ATTEMPTS){flow.needsResend=true;flow.error+=' Pide un código nuevo.'}
      return false;
    }
    flow.verified=true;flow.step='password';flow.error='';return true;
  }
  function finishSetup(){
    if(!flow||!flow.auth)return false;
    S.account.email=flow.email;S.account.auth=flow.auth;
    instSessionSet();instAuthFailures=0;instAuthLockUntil=0;instLoginError='';
    if(typeof save==='function')save();
    flow=null;return true;
  }
  async function submitPassword(p1,p2){
    if(!flow||flow.step!=='password')return false;
    if(!instPassValid(p1)){flow.error='La contraseña necesita 8 caracteres, una letra y un número.';return false}
    if(p1!==p2){flow.error='Las contraseñas no coinciden.';return false}
    try{flow.auth=await makeInstAuth(p1)}catch(e){flow.error='No pude crear la contraseña en este navegador.';return false}
    if(flow.from==='migration'||flow.from==='forgot')return finishSetup();
    if(S.institutionConsentAt){
      const auth=flow.auth,email=flow.email;
      linkInstitution(INSTITUTIONS[0].id,email,auth);instSessionSet();flow=null;
      if(typeof toast==='function')toast('Vinculado con la Universidad de Concepción (prototipo).');
      return true;
    }
    flow.step='profile';flow.error='';return true;
  }
  function accept(){
    if(!flow||flow.step!=='consent')return false;
    if(flow.profile){
      S.profile.name=flow.profile.name;S.profile.career=flow.profile.career;
    }
    linkInstitution(INSTITUTIONS[0].id,flow.email,flow.auth);flow=null;return true;
  }
  return {get,start,cancel,back,next,setEmail,setCode,submitEmail,resendCode,submitCode,submitPassword,submitProfile,accept,invalidateCode};
})();
function startInstitutionalFlow(from,email){
  if(from==='selection'&&choiceOrigin==='inst-login'){choiceOrigin='entry';if(typeof render==='function')render();return}
  if(from==='selection')entryChoice='institucional';
  InstitutionalFlow.start(from,email);if(typeof render==='function')render();
}
function institutionalBack(){
  InstitutionalFlow.back();
  if(!InstitutionalFlow.get())entryChoice=null;
  if(typeof render==='function')render();
}
function institutionalCancel(){InstitutionalFlow.cancel();entryChoice=null;choiceOrigin='entry';if(typeof render==='function')render()}
function institutionalNext(){InstitutionalFlow.next();if(typeof render==='function')render()}
function institutionalProfileNext(){
  const a=$('#inst-profile-name'),b=$('#inst-profile-career');
  InstitutionalFlow.submitProfile(a?a.value:'',b?b.value:'');
  if(typeof render==='function')render();
}
function institutionalEmail(v){InstitutionalFlow.setEmail(v)}
function institutionalCode(v){InstitutionalFlow.setCode(v)}
function institutionalSubmitEmail(){InstitutionalFlow.submitEmail();if(typeof render==='function')render()}
function institutionalSubmitCode(){
  const input=$('#inst-code-input');if(input)InstitutionalFlow.setCode(input.value);
  const f=InstitutionalFlow.get();
  InstitutionalFlow.submitCode(f&&f.codeInput);if(typeof render==='function')render();
}
function institutionalResendCode(){InstitutionalFlow.resendCode();if(typeof render==='function')render()}
function institutionalCodeContinue(){const f=InstitutionalFlow.get();if(f&&f.verified){f.step='password';f.error=''};if(typeof render==='function')render()}
function institutionalChangeEmail(){InstitutionalFlow.back();if(typeof render==='function')render()}
function instTogglePass(id,btn){
  const i=document.getElementById(id);if(!i)return;
  const show=i.type==='password';i.type=show?'text':'password';
  if(btn){btn.textContent=show?'Ocultar':'Ver';btn.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña')}
}
function instPasswordInput(){
  const a=document.getElementById('inst-pass1'),b=document.getElementById('inst-pass2');
  const r=instPassRules(a?a.value:''),boxes=[['len',r.len],['letter',r.letter],['number',r.number]];
  boxes.forEach(([k,ok])=>{
    const el=document.getElementById('inst-rule-'+k);
    if(el){el.className=ok?'ok':'';el.textContent=(ok?'✓ ':'○ ')+el.textContent.slice(2)}
  });
  const s=document.getElementById('inst-pass-strength');
  if(s)s.textContent=instPassStrength(a?a.value:'');
  const match=document.getElementById('inst-rule-match');
  if(match){const ok=!!b&&!!a&&a.value===b.value;match.className=ok?'ok':'';match.textContent=(ok?'✓ ':'○ ')+'Las contraseñas coinciden'}
}
async function institutionalSubmitPassword(ev){
  if(ev)ev.preventDefault();
  const a=$('#inst-pass1'),b=$('#inst-pass2');
  await InstitutionalFlow.submitPassword(a?a.value:'',b?b.value:'');
  if(typeof render==='function')render();
}
function institutionalAccept(){
  const wasLinked=InstitutionalFlow.accept();
  if(wasLinked)instSessionSet();
  if(wasLinked&&typeof toast==='function')toast('Vinculado con la Universidad de Concepción (prototipo).');
  if(wasLinked&&typeof startInstitutionImport==='function')startInstitutionImport('consent');
  if(typeof render==='function')render();
}
function ensureInstitutionSetup(){
  if(!needsInstitutionSetup()||InstitutionalFlow.get())return false;
  if(typeof instImport!=='undefined'&&instImport)return false;
  InstitutionalFlow.start('migration',(S.account&&S.account.email)||'');
  return true;
}
function instFlowFocus(){
  const f=InstitutionalFlow.get();if(!f)return null;
  if(f.step==='login')return '#inst-email';
  if(f.step==='code')return f.verified?'[data-focus-id="inst-code-continue"]':'#inst-code-input';
  if(f.step==='password')return '#inst-pass1';
  if(f.step==='profile')return '#inst-profile-name';
  if(f.step==='consent')return '[data-focus-id="inst-consent-ok"]';
  return '[data-focus-id="inst-option-udec"]';
}
async function instLogin(ev){
  if(ev)ev.preventDefault();
  instLoginResetExpiredLock();
  if(instLoginLockRemaining()>0)return render();
  const input=$('#inst-login-pass'),pass=input?input.value:'';
  if(!pass){instLoginError='Escribe tu contraseña.';render();return}
  let ok=false;
  try{ok=await checkInstPassword(pass,S.account.auth)}catch(e){}
  if(ok){instSessionSet();instAuthFailures=0;instAuthLockUntil=0;instLoginError='';render();return}
  instAuthFailures++;instLoginError='Contraseña incorrecta.';
  if(instAuthFailures>=INST_LOGIN_ATTEMPTS){
    instAuthLockUntil=Date.now()+INST_LOGIN_LOCK_MS;instAuthFailures=INST_LOGIN_ATTEMPTS;
    instLoginError=`${INST_LOGIN_ATTEMPTS} contraseñas incorrectas. Espera 30 segundos antes de reintentar.`;
  }else instLoginError=`Contraseña incorrecta. Te quedan ${INST_LOGIN_ATTEMPTS-instAuthFailures} intentos.`;
  render();
}
function instLogout(){
  instSessionClear();instAuthFailures=0;instAuthLockUntil=0;instLoginError='';instPwMode='';render();
}
function instForgotPassword(){
  instSessionClear();instAuthFailures=0;instAuthLockUntil=0;instLoginError='';
  startInstitutionalFlow('forgot',(S.account&&S.account.email)||'');
}
async function instUsePersonal(){
  if(typeof askConfirm==='function'&&!await askConfirm({title:'Usar sin mi cuenta universitaria',text:'Volverás al modo Personal. Tus datos no se borran y la identidad institucional se quita.',okLabel:'Usar sin mi cuenta'}))return;
  choiceOrigin='entry';
  if(typeof disconnectInstitution==='function')await disconnectInstitution();
}
function instStartChangePassword(){instPwMode='change';render()}
function instCancelChangePassword(){instPwMode='';render()}
async function instSaveNewPassword(){
  const a=$('#inst-current-pass'),b=$('#inst-new-pass'),c=$('#inst-new-pass2');
  const current=a?a.value:'',next=b?b.value:'',repeat=c?c.value:'';
  let validCurrent=false;
  try{validCurrent=await checkInstPassword(current,S.account.auth)}catch(e){}
  if(!validCurrent||!instPassValid(next)||next!==repeat)return toast('Revisa la contraseña actual y la nueva (8 caracteres, letra y número).');
  try{
    S.account.auth=await makeInstAuth(next);save();instPwMode='';toast('Contraseña institucional cambiada.');render();
  }catch(e){toast('No pude cambiar la contraseña en este navegador.')}
}
function instAuthSyncTimer(){
  const active=!!document.querySelector('[data-auth-countdown]');
  if(active&&!instTimer)instTimer=setInterval(()=>{
    if(document.querySelector('[data-auth-countdown]')&&typeof render==='function')render();
  },1000);
  if(!active&&instTimer){clearInterval(instTimer);instTimer=null}
}
const INST_IMPORT_STEPS=['Ramos inscritos','Horario','Fechas de evaluación','Notas'];
let instImport=null,instImportNotice='';
const importedCourse=c=>!!(c&&c.origin==='udec-demo');
const importedCount=()=>S.courses.filter(importedCourse).length+S.classes.filter(x=>x.origin==='udec-demo').length+S.events.filter(x=>x.origin==='udec-demo').length;
function hasSyllabus(cid){return !!(S.certamen&&S.certamen.topicsByCourse&&Array.isArray(S.certamen.topicsByCourse[cid])&&S.certamen.topicsByCourse[cid].length)}
function startInstitutionImport(from){
  if(!isInstitutional())return;
  instImport={step:0,from:from||'cuenta',data:null,courses:[],error:''};
  instImportNotice='';render();runInstitutionImport();
}
async function runInstitutionImport(){
  if(!instImport||!isInstitutional())return;
  const a=S.account||{},inst=currentInstitution();
  if(typeof fetchInstitutionData!=='function'||!inst){instImport.error='La importación simulada no está disponible.';render();return}
  const data=await fetchInstitutionData(inst.id,a.email);
  if(!instImport||!isInstitutional())return;
  if(!data){instImport.error='No pude importar con esa cuenta institucional.';render();return}
  instImport.data=data;
  instImport.courses=data.courses.map(c=>({course:c,keep:!S.courses.some(x=>x.name===c.name),exists:S.courses.some(x=>x.name===c.name)}));
  instImport.step=4;render();
}
function setInstitutionCourse(i,keep){if(instImport&&instImport.courses[i])instImport.courses[i].keep=!!keep}
function cancelInstitutionImport(){instImport=null;instImportNotice='';render()}
function dismissInstitutionDone(){instImportNotice='';render()}
const institutionImportSummary=()=>instImport&&instImport.data?{
  courses:instImport.courses.filter(x=>x.keep).length,
  classes:instImport.data.classes.filter(k=>instImport.courses.some(x=>x.keep&&x.course.id===k.courseId)).length,
  events:instImport.data.events.filter(e=>instImport.courses.some(x=>x.keep&&x.course.id===e.courseId)).length,
  grades:instImport.data.courses.filter(c=>instImport.courses.some(x=>x.keep&&x.course.id===c.id)).reduce((n,c)=>n+(c.grades||[]).length,0)
}:{courses:0,classes:0,events:0,grades:0};
function confirmInstitutionImport(){
  if(!instImport||!instImport.data)return;
  const keep=instImport.courses.filter(x=>x.keep).map(x=>x.course),ids=keep.map(c=>c.id);
  let addedC=0,addedK=0,addedE=0;
  keep.forEach(c=>{
    if(S.courses.some(x=>x.name===c.name))return;
    S.courses.push({...c,grades:(c.grades||[]).map(g=>({...g})),share:false});addedC++;
  });
  instImport.data.classes.filter(k=>ids.includes(k.courseId)).forEach(k=>{
    if(S.classes.some(x=>x.courseId===k.courseId&&x.day===k.day&&x.start===k.start&&x.end===k.end))return;
    S.classes.push({...k});addedK++;
  });
  instImport.data.events.filter(e=>ids.includes(e.courseId)).forEach(e=>{
    if(S.events.some(x=>x.courseId===e.courseId&&x.title===e.title&&x.date===e.date))return;
    S.events.push({...e});addedE++;
  });
  instImport=null;instImportNotice='';
  if(addedC||addedK||addedE){
    if(addedC)S.lastPlan=null;
    save();if(typeof replanAll==='function')replanAll();
    if(S.courses.some(c=>importedCourse(c)&&!hasSyllabus(c.id)))instImportNotice='Listo. Lo único que falta es el syllabus de cada ramo';
    toast(`Agregué ${addedC} ramo(s), ${addedK} clase(s) y ${addedE} fecha(s) desde la UdeC (datos de ejemplo).`);
  }else toast('No hay datos nuevos para agregar.');
  if(typeof render==='function')render();
}
async function removeInstitutionData(skipConfirm=false){
  if(!importedCount())return toast('No hay datos importados desde la UdeC.');
  if(!skipConfirm&&!await askConfirm({title:'Quitar los datos importados',text:`Se borrarán solo ${importedCount()} dato(s) marcados como «Datos de ejemplo» de la UdeC: ramos, clases, fechas y notas. No se tocarán tus otros ramos ni tus datos de bienestar.`,okLabel:'Quitar datos',danger:true}))return;
  const ids=S.courses.filter(importedCourse).map(c=>c.id);
  S.courses=S.courses.filter(c=>!importedCourse(c));
  S.classes=S.classes.filter(k=>k.origin!=='udec-demo'&&!ids.includes(k.courseId));
  S.events=S.events.filter(e=>e.origin!=='udec-demo'&&!ids.includes(e.courseId));
  S.tasks=S.tasks.filter(t=>!ids.includes(t.courseId)&&!S.events.some(e=>e.id===t.eventId));
  S.sessions=S.sessions.filter(s=>!ids.includes(s.courseId));
  if(S.certamen){
    S.certamen.plans=(S.certamen.plans||[]).filter(p=>!ids.includes(p.courseId)&&S.events.some(e=>e.id===p.eventId));
    if(S.certamen.topicsByCourse&&typeof S.certamen.topicsByCourse==='object')ids.forEach(id=>delete S.certamen.topicsByCourse[id]);
  }
  save();if(typeof replanAll==='function')replanAll();
  instImport=null;instImportNotice='Datos de ejemplo de la UdeC quitados.';
  toast('Los datos importados fueron quitados. Tus otros datos siguen aquí.');render();
}
async function disconnectInstitution(opts){
  const skipConfirm=opts===true||!!(opts&&opts.skipConfirm);
  const n=importedCount();
  let keep=true;
  if(n&&!skipConfirm&&typeof askConfirm==='function')keep=await askConfirm({title:'Desconectar de tu universidad',text:`Tienes ${n} dato(s) importados desde la UdeC (ramos, horario, fechas y notas de ejemplo). ¿Quieres conservarlos o quitarlos al volver al modo Personal?`,okLabel:'Conservar mis datos',cancelLabel:'Quitar los importados'});
  const wasInstitutional=isInstitutional();
  unlinkInstitution();instImport=null;instImportNotice=keep?'Datos de ejemplo conservados.':'Datos de ejemplo de la UdeC quitados.';
  if(!keep&&wasInstitutional)await removeInstitutionData(true);
  toast(keep?'Volviste al modo Personal. Tus datos siguen aquí.':'Volviste al modo Personal y quité los datos importados.');render();
}
