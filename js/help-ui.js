/* Componentes reutilizables: botón/panel de ayuda y tour de bienvenida */
let tourIndex=0;

function screenHelp(){return ''}
let helpBtnKey='';
function placeHelpButton(key){
  if(key!==undefined)helpBtnKey=key||'';
  let btn=document.getElementById('help-btn');
  if(!helpBtnKey){if(btn)btn.remove();return}
  if(!btn){
    btn=document.createElement('button');btn.type='button';btn.id='help-btn';btn.className='help-btn';
    btn.title='Ayuda';btn.setAttribute('aria-label','Ayuda');btn.textContent='?';
    btn.onclick=()=>openHelp(helpBtnKey);
  }
  const mobile=window.matchMedia&&window.matchMedia('(max-width:640px)').matches;
  const target=(mobile&&document.querySelector('.subchips-wrap'))||document.querySelector('.hwrap');
  if(target&&btn.parentNode!==target)target.appendChild(btn);
}

function openHelp(key){
  const h=typeof AYUDA!=='undefined'&&AYUDA[key]; if(!h)return;
  const root=document.getElementById('help-root'); if(!root)return;
  const steps=(h.steps||[]).map(s=>`<li>${esc(s)}</li>`).join('');
  const body=`<p>${esc(h.desc||'')}</p>${steps?`<ol class="help-steps">${steps}</ol>`:''}`;
  const avatar=typeof arvisAvatarHtml==='function'?arvisAvatarHtml():'';
  root.innerHTML=`<div class="modal-backdrop" onclick="if(event.target===this)closeHelp()"><div class="modal-card help-modal" role="dialog" aria-modal="true" aria-label="${esc(h.title)}">
    <div class="modal-head"><h3>${esc(h.title)}</h3><button class="icon-btn" type="button" aria-label="Cerrar" onclick="closeHelp()">✕</button></div>
    <div class="modal-body">${avatar?`<div class="help-with-arvis">${avatar}<div>${body}</div></div>`:body}</div>
  </div></div>`;
  const btn=root.querySelector('.icon-btn'); if(btn)try{btn.focus()}catch(e){}
}

function closeHelp(){
  const root=document.getElementById('help-root'); if(root)root.innerHTML='';
}

function renderTour(){
  if(typeof TOUR_STEPS==='undefined')return;
  const root=document.getElementById('tour-root'); if(!root)return;
  const i=tourIndex, total=TOUR_STEPS.length, step=TOUR_STEPS[i]; if(!step)return;
  const dots=TOUR_STEPS.map((_,idx)=>`<span class="tour-dot ${idx===i?'on':''}" aria-hidden="true"></span>`).join('');
  const last=i===total-1;
  root.innerHTML=`<div class="modal-backdrop tour-backdrop"><div class="modal-card tour-modal" role="dialog" aria-modal="true" aria-label="Tutorial de bienvenida">
    <button class="tour-skip" type="button" onclick="finishTour()">Saltar</button>
    <div class="tour-icon" aria-hidden="true">${step.icon||''}</div>
    <h3 class="tour-title">${esc(step.title||'')}</h3>
    <p class="tour-text">${esc(step.text||'')}</p>
    <div class="tour-dots" aria-label="Paso ${i+1} de ${total}">${dots}</div>
    <div class="tour-actions">
      <button class="btn sec" type="button" onclick="tourPrev()" ${i===0?'disabled':''}>Atrás</button>
      <button class="btn" type="button" onclick="${last?'finishTour()':'tourNext()'}">${last?'Empezar':'Siguiente'}</button>
    </div>
  </div></div>`;
}

function startTour(force){
  if(typeof TOUR_STEPS==='undefined'||!TOUR_STEPS.length)return;
  tourIndex=0; renderTour();
}

function tourNext(){
  if(tourIndex<TOUR_STEPS.length-1){tourIndex++; renderTour();}
}

function tourPrev(){
  if(tourIndex>0){tourIndex--; renderTour();}
}

function finishTour(){
  try{localStorage.setItem(TOUR_SEEN_KEY,'1')}catch(e){}
  const root=document.getElementById('tour-root'); if(root)root.innerHTML='';
}

function maybeShowTour(){
  if(typeof S==='undefined'||!S.profile||!S.profile.name)return;
  if(typeof entryReady==='function'&&!entryReady())return;
  if(typeof LOCKED!=='undefined'&&LOCKED)return;
  const root=document.getElementById('tour-root');
  if(root&&root.innerHTML.trim())return;
  try{if(localStorage.getItem(TOUR_SEEN_KEY))return}catch(e){}
  startTour(false);
}
