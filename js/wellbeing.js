/* U.A.R.V.I.S. · Check-in, alertas tempranas, pausas, respiración, meditación y patrones */
/* ===================== Check-in diario ===================== */
const ENERGY=[['▁','Muy baja'],['▃','Baja'],['▅','Media'],['▆','Buena'],['█','Alta']];
const MOODS=[['😞','Muy mal'],['🙁','Mal'],['😐','Normal'],['🙂','Bien'],['😄','Muy bien']];
const SLEEP=[['😴','< 5 h'],['🥱','5–6 h'],['🙂','6–7 h'],['😌','7–8 h'],['🌙','8+ h']];
const FEEL_TAGS=['Estrés','Cansancio','Ansiedad','Motivación','Concentración','Tranquilidad','Gratitud'];
const diaryOn=d=>S.wellbeing.diary.find(e=>e.date===d)||null;
const consentOn=()=>!!(S.consent&&S.consent.health);
const ci=d=>{if(!consentOn())return null;const e=diaryOn(d);return e&&e.energy!=null?e:null};   // check-in completo; sin consentimiento no se usa
function loadDraft(){const e=ci(today());draft=e?{energy:e.energy,mood:e.mood,sleep:e.sleep,tags:[...(e.tags||[])],note:e.note||''}:{energy:null,mood:null,sleep:null,tags:[],note:''}}
function setCi(k,v){draft[k]=v;render()}
function toggleTag(t){const i=draft.tags.indexOf(t);i<0?draft.tags.push(t):draft.tags.splice(i,1);render()}
function editCi(){loadDraft();ciEdit=true;render()}
async function setConsent(v){
  S.consent={health:v,at:today()};
  if(!v){
    if(S.wellbeing.diary.length&&await askConfirm({title:'Revocar consentimiento',text:'¿Quieres borrar también los check-ins y el diario que ya guardaste?\n\nAceptar = borrarlos. Cancelar = conservarlos, pero la app no los usará.',okLabel:'Borrar también',danger:true}))S.wellbeing.diary=[];
    S.adapt=null;S.soft=null;
  }
  save();loadDraft();replanAll();render();
}
function resetConsent(){S.consent=null;save();loadDraft();replanAll();render()}
function saveCheckin(){
  if(!S.consent||!S.consent.health)return toast('Para guardar el check-in necesito tu consentimiento.');
  if(!draft.energy||!draft.mood||!draft.sleep)return toast('Marca energía, ánimo y sueño (son 3 toques).');
  const t0=today(),before=S.tasks.filter(t=>t.date===t0&&!t.done).length;
  S.wellbeing.diary=S.wellbeing.diary.filter(e=>e.date!==t0);
  S.wellbeing.diary.push({date:t0,energy:draft.energy,mood:draft.mood,sleep:draft.sleep,tags:[...draft.tags],note:draft.note.trim(),ts:Date.now()});
  save();replanAll();
  const after=S.tasks.filter(t=>t.date===t0&&!t.done).length,moved=Math.max(0,before-after),low=lowMode(t0);
  S.adapt={date:t0,n:moved,low};save();ciEdit=false;
  toast(low?`Hoy vamos livianos: dejé solo lo esencial y moví ${moved} sesión(es) a otros días.`:`Check-in guardado. Capacidad de hoy: ${capFor(t0)} min.`);
  render();
}
function delDiary(date){undoable('Registro eliminado.',()=>{S.wellbeing.diary=S.wellbeing.diary.filter(e=>e.date!==date)},()=>replanAll())}
function dismissW(k){S.dismissed[k]=today();save();render()}

/* ===================== Alertas tempranas (siempre en tono amable) ===================== */
function runLen(pred){
  let d=ci(today())?today():addDays(today(),-1),n=0;
  while(n<60){const e=ci(d);if(!e||!pred(e))break;n++;d=addDays(d,-1)}
  return n;
}
function studiedRun(){let d=doneOn(today())>0?today():addDays(today(),-1),n=0;while(doneOn(d)>0&&n<60){n++;d=addDays(d,-1)}return n}
function overworkRun(){let d=today();if(!(doneOn(d)>=0.85*capFor(d)))d=addDays(d,-1);let n=0;while(doneOn(d)>=0.85*capFor(d)&&n<30){n++;d=addDays(d,-1)}return n}
function earlyWarnings(){
  const w=[];
  if(S.consent&&S.consent.health){
    if(runLen(e=>e.mood<=2)>=3)w.push({key:'mood',title:'Notamos varios días seguidos con el ánimo bajo',text:'No tienes que cargar con esto solo/a. Hablarlo con alguien de confianza o con el apoyo de tu universidad puede ayudar. Esta app no reemplaza a un profesional.'});
    else if(runLen(e=>e.sleep!=null&&e.sleep<=2&&e.mood<=3)>=3)w.push({key:'sleep',title:'Varios días con poco sueño y ánimo justo',text:'El descanso sostiene todo lo demás. Quizá sirva bajar el ritmo unos días y cuidar tus horas de sueño.'});
    else if(runLen(e=>e.energy<=2)>=4)w.push({key:'energy',title:'Tu energía lleva varios días baja',text:'Puede ser cansancio acumulado. Vale la pena darte espacio y, si sigue, conversarlo con alguien.'});
  }
  if(studiedRun()>=7)w.push({key:'rest',title:'Llevas 7 días seguidos estudiando',text:'El descanso también es parte del plan. Considera un día completamente libre esta semana.'});
  else if(overworkRun()>=3)w.push({key:'over',title:'Varios días seguidos en el tope de tu capacidad',text:'Estás rindiendo mucho. Conviene dejar aire para no llegar agotado/a a lo importante.'});
  return w.slice(0,2);
}
function warnHtml(){
  return earlyWarnings().filter(x=>S.dismissed[x.key]!==today()).map(x=>`<div class="banner soft"><b>${x.title}</b><br>${x.text}
    <div class="row" style="margin-top:8px"><button class="btn" onclick="go('apoyo')">Ver opciones de apoyo</button>
    ${softOn(today())?'':'<button class="btn sec" onclick="applySoft()">Bajar mi carga 3 días</button>'}
    <button class="btn sec" onclick="dismissW('${x.key}')">Ahora no</button></div></div>`).join('');
}

/* ===================== Pausas ligadas al calendario ===================== */
function pauseItems(){
  const t0=today(),tm=addDays(t0,1),ye=addDays(t0,-1),out=[];
  S.events.filter(e=>e.type!=='otro').forEach(e=>{
    const nm=`${e.title} (${cname(e.courseId)})`;
    if(e.date===t0)out.push({t:`Hoy: ${nm}`,x:'Antes: 2 min de respiración en caja para bajar los nervios y enfocarte. Después: exhalación larga y un descanso real, sin estudiar.',tech:'caja',l:'Respiración en caja'});
    else if(e.date===tm)out.push({t:`Mañana: ${nm}`,x:'Esta noche puedes probar el suspiro cíclico; 4-7-8 es opcional y tiene menos evidencia formal. Dormir bien rinde más que una hora extra de repaso.',tech:'suspiro',l:'Suspiro cíclico'});
    else if(e.date===ye)out.push({t:`Ayer: ${nm}`,x:'Date un respiro tras la exigencia: un escaneo corporal de 5 minutos o una caminata corta.',med:'cuerpo',l:'Escaneo corporal'});
  });
  const pend=S.tasks.filter(x=>x.date===t0&&!x.done).reduce((a,x)=>a+x.minutes,0);
  if(pend>=90)out.push({t:`Bloque largo hoy (${pend} min)`,x:'Antes de empezar, 1–2 min de respiración en caja. Y una pausa corta cada 25–30 min.',tech:'caja',l:'Respiración en caja'});
  return out;
}
function pauseCard(){
  const p=pauseItems();if(!p.length)return '';
  return `<div class="card"><h3>Pausas para hoy</h3>${p.map(x=>`<div class="pause"><span style="flex:1"><b>${esc(x.t)}</b><br>${x.x}</span>
    <button class="btn sec" onclick="${x.tech?`goBreath('${x.tech}')`:`goMed('${x.med}')`}">${x.l}</button></div>`).join('')}</div>`;
}

/* ===================== Respiración y meditación ===================== */
const TECH={
  suspiro:{name:EVIDENCE.breathing.suspiro.name,desc:EVIDENCE.breathing.suspiro.desc,ph:EVIDENCE.breathing.suspiro.ph},
  larga:{name:'Exhalación larga (4-6)',desc:'Exhalar más largo que inhalar ayuda a bajar la activación. Buena para los nervios antes o después de una prueba.',ph:[['Inhala por la nariz',4,1.6],['Exhala lento por la boca',6,1]]},
  caja:{name:'Respiración en caja (4-4-4-4)',desc:'Cuatro tiempos iguales. Ayuda a enfocarte antes de empezar a estudiar o de rendir.',ph:[['Inhala',4,1.6],['Sostén',4,1.6],['Exhala',4,1],['Sostén vacío',4,1]]},
  s478:{name:'4-7-8',desc:EVIDENCE.breathing.s478Caveat,ph:[['Inhala',4,1.6],['Sostén',7,1.6],['Exhala suave',8,1]]}
};
function setBCount(){
  document.querySelectorAll('#bcount,[data-bcount]').forEach(el=>{if(bt)el.textContent=bt.left+' s'});
  document.querySelectorAll('#bcycles,[data-bcycles]').forEach(el=>{if(bt)el.textContent='Ciclos: '+bt.cycles});
}
function setPhase(){
  if(!bt)return;
  const [lab,sec,sc]=TECH[bsel].ph[bt.i];
  const reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('#bcircle,[data-bcircle]').forEach(c=>{
    void c.offsetWidth;c.style.transition=reduce?'none':`transform ${sec}s ease-in-out`;c.style.transform=`scale(${sc})`;
  });
  document.querySelectorAll('#blabel,[data-blabel]').forEach(el=>{el.textContent=lab});
  setBCount();
}
function breathFocusOpen(){
  if(typeof focusOpen!=='function'||focusKind()==='breath')return;
  focusOpen({kind:'breath',title:'Respiración · '+TECH[bsel].name,content:breathFocusHtml,onClose:()=>stopBreath()});
  setPhase();
}
function breathFocusHtml(){
  if(!bt)return '';
  return `<div class="focus-breath">
    <div class="bwrap focus-breath-wrap"><div class="focus-breath-circle" data-bcircle></div></div>
    <div class="focus-breath-label" data-blabel>${esc(TECH[bsel].ph[bt.i][0])}</div>
    <div class="bnum"><div data-bcount>${bt.left} s</div><div class="mute" data-bcycles>Ciclos: ${bt.cycles}</div></div>
    <button class="btn focus-breath-stop" data-focus-id="breath-focus-stop" onclick="stopBreath()">Detener</button>
  </div>`;
}
function startBreath(){
  if(bt)return;stopMed(true);
  bt={i:0,left:TECH[bsel].ph[0][1],cycles:0,h:null};
  render();setPhase();breathFocusOpen();
  bt.h=setInterval(()=>{
    const ph=TECH[bsel].ph;bt.left--;
    if(bt.left<=0){bt.i++;if(bt.i>=ph.length){bt.i=0;bt.cycles++}bt.left=ph[bt.i][1];setPhase()}else setBCount();
  },1000);
}
function stopBreath(silent){
  if(!bt)return;
  clearInterval(bt.h);bt=null;
  if(focusKind()==='breath'&&typeof focusClose==='function')focusClose();
  if(!silent)render();
}
function setTech(v){stopBreath(true);bsel=v;render()}
const MEDS=[
  {id:'pausa',name:'Pausa de 1 minuto',min:1,desc:'Para cortar el piloto automático entre bloques de estudio.',steps:['Siéntate con la espalda apoyada y suelta los hombros.','Cierra los ojos o baja la mirada.','Respira normal y cuenta cada exhalación hasta 10, luego vuelve a 1.','Si te distraes, vuelve a contar sin juzgarte.']},
  {id:'resp',name:'Atención en la respiración',min:3,desc:'Entrena la concentración: útil antes de una sesión larga.',steps:['Elige un punto donde notes la respiración: nariz, pecho o abdomen.','Sigue cada inhalación y exhalación sin cambiarla.','Cuando aparezcan pensamientos, nómbralos ("planificando", "preocupación") y vuelve al punto elegido.','Termina moviendo suavemente manos y pies.']},
  {id:'cuerpo',name:'Escaneo corporal',min:5,desc:'Libera tensión acumulada tras horas frente al computador o después de una prueba.',steps:['Acuéstate o siéntate cómodo y cierra los ojos.','Lleva la atención a los pies y nota cómo se sienten, sin cambiar nada.','Sube lentamente: piernas, caderas, abdomen, pecho, manos, brazos, hombros, cuello, cara.','En cada zona tensa, exhala y suelta un poco.','Termina con tres respiraciones profundas.']},
  {id:'tierra',name:'Aterrizaje 5-4-3-2-1',min:2,desc:'Para momentos de nervios o bloqueo: te trae al presente.',steps:['Nombra 5 cosas que ves.','Nombra 4 cosas que puedes tocar.','Nombra 3 sonidos que escuchas.','Nombra 2 olores que percibes (o que te gustan).','Nombra 1 cosa que saboreas, y respira hondo.']}
];
const mfmt=s=>pad(Math.floor(s/60))+':'+pad(s%60);
function beep(){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.frequency.value=528;g.gain.value=.08;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.6)}catch(e){}}
function startMed(id){
  if(mt)return;stopBreath(true);const m=MEDS.find(x=>x.id===id);
  mt={id,name:m.name,left:m.min*60,h:null};render();
  mt.h=setInterval(()=>{
    mt.left--;const e=$('#mtime');if(e)e.textContent=mfmt(mt.left);
    if(mt.left<=0){clearInterval(mt.h);mt=null;beep();toast('Sesión completa.');render()}
  },1000);
}
function stopMed(silent){if(!mt)return;clearInterval(mt.h);mt=null;if(!silent)render()}

/* ===================== Patrones del diario ===================== */
function patterns(){
  const D=S.wellbeing.diary.filter(e=>e.energy!=null&&e.mood!=null);
  if(D.length<7)return{need:true,n:D.length,items:[]};
  const items=[],f1=x=>x.toFixed(1);
  const wl=e=>S.events.filter(x=>x.type!=='otro'&&mondayOf(x.date)===mondayOf(e.date)).length;
  const cmp=(fa,fb,key,fn)=>{const A=D.filter(fa),B=D.filter(fb);if(A.length<3||B.length<3)return;
    const a=avg(A.map(e=>e[key])),b=avg(B.map(e=>e[key]));if(Math.abs(a-b)>=0.5)items.push(fn(a,b,A.length,B.length))};
  cmp(e=>wl(e)>=3,e=>wl(e)<3,'mood',(a,b,na,nb)=>`En semanas con 3 o más evaluaciones/entregas tu ánimo promedió ${f1(a)} de 5 (${na} registros), frente a ${f1(b)} en semanas más livianas (${nb}).`);
  cmp(e=>wl(e)>=3,e=>wl(e)<3,'energy',(a,b,na,nb)=>`Tu energía en semanas cargadas promedió ${f1(a)} de 5, frente a ${f1(b)} en semanas livianas.`);
  cmp(e=>e.sleep!=null&&e.sleep<=2,e=>e.sleep!=null&&e.sleep>=3,'energy',(a,b)=>`Los días con poco sueño tu energía promedió ${f1(a)} de 5, frente a ${f1(b)} cuando dormiste mejor.`);
  cmp(e=>classMinutes(e.date)>=240,e=>classMinutes(e.date)<240,'energy',(a,b)=>`En días con 4 h o más de clases tu energía promedió ${f1(a)} de 5, frente a ${f1(b)} en días con menos clases.`);
  return{need:false,n:D.length,items};
}
