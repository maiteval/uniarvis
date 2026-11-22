/* U.A.R.V.I.S. · Render principal y arranque */
/* ===================== Render ===================== */
const SECTIONS=[
  {key:'inicio',label:'Inicio',tabs:[]},
  {key:'planificacion',label:'Planificación',tabs:[['hoy','Hoy'],['semana','Semana']]},
  {key:'academico',label:'Académico',tabs:[['ramos','Ramos'],['syllabus','Fechas'],['notas','Notas'],['herramientas','Herramientas'],['salud','Carga por semana']]},
  {key:'bienestar',label:'Bienestar',tabs:[['checkin','Check-in'],['respiracion','Respiración'],['pausas','Pausas rápidas'],['apoyo','Apoyo']]},
  {key:'social',label:'Social',tabs:[['amigos','Amigos']]},
  {key:'ajustes',label:'Ajustes',tabs:[['perfil','Perfil'],['cuenta','Cuenta'],['tema','Apariencia'],['privacidad','Privacidad'],['ejemplos','Datos de ejemplo']]}

];
const ROUTE={
  inicio:{section:'inicio',tab:'inicio'},
  hoy:{section:'planificacion',tab:'hoy'},semana:{section:'planificacion',tab:'semana'},
  ramos:{section:'academico',tab:'ramos'},syllabus:{section:'academico',tab:'syllabus'},notas:{section:'academico',tab:'notas'},herramientas:{section:'academico',tab:'herramientas'},
  salud:{section:'academico',tab:'salud'},calor:{section:'academico',tab:'salud'},
  checkin:{section:'bienestar',tab:'checkin'},bienestar:{section:'bienestar',tab:'checkin'},respiracion:{section:'bienestar',tab:'respiracion'},
  pausas:{section:'bienestar',tab:'pausas'},apoyo:{section:'bienestar',tab:'apoyo'},
  amigos:{section:'social',tab:'amigos'},
  perfil:{section:'ajustes',tab:'perfil'},cuenta:{section:'ajustes',tab:'cuenta'},tema:{section:'ajustes',tab:'tema'},apariencia:{section:'ajustes',tab:'tema'},
  privacidad:{section:'ajustes',tab:'privacidad'},ejemplos:{section:'ajustes',tab:'ejemplos'}
};
const FIRST={inicio:'inicio',planificacion:'hoy',academico:'ramos',bienestar:'checkin',social:'amigos',ajustes:'perfil'};
const ROUTE_BY_PATH={};
Object.keys(ROUTE).forEach(k=>{const r=ROUTE[k],p=r.section+'/'+r.tab;if(!ROUTE_BY_PATH[p])ROUTE_BY_PATH[p]=r});
function routeFor(t){const k=String(t||'');return ROUTE[k]||(FIRST[k]?ROUTE[FIRST[k]]:ROUTE.inicio)}
function hashFor(r){return r.section==='inicio'?'#/inicio':'#/'+r.section+'/'+r.tab}
function routeFromHash(){
  const raw=decodeURIComponent(location.hash.replace(/^#\/?/,'')).replace(/\/+$/,'');
  if(!raw||raw==='inicio')return ROUTE.inicio;
  const p=raw.split('/');
  const hit=ROUTE_BY_PATH[p[0]+'/'+(p[1]||'')];
  if(hit)return hit;
  return FIRST[p[0]]?ROUTE[FIRST[p[0]]]:ROUTE.inicio;
}
function goFromRoute(){const r=routeFromHash();if(r.section!==section||r.tab!==tab)go(r.tab,true)}
let lastRenderKey='';
function renderTarget(desc){
  if(!desc)return null;
  if(desc.id)return document.getElementById(desc.id);
  if(!desc.data)return null;
  return document.querySelector('[data-focus-id="'+String(desc.data).replace(/"/g,'\\"')+'"]');
}
const HOME_ICONS=[
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M3.5 9.5h17M8 13h3M13 13h3M8 16h3"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 19.5h6.5a2 2 0 0 1 2 2v-13a3 3 0 0 0-3-3H4.5z"/><path d="M19.5 19.5H13a2 2 0 0 0-2 2v-13a3 3 0 0 1 3-3h5.5z"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20s-7-4.35-7-9.2A4.3 4.3 0 0 1 9.3 6.5c1.2 0 2.2.5 2.7 1.4.5-.9 1.5-1.4 2.7-1.4A4.3 4.3 0 0 1 19 10.8C19 15.65 12 20 12 20z"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M3.5 18.5a5.5 5.5 0 0 1 11 0"/><path d="M14.5 18.5c0-1.8.9-3.4 2.3-4.3a4.2 4.2 0 0 1 5.7 3.8"/></svg>',
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.7 6.7l1.6 1.6M15.7 15.7l1.6 1.6M17.3 6.7l-1.6 1.6M8.3 15.7l-1.6 1.6"/></svg>'
];
function mobileNavHtml(){
  const secs=SECTIONS.filter(s=>s.key!=='inicio');
  const items=secs.map((s,i)=>`<button class="mob-nav-btn ${s.key===section?'on':''}" ${s.key===section?'aria-current="page"':''} onclick="go('${s.tabs[0][0]}')"><span class="mob-nav-icon">${HOME_ICONS[i]||''}</span><span>${s.label}</span></button>`).join('');
  return `<nav class="mobile-nav" aria-label="Secciones">${items}</nav>`;
}
function entryReady(){
  if(LOCKED||!S.account||!S.account.type)return false;
  if(typeof InstitutionalFlow!=='undefined'&&InstitutionalFlow.get())return false;
  if(typeof instImport!=='undefined'&&instImport)return false;
  if(typeof needsInstLogin==='function'&&needsInstLogin())return false;
  if(typeof needsInstitutionSetup==='function'&&needsInstitutionSetup())return false;
  return true;
}
function renderCore(){
  const needLogin=!LOCKED&&typeof needsInstLogin==='function'&&needsInstLogin();
  if(!LOCKED&&!needLogin&&typeof ensureInstitutionSetup==='function')ensureInstitutionSetup();
  const flowActive=typeof InstitutionalFlow!=='undefined'&&InstitutionalFlow.get();
  const noMode=!S.account||!S.account.type;
  let key;
  if(LOCKED)key='lock';
  else if(flowActive)key='flow';
  else if(choiceOrigin==='inst-login')key='account-choice';
  else if(noMode)key=(entryChoice==='personal'?'landing':'account-choice');
  else if(needLogin)key='inst-login';
  else if(typeof instImport!=='undefined'&&instImport)key='inst-import';
  else key=section+'/'+tab;
  const helpKey=(LOCKED||key==='flow'||key==='account-choice'||key==='inst-import'||key==='inst-login'||key==='landing'||!S.profile||!S.profile.name||typeof AYUDA==='undefined'||!AYUDA[tab])?'':tab;
  const same=key===lastRenderKey;
  const active=document.activeElement;
  const focus=active&&active!==document.body?{id:active.id||'',data:(active.dataset&&active.dataset.focusId)||''}:null;
  let sel=null;
  try{if(active&&typeof active.selectionStart==='number')sel=[active.selectionStart,active.selectionEnd]}catch(e){}
  const winY=same?window.scrollY:0;
  const inner=[];
  document.querySelectorAll('[data-scroll-id]').forEach(el=>inner.push([el.dataset.scrollId,el.scrollTop,el.scrollLeft]));
  const app=$('#app');
  const finish=fallback=>{
    if(same){
      app.classList.remove('route-enter');
      let target=renderTarget(focus);
      if(target){
        try{target.focus({preventScroll:true})}catch(e){try{target.focus()}catch(f){}}
        if(sel&&typeof target.setSelectionRange==='function')try{target.setSelectionRange(sel[0],sel[1])}catch(e){}
      }else if(fallback)try{fallback.focus({preventScroll:true})}catch(e){}
      inner.forEach(([id,top,left])=>{
        const el=document.querySelector('[data-scroll-id="'+String(id).replace(/"/g,'\\"')+'"]');
        if(el){try{el.scrollTop=top;el.scrollLeft=left}catch(e){}}
      });
      try{window.scrollTo({top:winY,left:0,behavior:'instant'})}catch(e){}
    }else{
      app.classList.remove('route-enter');void app.offsetWidth;app.classList.add('route-enter');
      try{window.scrollTo({top:0,left:0,behavior:'instant'})}catch(e){}
      lastRenderKey=key;
    }
    if(typeof placeHelpButton==='function')placeHelpButton(helpKey);
  };
  applyTheme();
  if(LOCKED){
    document.body.classList.remove('landing-active');$('#nav').innerHTML='';
    let mob=$('#mobile-nav');if(mob)mob.remove();
    app.innerHTML=lockView();finish($('#lp'));return;
  }
  if(key==='inst-login'){
    document.body.classList.add('landing-active');$('#nav').innerHTML='';
    let mob=$('#mobile-nav');if(mob)mob.remove();
    app.innerHTML=viewInstLogin();finish($('#inst-login-pass'));return;
  }
  if(key==='flow'||key==='account-choice'||key==='inst-import'){
    document.body.classList.add('landing-active');$('#nav').innerHTML='';
    let mob=$('#mobile-nav');if(mob)mob.remove();
    app.innerHTML=key==='inst-import'?(instImport&&instImport.data?institutionPreviewHtml():institutionImportHtml()):(key==='flow'?viewInstitutionalFlow():viewAccountChoice());
    const focusSel=key==='flow'&&typeof instFlowFocus==='function'?instFlowFocus():null;
    const fallback=key==='account-choice'?$('[data-focus-id="account-personal"]'):null;
    finish(key==='flow'?(focusSel?$(focusSel):null):fallback);return;
  }
  if(key==='landing'){
    document.body.classList.add('landing-active');$('#nav').innerHTML='';
    let mob=$('#mobile-nav');if(mob)mob.remove();
    app.innerHTML=viewLanding();finish($('#reg-name'));return;
  }
  document.body.classList.remove('landing-active');
  const shownName=typeof displayName==='function'?displayName():'';
  const who=shownName?`<span class="hud-user"> · ${esc(shownName)}</span>`:'';
  const brand=document.querySelector('.brand');
  if(brand)brand.innerHTML='U.A.R.V.I.S.'+who;
  if(section==='inicio'){
    $('#nav').innerHTML='';
    let mob=$('#mobile-nav');if(mob)mob.remove();
  }else{
    const sec=SECTIONS.find(s=>s.key===section)||SECTIONS[0];
    const tabs=sec.tabs.map(([k,v])=>`<button class="${k===tab?'on':''}" ${k===tab?'aria-current="page"':''} data-focus-id="nav-${k}" onclick="go('${k}')">${v}</button>`).join('');
    $('#nav').innerHTML=`<button class="back" aria-label="Volver al inicio" data-focus-id="nav-back" onclick="go('inicio')">← Inicio</button><span class="crumb">${sec.label}</span><span class="subtabs" data-scroll-id="subtabs">${tabs}</span>`;
    let mob=$('#mobile-nav');
    if(!mob){mob=document.createElement('div');mob.id='mobile-nav';document.body.appendChild(mob)}
    mob.innerHTML=mobileNavHtml();
  }
  const views={inicio:viewInicio,hoy:viewHoy,semana:viewSemana,ramos:viewRamos,syllabus:viewSyllabus,notas:viewNotas,herramientas:viewTools,salud:viewSalud,
    checkin:viewCheckin,bienestar:viewBienestar,respiracion:viewRespiracion,pausas:viewPausas,apoyo:viewApoyo,
    amigos:viewAmigos,perfil:viewPerfil,cuenta:viewCuenta,tema:viewTema,privacidad:viewPrivacidad,ejemplos:viewDatosEjemplo};
  const sec=SECTIONS.find(s=>s.key===section);
  let chips='';
  if(sec&&sec.tabs.length&&section!=='inicio'){
    chips=`<div class="subchips-wrap"><div class="subchips" data-scroll-id="subchips">${sec.tabs.map(([k,v])=>`<button class="subchip ${k===tab?'on':''}" ${k===tab?'aria-current="page"':''} onclick="go('${k}')">${v}</button>`).join('')}</div></div>`;
  }
  const abiertos=same?[...app.querySelectorAll('details[id]')].map(d=>[d.id,d.open]):[];   // los paneles plegables conservan su estado al redibujar
  app.innerHTML=chips+(views[tab]||viewInicio)();
  abiertos.forEach(([id,o])=>{const d=document.getElementById(id);if(d&&d.tagName==='DETAILS')d.open=o});
  finish();
  if(typeof maybeShowTour==='function')maybeShowTour();
}
function render(){renderCore();if(typeof instAuthSyncTimer==='function')instAuthSyncTimer();if(typeof chatSync==='function')chatSync()}
let lastPlanDay=today();
function checkNewDay(previous){
  const prev=previous||lastPlanDay,d=today();
  if(prev===d)return false;
  lastPlanDay=d;
  if(LOCKED||!S.profile||!S.profile.name||!S.courses.length||S.lastPlan===d)return false;
  replanAll();
  toast('Es un nuevo día: reorganicé lo pendiente para que no se acumule.');
  render();
  return true;
}
function start(){
  loadDraft();
  if(typeof pomResume==='function')pomResume();
  lastPlanDay=today();
  if(S.lastPlan!==today()&&S.courses.length)replanAll();
  const r=routeFromHash();section=r.section;tab=r.tab;
  const h=hashFor(r);
  try{if(location.hash!==h)history.replaceState(null,'',h)}catch(e){try{location.hash=h}catch(f){}}
  render();
  window.addEventListener('resize',()=>{if(typeof placeHelpButton==='function')placeHelpButton()});
  if(typeof socialBoot==='function')socialBoot();
  if(tab==='amigos'&&typeof socialOpenTab==='function')socialOpenTab();
  if(typeof metricsTrack==='function')metricsTrack('app_abierta');
}
window.addEventListener('hashchange',goFromRoute);
window.addEventListener('popstate',goFromRoute);
window.addEventListener('focus',()=>checkNewDay());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkNewDay()});
setInterval(()=>checkNewDay(),60000);
boot();
if(LOCKED)render();else start();

/* App instalable y utilizable sin internet (el service worker solo funciona en https o localhost) */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}   // pide que el navegador no borre estos datos solo
