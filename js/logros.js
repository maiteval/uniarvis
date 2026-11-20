/* U.A.R.V.I.S. · Logros locales y accesorios de Arvis */
function logrosCfg(){
  if(typeof S==='undefined'||!S)return cleanArvisConfig(null);
  if(!S.settings.arvis||typeof S.settings.arvis!=='object'||Array.isArray(S.settings.arvis))S.settings.arvis=cleanArvisConfig(S.settings.arvis);
  return S.settings.arvis;
}
const logrosDiario=()=>(S&&S.wellbeing&&S.wellbeing.diary)||[];
const logrosCheckins=()=>logrosDiario().filter(e=>e&&e.energy!=null).length;
function logrosSemanasConSesion(){
  const out=new Set();
  (S&&S.sessions||[]).forEach(s=>{if(s&&s.date)out.add(mondayOf(s.date))});
  return out;
}
function logrosRachaSemanas(n){
  const weeks=logrosSemanasConSesion();
  let w=mondayOf(today());
  if(!weeks.has(w))w=addDays(w,-7);
  let c=0;
  while(weeks.has(w)&&c<260){c++;w=addDays(w,-7)}
  return {actual:c,total:n,hecho:c>=n};
}
function logrosSemanasEvaluaciones(){
  const out={};
  (S&&S.events||[]).forEach(e=>{
    if(!e||(e.type!=='evaluacion'&&e.type!=='control'))return;
    const w=mondayOf(e.date);out[w]=(out[w]||0)+1;
  });
  return out;
}
function logrosEvaluacionesPorSemana(){
  const m=logrosSemanasEvaluaciones(),actual=mondayOf(today());
  return Object.keys(m).filter(w=>w<actual).reduce((a,w)=>Math.max(a,m[w]),0);
}
function logrosNochesBuenas(){
  const d=logrosDiario(),bueno=x=>{const e=d.find(y=>y.date===x);return !!e&&Number(e.sleep)>=4};
  let day=bueno(today())?today():addDays(today(),-1),n=0;
  while(n<3&&bueno(day)){n++;day=addDays(day,-1)}
  return n;
}
const LOGROS=[
  {id:'primer-paso',nombre:'Primer paso',descripcion:'Completaste tu registro inicial.',como:'Completa el onboarding',accesorio:'mochila',
    condicion:()=>logrosCfg().usos.onboarding===true,progreso:()=>({actual:logrosCfg().usos.onboarding?1:0,total:1})},
  {id:'bateria-cargada',nombre:'Batería cargada',descripcion:'Hiciste tu primer check-in.',como:'Haz tu primer check-in',accesorio:'lentes-sol',
    condicion:()=>logrosCheckins()>=1,progreso:()=>({actual:Math.min(1,logrosCheckins()),total:1})},
  {id:'constancia',nombre:'Constancia',descripcion:'Dos semanas seguidas con estudio, sin exigir todos los días.',como:'Estudia al menos una vez en 2 semanas seguidas',accesorio:'gorro-lana',
    condicion:()=>logrosRachaSemanas(2).hecho,progreso:()=>logrosRachaSemanas(2)},
  {id:'imparable',nombre:'Imparable (con calma)',descripcion:'Cuatro semanas seguidas con al menos una sesión.',como:'Estudia al menos una vez en 4 semanas seguidas',accesorio:'capa',
    condicion:()=>logrosRachaSemanas(4).hecho,progreso:()=>logrosRachaSemanas(4)},
  {id:'foco',nombre:'Foco',descripcion:'Completaste diez pomodoros sin sumar horas extra.',como:'Completa 10 pomodoros',accesorio:'audifonos',
    condicion:()=>((S&&S.tools&&S.tools.pomodoro&&S.tools.pomodoro.completed)||0)>=10,
    progreso:()=>({actual:Math.min(10,(S&&S.tools&&S.tools.pomodoro&&S.tools.pomodoro.completed)||0),total:10})},
  {id:'memoria',nombre:'Memoria de elefante',descripcion:'Acertaste cincuenta flashcards.',como:'Acerta 50 flashcards',accesorio:'lapiz-gigante',
    condicion:()=>((S&&S.tools&&S.tools.flashcards&&S.tools.flashcards.correct)||0)>=50,
    progreso:()=>({actual:Math.min(50,(S&&S.tools&&S.tools.flashcards&&S.tools.flashcards.correct)||0),total:50})},
  {id:'sobreviviste',nombre:'Sobreviviste',descripcion:'Terminaste una semana con dos evaluaciones.',como:'Termina una semana con 2 evaluaciones',accesorio:'birrete',
    condicion:()=>logrosEvaluacionesPorSemana()>=2,progreso:()=>({actual:Math.min(2,logrosEvaluacionesPorSemana()),total:2})},
  {id:'descansar',nombre:'Descansar también cuenta',descripcion:'Tres días marcados como descanso.',como:'Marca 3 días de descanso',accesorio:'gorro-dormir',pronto:true,
    condicion:()=>false,progreso:()=>({actual:0,total:3})},
  {id:'buen-dormir',nombre:'Buen dormir',descripcion:'Tres noches seguidas con buen sueño en el check-in.',como:'Registra 3 noches seguidas con sueño bueno',accesorio:'corona-flores',
    condicion:()=>logrosNochesBuenas()>=3,progreso:()=>({actual:Math.min(3,logrosNochesBuenas()),total:3})},
  {id:'numeros',nombre:'Sabe sus números',descripcion:'Usaste la calculadora de notas.',como:'Usa la calculadora de notas',accesorio:'lentes-redondos',
    condicion:()=>logrosCfg().usos.notas===true,progreso:()=>({actual:logrosCfg().usos.notas?1:0,total:1})},
  {id:'cafe',nombre:'Café de emergencia',descripcion:'Activaste el modo certamen.',como:'Activa el modo certamen',accesorio:'taza-cafe',
    condicion:()=>logrosCfg().usos.certamen===true,progreso:()=>({actual:logrosCfg().usos.certamen?1:0,total:1})}
];
const logroPorId=id=>LOGROS.find(l=>l.id===id)||null;
const logroPorAccesorio=id=>LOGROS.find(l=>l.accesorio===id)||null;
function logrosMarcoUso(k){
  const c=logrosCfg();
  if(Object.prototype.hasOwnProperty.call(c.usos,k))c.usos[k]=true;
  save();
}
function logrosProgreso(l){
  if(!l)return {actual:0,total:1,texto:'Próximamente'};
  if(l.pronto)return {actual:0,total:1,texto:'Próximamente'};
  let p={actual:0,total:1};
  try{p=l.progreso()||p}catch(e){p={actual:l.condicion()?1:0,total:1}}
  const actual=Number(p.actual)||0,total=Number(p.total)||1;
  return {actual:actual,total:total,texto:total<=1?(actual>=1?'Hecho':'0/1'):`${actual}/${total}`};
}
function logrosDesbloqueados(){
  const c=logrosCfg();return Array.isArray(c.desbloqueados)?c.desbloqueados:[];
}
const logrosTiene=l=>logrosDesbloqueados().indexOf(l.accesorio)>=0;
function logrosRevisar(silencioso){
  const c=logrosCfg(),antes=logrosDesbloqueados().slice();
  LOGROS.forEach(l=>{
    if(l.pronto||typeof l.condicion!=='function')return;
    let ok=false;try{ok=!!l.condicion()}catch(e){ok=false}
    if(ok&&c.desbloqueados.indexOf(l.accesorio)<0)c.desbloqueados.push(l.accesorio);
  });
  if(c.desbloqueados.length!==antes.length){
    save();
    const nuevo=c.desbloqueados.find(id=>antes.indexOf(id)<0);
    if(nuevo&&silencioso!==true)logrosMostrarAviso(logroPorAccesorio(nuevo));
  }
}
function logrosCerrarAviso(){
  const r=document.getElementById('logro-root');if(r)r.innerHTML='';
  clearTimeout(logrosCerrarAviso.h);
}
function logrosMostrarAviso(l){
  if(!l||typeof document==='undefined')return;
  const item=ARVIS_ITEMS[l.accesorio];if(!item)return;
  const r=document.getElementById('logro-root');if(!r)return;
  const nombre=item.nombre.charAt(0).toLowerCase()+item.nombre.slice(1);
  r.innerHTML=`<div class="logro-aviso" role="status" aria-live="polite">
    ${arvisFigura('celebrando',72)}
    <div class="logro-aviso-copy"><b>¡Logro: ${esc(l.nombre)}! Desbloqueaste ${esc(item.articulo)} ${esc(nombre)}</b>
      <p class="mute">${esc(l.descripcion)}</p>
      <div class="row"><button class="btn" type="button" onclick="logrosEquipar('${esc(l.id)}',true);logrosCerrarAviso()">Ponérselo</button>
      <button class="btn sec" type="button" onclick="logrosCerrarAviso()">Cerrar</button></div>
    </div></div>`;
  clearTimeout(logrosCerrarAviso.h);
  logrosCerrarAviso.h=setTimeout(logrosCerrarAviso,16000);
}
function logrosEquipar(id,force){
  const c=logrosCfg(),l=logroPorId(id)||logroPorAccesorio(id);
  if(!l)return;
  const item=ARVIS_ITEMS[l.accesorio];
  if(!item||c.desbloqueados.indexOf(l.accesorio)<0)return;
  const slot=item.espacio;
  c.equipados[slot]=force||c.equipados[slot]!==l.accesorio?l.accesorio:'';
  c.vistos=c.desbloqueados.slice();
  save();
  if(typeof render==='function')render();
}
function logrosMarcarVistos(){
  const c=logrosCfg(),vistos=c.desbloqueados.slice();
  if(vistos.join('|')!==(c.vistos||[]).join('|')){
    c.vistos=vistos;save();
  }
}
const LOGROS_ESPACIOS=[['cabeza','Cabeza'],['cara','Cara'],['espalda','Espalda'],['mano','Mano']];
function viewArvis(){
  logrosMarcarVistos();
  const c=logrosCfg(),desbloqueados=logrosDesbloqueados();
  const grupos=LOGROS_ESPACIOS.map(([slot,label])=>{
    const items=Object.keys(ARVIS_ITEMS).filter(id=>ARVIS_ITEMS[id].espacio===slot);
    const cards=items.map(id=>{
      const l=logroPorAccesorio(id),item=ARVIS_ITEMS[id],on=desbloqueados.indexOf(id)>=0,eq=c.equipados[slot]===id,p=logrosProgreso(l);
      const texto=on?`<span class="logro-estado">${eq?'Equipado':'Desbloqueado'}</span>`:
        l.pronto?'<span class="logro-estado">Próximamente</span>':`<span class="logro-estado">${esc(l.como)}: ${esc(p.texto)}</span>`;
      const barra=!on&&!l.pronto&&p.total>1?`<div class="logro-bar" role="presentation"><span style="width:${Math.round(100*p.actual/p.total)}%"></span></div>`:'';
      return `<button class="logro-item ${on?'on':''} ${eq?'eq':''}" type="button" aria-pressed="${eq?'true':'false'}" ${on?`onclick="logrosEquipar('${esc(l.id)}')"`:'disabled'}
        data-focus-id="item-${esc(id)}">
        <span class="logro-item-img">${arvisFigura('normal',64,'',{[item.espacio]:id})}</span>
        <span class="logro-item-copy"><b>${esc(item.nombre)}</b>${texto}${barra}</span>
      </button>`;
    }).join('');
    return `<section class="logro-grupo"><h3>${label}</h3><div class="logro-items">${cards}</div></section>`;
  }).join('');
  const lista=LOGROS.map(l=>{
    const on=desbloqueados.indexOf(l.accesorio)>=0,p=logrosProgreso(l),item=ARVIS_ITEMS[l.accesorio];
    const barra=!on&&!l.pronto&&p.total>1?`<div class="logro-bar" role="presentation"><span style="width:${Math.round(100*p.actual/p.total)}%"></span></div>`:'';
    return `<li class="logro-fila ${on?'on':''}">
      <span class="logro-marcador" aria-hidden="true">${on?'✓':l.pronto?'…':'○'}</span>
      <span><b>${esc(l.nombre)}</b> <span class="mute">· ${esc(item.nombre)}</span>
        <span class="mute">${esc(l.descripcion)}</span>
        <span class="mute">${l.pronto?'Próximamente':`${esc(l.como)}: ${esc(p.texto)}`}</span>${barra}</span>
    </li>`;
  }).join('');
  return `<div class="card arvis-personalizar">
    <h2>Personalizar a Arvis</h2>
    <div class="arvis-preview">${arvisFigura(arvisEstadoDelDia(),200)}<div><h3 style="margin-bottom:4px">Arvis</h3>
      <p class="mute" style="margin:0">Los accesorios se ganan con hábitos sostenibles. Ningún logro premia estudiar de noche ni superar tu límite diario.</p></div></div>
  </div>
  <div class="card"><h3>Accesorios por espacio</h3><p class="mute">Toca uno para ponérselo; tócalo de nuevo para quitarlo. Solo se puede llevar uno por espacio.</p>${grupos}</div>
  <div class="card"><h3>Logros</h3><ol class="logro-lista">${lista}</ol>
    <p class="mute" style="margin-bottom:0">Los días de descanso no rompen las rachas: cuentan las semanas con al menos una sesión, no la cantidad de horas.</p></div>`;
}
