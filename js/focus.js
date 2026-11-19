let focusState=null;
const focusActive=()=>!!focusState;
const focusKind=()=>focusState&&focusState.kind;
function focusOpen(opts){
  if(!opts||typeof opts.content!=='function')return;
  focusState=opts;
  document.body.classList.add('focus-open');
  focusRender();
}
function focusRender(){
  const root=$('#focus-root');
  if(!root||!focusState)return;
  const title=String(focusState.title||'Modo foco');
  root.innerHTML=`<section class="focus-overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="focus-head"><h2>${esc(title)}</h2><button type="button" class="btn sec focus-exit" data-focus-id="focus-exit" onclick="focusClose()">✕ <span>Salir</span></button></div>
    <div class="focus-body">${focusState.content()}</div>
  </section>`;
}
function focusClose(){
  if(!focusState)return;
  const done=focusState.onClose;
  focusState=null;
  const root=$('#focus-root');
  if(root)root.innerHTML='';
  document.body.classList.remove('focus-open');
  if(typeof done==='function')done();
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&focusState){e.preventDefault();e.stopPropagation();focusClose()}
},true);
