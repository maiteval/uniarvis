/* U.A.R.V.I.S. · Catálogo institucional y flujo simulado (prototipo, sin backend) */
/* Agregar otra universidad = agregar un objeto a INSTITUTIONS y sus datos de ejemplo. */
const accountBlank=()=>({type:null,institutionId:'',email:'',linkedAt:null});
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
function institutionLogo(id,small){
  const i=institutionById(id)||INSTITUTIONS[0];
  return `<svg class="inst-logo${small?' inst-logo-sm':''}" viewBox="0 0 136 44" role="img" aria-label="Logo ${esc(i.short)}, prototipo no oficial">
    <rect x="1" y="1" width="134" height="42" rx="10" fill="#fffdf7" stroke="#0b3d91" stroke-width="2"/>
    <path d="M10 38h116" stroke="#8a5a00" stroke-width="3" stroke-linecap="round"/>
    <text x="14" y="31" font-family="Segoe UI,Arial,sans-serif" font-size="25" font-weight="700" fill="#0b3d91">Ude</text>
    <text x="82" y="31" font-family="Segoe UI,Arial,sans-serif" font-size="25" font-weight="700" fill="#8a5a00">C</text>
  </svg>`;
}
function institutionIdentityHtml(id){
  const i=institutionById(id);if(!i)return '';
  return `<span class="inst-identity">${institutionLogo(i.id,true)}<span><b>U.A.R.V.I.S.</b> · ${esc(i.name)}</span></span>`;
}
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
  return 'mailto:'+encodeURIComponent(i.support.email)+'?subject='+encodeURIComponent('Solicitud de contacto · Uarvis UdeC (prototipo no oficial)')+'&body='+encodeURIComponent(body);
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
function choosePersonal(){
  S.account=accountBlank();S.account.type='personal';
  if(typeof metricsTrack==='function')metricsTrack('modo_elegido','personal');
  if(typeof save==='function')save();
  if(typeof render==='function')render();
}
function linkInstitution(id,email){
  const i=institutionById(id);if(!i)return false;
  S.account={type:'institucional',institutionId:id,email:String(email||'').trim().slice(0,120),linkedAt:today()};
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
  if(typeof save==='function')save();
}

/* Modo demo en memoria, igual que Amigos: nada del flujo institucional se envía ni se persiste hasta el final. */
const InstitutionalFlow=(function(){
  let flow=null;
  const get=()=>flow;
  function start(from){flow={step:'choose',email:'',error:'',from:from||'selection'};return flow}
  function cancel(){flow=null}
  function back(){
    if(!flow)return null;
    if(flow.step==='login')flow.step='choose';
    else if(flow.step==='consent')flow.step='login';
    else flow=null;
    if(flow)flow.error='';
    return flow;
  }
  function next(){
    if(!flow)return;
    if(flow.step==='choose'){flow.step='login';flow.error=''}
  }
  function setEmail(v){if(flow){flow.email=String(v||'').trim().slice(0,120);flow.error=''}}
  function submitEmail(){
    if(!flow)return false;
    const i=INSTITUTIONS[0];
    if(!flow.email||!flow.email.toLowerCase().endsWith('@'+i.emailDomain.toLowerCase())){
      flow.error=`Usa tu correo institucional terminado en @${i.emailDomain}.`;return false;
    }
    flow.error='';
    // TODO: aquí irá el SSO real con Google o Microsoft vía Supabase; la demo solo valida el dominio en memoria.
    if(S.institutionConsentAt){linkInstitution(INSTITUTIONS[0].id,flow.email);flow=null;if(typeof toast==='function')toast('Vinculado con la Universidad de Concepción (prototipo).')}
    else flow.step='consent';
    return true;
  }
  function accept(){
    if(!flow||flow.step!=='consent')return false;
    linkInstitution(INSTITUTIONS[0].id,flow.email);flow=null;return true;
  }
  return {get,start,cancel,back,next,setEmail,submitEmail,accept};
})();
function startInstitutionalFlow(from){InstitutionalFlow.start(from);if(typeof render==='function')render()}
function institutionalBack(){InstitutionalFlow.back();if(typeof render==='function')render()}
function institutionalCancel(){InstitutionalFlow.cancel();if(typeof render==='function')render()}
function institutionalNext(){InstitutionalFlow.next();if(typeof render==='function')render()}
function institutionalEmail(v){InstitutionalFlow.setEmail(v)}
function institutionalSubmitEmail(){InstitutionalFlow.submitEmail();if(typeof render==='function')render()}
function institutionalAccept(){
  const wasLinked=InstitutionalFlow.accept();
  if(wasLinked&&typeof toast==='function')toast('Vinculado con la Universidad de Concepción (prototipo).');
  if(wasLinked&&typeof startInstitutionImport==='function')startInstitutionImport('consent');
  if(typeof render==='function')render();
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
async function disconnectInstitution(){
  const n=importedCount();
  let keep=true;
  if(n&&typeof askConfirm==='function')keep=await askConfirm({title:'Desconectar de tu universidad',text:`Tienes ${n} dato(s) importados desde la UdeC (ramos, horario, fechas y notas de ejemplo). ¿Quieres conservarlos o quitarlos al volver al modo Personal?`,okLabel:'Conservar mis datos',cancelLabel:'Quitar los importados'});
  const wasInstitutional=isInstitutional();
  unlinkInstitution();instImport=null;instImportNotice=keep?'Datos de ejemplo conservados.':'Datos de ejemplo de la UdeC quitados.';
  if(!keep&&wasInstitutional)await removeInstitutionData(true);
  toast(keep?'Volviste al modo Personal. Tus datos siguen aquí.':'Volviste al modo Personal y quité los datos importados.');render();
}
