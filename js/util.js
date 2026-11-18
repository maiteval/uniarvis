/* U.A.R.V.I.S. · Utilidades: fechas, formato, helpers */
/* ===================== Utilidades ===================== */
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return fmt(d)};
const diffDays=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const today=()=>fmt(new Date());
const mondayOf=s=>addDays(s,-((parse(s).getDay()+6)%7));
const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const comma=v=>String(v).replace('.',',');
const parseNum=v=>parseFloat(String(v==null?'':v).replace(',','.'));
const toMin=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const dshort=s=>{const d=parse(s);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const COLORS=['#3b6df0','#e0693a','#2e9e6a','#a855c7','#d6a21f','#16a0b8','#d6507a','#6b7384'];
const TYPE_LABEL={evaluacion:'Evaluación',entrega:'Entrega',control:'Control',otro:'Otro'};
const THEMES=[['cian','Cian','#00e5ff'],['rosa','Rosa claro','#ff8fc7'],['celeste','Celeste','#38bdf8'],['azul','Azul','#2563eb'],['verde','Verde','#22c55e'],['naranjo','Naranjo','#f97316'],['morado','Morado','#a855f7'],['amarillo','Amarillo','#eab308']];
const MODES=[['dark','Oscuro'],['light','Claro']];
const STYLES=[['calma','Calma'],['hud','HUD']];
const themeOk=id=>THEMES.some(t=>t[0]===id);
const modeOk=id=>MODES.some(m=>m[0]===id);
const styleOk=id=>STYLES.some(s=>s[0]===id);
function applyTheme(){
  const st=(S&&S.settings)||{};
  const el=document.documentElement;
  el.setAttribute('data-accent',themeOk(st.theme)?st.theme:'cian');
  el.setAttribute('data-mode',modeOk(st.mode)?st.mode:'light');
  el.setAttribute('data-style',styleOk(st.style)?st.style:'calma');
  const inst=typeof currentInstitution==='function'?currentInstitution():null;
  el.setAttribute('data-institution',inst?inst.id:'');
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=st.mode==='light'?'#f4f7fb':'#050b14';
}
function toast(msg,undo){
  const t=$('#toast');if(!t)return;
  t.innerHTML='';
  t.appendChild(document.createTextNode(String(msg)));
  if(typeof undo==='function'){
    const b=document.createElement('button');b.type='button';b.className='toast-undo';b.textContent='Deshacer';b.setAttribute('aria-label','Deshacer la última acción');
    b.onclick=()=>{clearTimeout(toast.h);undo();t.classList.remove('on')};
    t.appendChild(b);
  }
  t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),undo?6000:4500);
}
let confirmResolve=null,confirmReturn=null;
function closeConfirm(value){
  if(confirmResolve){const done=confirmResolve;confirmResolve=null;done(!!value)}
  const box=$('#confirm-dialog');if(box){box.hidden=true;box.innerHTML=''}
  const back=confirmReturn;confirmReturn=null;
  if(back&&document.contains(back))try{back.focus({preventScroll:true})}catch(e){}
}
function askConfirm({title='¿Confirmar?',text='',okLabel='Continuar',cancelLabel='Cancelar',danger=false,requireWord=null}={}){
  return new Promise(resolve=>{
    if(confirmResolve)closeConfirm(false);
    confirmResolve=resolve;confirmReturn=document.activeElement;
    let box=$('#confirm-dialog');
    if(!box){box=document.createElement('div');box.id='confirm-dialog';box.className='modal-backdrop';box.hidden=true;document.body.appendChild(box)}
    const word=requireWord?`<label class="confirm-word">Para confirmar, escribe <b>${esc(requireWord)}</b><input id="confirm-word" autocomplete="off" spellcheck="false"></label>`:'';
    box.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <h2 id="confirm-title">${esc(title)}</h2><p id="confirm-text">${esc(text).replace(/\n/g,'<br>')}</p>${word}
      <div class="row"><button type="button" class="btn sec" id="confirm-cancel">${esc(cancelLabel)}</button>
      <button type="button" class="btn ${danger?'danger':'sec'}" id="confirm-ok" ${requireWord?'disabled':''}>${esc(okLabel)}</button></div></div>`;
    box.hidden=false;
    const okBtn=$('#confirm-ok'),cancelBtn=$('#confirm-cancel'),input=$('#confirm-word');
    if(input)input.addEventListener('input',()=>{okBtn.disabled=input.value!==requireWord});
    okBtn.onclick=()=>closeConfirm(true);cancelBtn.onclick=()=>closeConfirm(false);
    box.onclick=e=>{if(e.target===box)closeConfirm(false)};
    box.onkeydown=e=>{
      if(e.key==='Escape'){e.preventDefault();closeConfirm(false);return}
      if(e.key!=='Tab')return;
      const f=[...box.querySelectorAll('button:not([disabled]),input:not([disabled])')];
      if(!f.length)return;
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}
      else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}
    };
    setTimeout(()=>{try{(input||okBtn).focus({preventScroll:true})}catch(e){(input||okBtn).focus()}},0);
  });
}
