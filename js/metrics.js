/* U.A.R.V.I.S. · Métricas de uso anónimas y comentarios (ambos opcionales) */
/* Este archivo nunca guarda ni envía bienestar, notas personales ni calificaciones. */
const METRICS_KEY='entrenador-academico-metrics-v1';
const APP_VERSION='1.0.0';
const METRICS_EVENTS=['app_abierta','seccion_vista','pomodoro_completado','flashcards_repasadas',
  'certamen_activado','ics_importado','syllabus_importado','notas_calculadas','amigo_agregado','modo_elegido'];
const FEEDBACK_TYPES=['idea','problema','otro'];
let METRICS=metricsLoad(),metricsTimer=null,metricsSending=false;

function metricsLoad(){
  let raw=null;try{raw=JSON.parse(localStorage.getItem(METRICS_KEY)||'null')}catch(e){}
  const on=!!(raw&&raw.enabled===true);
  return {enabled:on,
    anonId:on&&typeof raw.anonId==='string'&&raw.anonId?raw.anonId.slice(0,80):null,
    queue:on&&Array.isArray(raw.queue)?raw.queue.slice(-200):[],
    lastSentDay:on&&/^\d{4}-\d{2}-\d{2}$/.test(raw.lastSentDay||'')?raw.lastSentDay:null};
}
function metricsPersist(){
  try{
    if(METRICS.enabled)localStorage.setItem(METRICS_KEY,JSON.stringify(METRICS));
    else localStorage.removeItem(METRICS_KEY);
  }catch(e){}
}
function metricsState(){
  return {enabled:METRICS.enabled,anonId:METRICS.anonId,queue:METRICS.queue.slice(),lastSentDay:METRICS.lastSentDay};
}
function metricsNewId(){
  try{if(typeof crypto!=='undefined'&&crypto&&typeof crypto.randomUUID==='function')return crypto.randomUUID()}catch(e){}
  const b=new Uint8Array(16);
  try{crypto.getRandomValues(b)}catch(e){for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256)}
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
function metricsSetEnabled(on){
  const wants=!!on;
  if(wants&&!METRICS.enabled&&!METRICS.anonId)METRICS.anonId=metricsNewId();
  METRICS.enabled=wants;
  if(!wants){METRICS.anonId=null;METRICS.queue=[];METRICS.lastSentDay=null}
  if(metricsTimer){clearTimeout(metricsTimer);metricsTimer=null}
  metricsPersist();
  return METRICS.enabled;
}
function setMetrics(on){
  const wants=!!on;
  if(wants===METRICS.enabled)return;
  metricsSetEnabled(wants);
  toast(wants?'Estadísticas anónimas activadas. Solo se envían los eventos explicados arriba.':'Estadísticas desactivadas: borré el ID anónimo y la cola pendiente.');
  if(typeof render==='function')render();
}
function metricsConfigured(){
  try{
    return typeof socialRealConfigured==='function'&&socialRealConfigured()
      &&typeof SUPABASE_URL==='string'&&!!SUPABASE_URL.trim()
      &&typeof SUPABASE_ANON_KEY==='string'&&!!SUPABASE_ANON_KEY.trim();
  }catch(e){return false}
}
function metricsBase(){return SUPABASE_URL.replace(/\/+$/,'')}
function metricsHeaders(){
  return {'apikey':SUPABASE_ANON_KEY,'Content-Type':'application/json','Prefer':'return=minimal'};
}
function metricsContext(){
  const p=(typeof S!=='undefined'&&S&&S.profile)||{},out={};
  const u=String(p.university||'').trim().slice(0,80);
  if(u&&u!==UNIVERSITY_PREFERS_NOT)out.university=u;
  const c=String(p.career||'').trim().slice(0,80);
  if(c)out.career=c;
  return out;
}
function metricsTrack(evento,seccion){
  if(!METRICS.enabled||!METRICS.anonId)return false;
  if(METRICS_EVENTS.indexOf(evento)<0)return false;              // lista blanca: cualquier otro evento se descarta
  const row={anon_id:METRICS.anonId,evento:String(evento),dia:today(),app_version:APP_VERSION};
  if(evento==='seccion_vista'||evento==='modo_elegido'){
    const s=seccion==null?'':String(seccion).trim().slice(0,80);
    if(s)row.seccion=s;
  }
  Object.assign(row,metricsContext());
  METRICS.queue.push(row);
  if(METRICS.queue.length>200)METRICS.queue=METRICS.queue.slice(-200);
  metricsPersist();metricsSchedule();
  return true;
}
function metricsSchedule(){
  if(metricsTimer)clearTimeout(metricsTimer);
  metricsTimer=setTimeout(()=>{metricsTimer=null;metricsFlush()},50);   // agrupa los eventos del mismo momento en un lote
}
async function metricsFlush(){
  if(metricsSending||!METRICS.enabled||!METRICS.anonId||!METRICS.queue.length)return false;
  if(!metricsConfigured())return false;                          // sin Supabase: no se hace nada y no se avisa
  const d=today();
  if(METRICS.lastSentDay===d)return false;                       // como máximo un lote por día
  metricsSending=true;
  METRICS.lastSentDay=d;metricsPersist();
  const rows=METRICS.queue.slice();
  try{
    const r=await fetch(metricsBase()+'/rest/v1/usage_events',
      {method:'POST',headers:metricsHeaders(),body:JSON.stringify(rows)});
    if(!r.ok)return false;
    METRICS.queue=METRICS.queue.filter(x=>rows.indexOf(x)<0);
    metricsPersist();
    return true;
  }catch(e){return false}                                        // sin red: la cola espera a otro día, sin errores
  finally{metricsSending=false}
}
function feedbackContextRow(mensaje,tipo){
  const row={dia:today(),tipo:FEEDBACK_TYPES.indexOf(tipo)>=0?tipo:'otro',
    mensaje:String(mensaje).trim().slice(0,1000),app_version:APP_VERSION};
  return Object.assign(row,metricsContext());
}
async function feedbackSend(){
  const el=$('#fb-text'),mensaje=String((el&&el.value)||'').trim();
  if(!mensaje)return toast('Escribe tu comentario antes de enviarlo.');
  if(mensaje.length>1000)return toast('El comentario puede tener hasta 1000 caracteres.');
  if(!metricsConfigured())return toast('Sin Supabase configurado: usa «Copiar comentario» para compartirlo por otro medio.');
  const sel=$('#fb-type'),row=feedbackContextRow(mensaje,(sel&&sel.value)||'otro');
  try{
    const r=await fetch(metricsBase()+'/rest/v1/feedback',
      {method:'POST',headers:metricsHeaders(),body:JSON.stringify(row)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    el.value='';toast('¡Gracias! Tu comentario fue enviado.');
  }catch(e){toast('No se pudo enviar el comentario. Puedes copiarlo y compartirlo por correo.')}
}
async function feedbackCopy(){
  const el=$('#fb-text'),mensaje=String((el&&el.value)||'').trim();
  if(!mensaje)return toast('Escribe tu comentario antes de copiarlo.');
  try{
    if(typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(mensaje);
    else{el.focus();el.select();document.execCommand('copy')}
    toast('Comentario copiado al portapapeles.');
  }catch(e){toast('No pude copiarlo: selecciona el texto y cópialo manualmente.')}
}
