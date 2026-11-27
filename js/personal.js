/* U.A.R.V.I.S. · Actividades personales (gimnasio, trabajo, salud, otras) */
/* Bloquean tiempo en el plan: el planificador no pone sesiones encima y la capacidad del día baja.
   Se guardan solo en este dispositivo; no se comparten con amigos ni con la institución. */
const PERSONAL_KINDS={
  deporte:{label:'Deporte',color:'#2e9e6a'},
  trabajo:{label:'Trabajo',color:'#c27a1a'},
  salud:{label:'Salud',color:'#d0577a'},
  otro:{label:'Otro',color:'#7a7f8c'}
};
const PERSONAL_MAX=60;
const personalKindOk=k=>Object.prototype.hasOwnProperty.call(PERSONAL_KINDS,k);
// En "Salud" no se guarda detalle: solo la categoría, por privacidad.
const personalLabel=a=>a.kind==='salud'?'Salud':(a.title||PERSONAL_KINDS[a.kind].label);
const personalColor=a=>(PERSONAL_KINDS[a.kind]||PERSONAL_KINDS.otro).color;
const personalWhen=a=>a.date?`${dshort(a.date)} (una vez)`:a.days.map(d=>DAYS[d]).join(', ');

function validPersonal(a){
  if(!a||typeof a!=='object'||Array.isArray(a))return false;
  if(!RX.id.test(a.id||'')||!personalKindOk(a.kind))return false;
  if(typeof a.title!=='string'||a.title.length>60)return false;
  if(!RX.time.test(a.start||'')||!RX.time.test(a.end||'')||toMin(a.end)<=toMin(a.start))return false;
  if(a.date!==undefined)return RX.date.test(a.date)&&a.days===undefined;
  return Array.isArray(a.days)&&a.days.length>=1&&a.days.length<=7&&a.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6);
}
function cleanPersonal(list){
  if(!Array.isArray(list))return [];
  return list.filter(validPersonal).slice(0,PERSONAL_MAX).map(a=>{
    const o={id:a.id,kind:a.kind,title:a.kind==='salud'?'':a.title.trim().slice(0,60),start:a.start,end:a.end};
    if(a.date)o.date=a.date;else o.days=[...new Set(a.days)].sort((x,y)=>x-y);
    return o;
  });
}
function personalOn(date){
  const dow=(parse(date).getDay()+6)%7;
  return (S.personal||[]).filter(a=>a.date?a.date===date:a.days.includes(dow))
    .sort((a,b)=>toMin(a.start)-toMin(b.start));
}
const personalWindows=date=>personalOn(date).map(a=>({a:toMin(a.start),b:toMin(a.end)}));
const personalMinutesOn=date=>personalOn(date).reduce((s,a)=>s+toMin(a.end)-toMin(a.start),0);

/* ---------- Vista: Planificación → Mi horario ---------- */
let personalRepeat='semanal';
function viewHorario(){
  const list=(S.personal||[]).slice().sort((a,b)=>(a.date?1:0)-(b.date?1:0)||(a.date||'').localeCompare(b.date||'')||
    (a.days?a.days[0]:0)-(b.days?b.days[0]:0)||toMin(a.start)-toMin(b.start));
  const kinds=Object.entries(PERSONAL_KINDS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  const days=DAYS.map((d,i)=>`<label class="pa-day"><input type="checkbox" value="${i}" class="pa-dow"> ${d}</label>`).join('');
  return `<div class="grid">
    <div class="card"><h2>Mi horario</h2>
      <p class="mute">Agrega lo que ocupa tu tiempo fuera de la universidad: gimnasio, trabajo, horas médicas u otras actividades. El plan no pondrá sesiones de estudio encima y ajustará cuánto puedes estudiar ese día.</p>
      <div class="row form-stack" style="margin-top:10px">
        <span class="diff-field"><label for="pa-kind">Tipo</label>
          <select id="pa-kind" onchange="personalKindChange()">${kinds}</select></span>
        <span class="diff-field" id="pa-title-wrap"><label for="pa-title">Nombre</label>
          <input id="pa-title" maxlength="60" placeholder="Ej: Gimnasio"></span>
      </div>
      <p class="mute" id="pa-salud-note" style="display:none">Por privacidad, en Salud solo se guarda la categoría, sin detalles.</p>
      <div class="row pa-repeat" role="radiogroup" aria-label="Frecuencia" style="margin-top:10px">
        <label><input type="radio" name="pa-rep" value="semanal" ${personalRepeat==='semanal'?'checked':''} onchange="personalRepeatChange('semanal')"> Todas las semanas</label>
        <label><input type="radio" name="pa-rep" value="fecha" ${personalRepeat==='fecha'?'checked':''} onchange="personalRepeatChange('fecha')"> Una sola fecha</label>
      </div>
      <div class="row" id="pa-days-wrap" style="margin-top:8px;${personalRepeat==='semanal'?'':'display:none'}"><div class="pa-days" role="group" aria-label="Días">${days}</div></div>
      <div class="row" id="pa-date-wrap" style="margin-top:8px;${personalRepeat==='fecha'?'':'display:none'}"><label for="pa-date" class="sr-only">Fecha</label><input id="pa-date" type="date" value="${today()}" min="${today()}"></div>
      <div class="row" style="margin-top:8px">
        <label for="pa-start" class="sr-only">Desde</label><input id="pa-start" type="time" value="18:00">
        <label for="pa-end" class="sr-only">Hasta</label><input id="pa-end" type="time" value="19:30">
        <button class="btn" data-focus-id="add-personal" onclick="addPersonal()">Agregar</button></div>
    </div>
    <div class="card"><h2>Tus actividades</h2>
      ${list.length?list.map(a=>`<div class="task"><span aria-hidden="true" class="dot" style="background:${personalColor(a)}"></span>
        <span style="flex:1"><b>${esc(personalLabel(a))}</b> · ${esc(personalWhen(a))} · ${a.start}–${a.end}</span>
        <button class="btn del" aria-label="Quitar ${esc(personalLabel(a))}" onclick="delPersonal('${a.id}')">Quitar</button></div>`).join('')
        :'<p class="mute">Aún no agregas actividades. Si tienes trabajo, deporte u otros compromisos fijos, agrégalos para que el plan sea realista.</p>'}
      <p class="mute">Se guardan solo en este dispositivo y no se comparten con amigos ni con tu universidad.</p>
    </div>
  </div>`;
}
function personalKindChange(){
  const salud=($('#pa-kind')||{}).value==='salud';
  const w=$('#pa-title-wrap'),n=$('#pa-salud-note');
  if(w)w.style.display=salud?'none':'';if(n)n.style.display=salud?'':'none';
}
function personalRepeatChange(v){
  personalRepeat=v==='fecha'?'fecha':'semanal';
  const d=$('#pa-days-wrap'),f=$('#pa-date-wrap');
  if(d)d.style.display=personalRepeat==='semanal'?'':'none';if(f)f.style.display=personalRepeat==='fecha'?'':'none';
}
function addPersonal(){
  const kind=($('#pa-kind')||{}).value,title=String(($('#pa-title')||{}).value||'').trim();
  const start=($('#pa-start')||{}).value,end=($('#pa-end')||{}).value;
  if(!personalKindOk(kind))return toast('Elige un tipo de actividad.');
  if(!RX.time.test(start||'')||!RX.time.test(end||'')||toMin(end)<=toMin(start))return toast('Revisa las horas: la hora de término debe ser posterior a la de inicio.');
  if((S.personal||[]).length>=PERSONAL_MAX)return toast(`Puedes tener hasta ${PERSONAL_MAX} actividades.`);
  const a={id:uid(),kind,title:kind==='salud'?'':title.slice(0,60),start,end};
  if(personalRepeat==='fecha'){
    const d=($('#pa-date')||{}).value;
    if(!RX.date.test(d||''))return toast('Elige una fecha.');
    if(d<today())return toast('La fecha ya pasó.');
    a.date=d;
  }else{
    const ds=[...document.querySelectorAll('.pa-dow:checked')].map(x=>+x.value);
    if(!ds.length)return toast('Marca al menos un día.');
    a.days=ds.sort((x,y)=>x-y);
  }
  if(!validPersonal(a))return toast('Revisa los datos de la actividad.');
  if(!Array.isArray(S.personal))S.personal=[];
  S.personal.push(a);save();replanAll();render();
  toast(`Agregado: ${personalLabel(a)}. El plan ya lo considera.`);
}
function delPersonal(id){undoable('Actividad eliminada.',()=>{S.personal=(S.personal||[]).filter(x=>x.id!==id)},replanAll)}
