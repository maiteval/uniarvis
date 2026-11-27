/* U.A.R.V.I.S. · Estado de la app y persistencia local */
/* ===================== Estado y persistencia (solo en este navegador) ===================== */
const KEY='entrenador-academico-v1';
const UNIVERSITY_OTHER='Otra',UNIVERSITY_PREFERS_NOT='Prefiero no decir';
const UNIVERSITIES_CHILE=['Universidad de Concepción','Universidad de Chile','Pontificia Universidad Católica de Chile',
  'Universidad de Santiago de Chile','Universidad Técnica Federico Santa María','Universidad Católica del Norte',
  'Universidad de Valparaíso','Universidad de Antofagasta','Universidad de Atacama','Universidad de La Serena',
  'Universidad de Los Lagos','Universidad de Magallanes','Universidad del Bío-Bío','Universidad de Talca',
  'Universidad Católica de Temuco','Universidad de Playa Ancha','Pontificia Universidad Católica de Valparaíso','Universidad Andrés Bello',
  'Universidad San Sebastián','Universidad del Desarrollo','Universidad Mayor','Universidad Central de Chile'];
const universityOk=v=>UNIVERSITIES_CHILE.indexOf(v)>=0||v===UNIVERSITY_OTHER||v===UNIVERSITY_PREFERS_NOT;
const CHRONOTYPES=[['manana','Mañana'],['tarde','Tarde'],['noche','Noche'],['no_se','No sé']];
const chronotypeOk=v=>CHRONOTYPES.some(x=>x[0]===v);
const chronotypeLabel=v=>CHRONOTYPES.find(x=>x[0]===v)?.[1]||'No sé';
const ARVIS_SLOTS=['cabeza','cara','espalda','mano'];
const ARVIS_ITEMS_BY_SLOT={
  cabeza:['gorro-lana','birrete','gorro-dormir','corona-flores'],
  cara:['lentes-sol','lentes-redondos'],
  espalda:['capa','mochila'],
  mano:['audifonos','taza-cafe','lapiz-gigante']
};
const ARVIS_ITEM_IDS=ARVIS_SLOTS.reduce((a,s)=>a.concat(ARVIS_ITEMS_BY_SLOT[s]),[]);
const ARVIS_ITEM_SLOT=id=>ARVIS_SLOTS.find(s=>ARVIS_ITEMS_BY_SLOT[s].indexOf(id)>=0)||'';
function cleanArvisConfig(v,profileReady){
  const out={enabled:true,equipados:{cabeza:'',cara:'',espalda:'',mano:''},desbloqueados:[],vistos:[],usos:{onboarding:false,notas:false,certamen:false}};
  if(typeof v==='boolean')out.enabled=v;
  else if(v&&typeof v==='object'&&!Array.isArray(v)){
    if(typeof v.enabled==='boolean')out.enabled=v.enabled;
    if(v.equipados&&typeof v.equipados==='object'&&!Array.isArray(v.equipados))ARVIS_SLOTS.forEach(s=>{
      const id=v.equipados[s];if(ARVIS_ITEM_SLOT(id)===s)out.equipados[s]=id;
    });
    ['desbloqueados','vistos'].forEach(k=>{
      if(Array.isArray(v[k]))v[k].forEach(id=>{if(ARVIS_ITEM_IDS.indexOf(id)>=0&&out[k].indexOf(id)<0)out[k].push(id)});
    });
    if(v.usos&&typeof v.usos==='object')Object.keys(out.usos).forEach(k=>{if(v.usos[k]===true)out.usos[k]=true});
  }
  if(profileReady)out.usos.onboarding=true;
  return out;
}
function freshPomodoro(){return {focusMin:25,shortMin:5,longMin:15,longEvery:4,sound:true,phase:'focus',running:false,endsAt:null,leftMs:1500000,pomodoros:0,target:'',completed:0,todayDate:'',todayMinutes:0,kindStreak:'',kindCount:0}}
function freshFlashcards(){return {decks:[],activeDeckId:'',limit:20,correct:0}}
function freshTools(){return {pomodoro:freshPomodoro(),flashcards:freshFlashcards()}}
const toolInt=(v,a,b,d)=>Number.isInteger(v)&&v>=a&&v<=b?v:d;
const RX_TOOL_ID=/^[\w-]{1,40}$/,RX_TOOL_DATE=/^\d{4}-\d{2}-\d{2}$/;
const RX_TOOL_TARGET=/^(?:(course|task):[\w-]{1,40})?$/;
function validTools(t){
  if(!t||typeof t!=='object'||Array.isArray(t))return false;
  const p=t.pomodoro,f=t.flashcards;
  if(!p||typeof p!=='object'||Array.isArray(p))return false;
  if(![p.focusMin,p.shortMin,p.longMin].every(v=>Number.isInteger(v)&&v>=1&&v<=180))return false;
  if(!Number.isInteger(p.longEvery)||p.longEvery<2||p.longEvery>12)return false;
  if(typeof p.sound!=='boolean'||typeof p.running!=='boolean')return false;
  if(['focus','short','long'].indexOf(p.phase)<0)return false;
  if(p.endsAt!==null&&!(Number.isFinite(p.endsAt)&&p.endsAt>0))return false;
  if(!Number.isFinite(p.leftMs)||p.leftMs<0||p.leftMs>180*60000)return false;
  if(!Number.isInteger(p.pomodoros)||p.pomodoros<0||p.pomodoros>=p.longEvery)return false;
  if(typeof p.target!=='string'||!RX_TOOL_TARGET.test(p.target))return false;
  if(p.completed!==undefined&&(!Number.isInteger(p.completed)||p.completed<0||p.completed>1000000))return false;
  if(p.todayDate!==undefined&&p.todayDate!==''&&!RX_TOOL_DATE.test(p.todayDate))return false;
  if(p.todayMinutes!==undefined&&(!Number.isFinite(p.todayMinutes)||p.todayMinutes<0||p.todayMinutes>1440))return false;
  if(p.kindStreak!==undefined&&p.kindStreak!==''&&['simulacro','ejercicios'].indexOf(p.kindStreak)<0)return false;
  if(p.kindCount!==undefined&&(!Number.isInteger(p.kindCount)||p.kindCount<0||p.kindCount>1000000))return false;
  if(!f||typeof f!=='object'||Array.isArray(f))return false;
  if(!Number.isInteger(f.limit)||f.limit<1||f.limit>200)return false;
  if(f.correct!==undefined&&(!Number.isInteger(f.correct)||f.correct<0||f.correct>1000000))return false;
  if(!Array.isArray(f.decks)||f.decks.length>200)return false;
  const seen={};let total=0;
  for(const d of f.decks){
    if(!d||!RX_TOOL_ID.test(d.id)||seen[d.id]||typeof d.name!=='string'||d.name.length>80)return false;
    seen[d.id]=1;
    if(d.courseId!==undefined&&d.courseId!==''&&!RX_TOOL_ID.test(d.courseId))return false;
    if(!Array.isArray(d.cards)||d.cards.length>5000)return false;
    for(const c of d.cards){
      if(!c||!RX_TOOL_ID.test(c.id)||typeof c.front!=='string'||c.front.length>1000||typeof c.back!=='string'||c.back.length>1000)return false;
      if(!Number.isInteger(c.box)||c.box<1||c.box>5||!RX_TOOL_DATE.test(c.due))return false;
    }
    total+=d.cards.length;
  }
  if(total>5000)return false;
  if(f.activeDeckId!==undefined&&f.activeDeckId!==''&&!seen[f.activeDeckId])return false;
  return true;
}
function cleanTools(t){
  const out=freshTools(),p=t&&typeof t.pomodoro==='object'&&t.pomodoro?t.pomodoro:{},f=t&&typeof t.flashcards==='object'&&t.flashcards?t.flashcards:{};
  const P=out.pomodoro;
  P.focusMin=toolInt(p.focusMin,1,180,25);P.shortMin=toolInt(p.shortMin,1,180,5);P.longMin=toolInt(p.longMin,1,180,15);
  P.longEvery=toolInt(p.longEvery,2,12,4);P.sound=typeof p.sound==='boolean'?p.sound:true;
  P.phase=['focus','short','long'].indexOf(p.phase)>=0?p.phase:'focus';
  P.running=!!p.running;P.endsAt=P.running&&Number.isFinite(p.endsAt)?p.endsAt:null;
  P.leftMs=Number.isFinite(p.leftMs)?clamp(p.leftMs,0,180*60000):P.focusMin*60000;
  P.pomodoros=toolInt(p.pomodoros,0,P.longEvery-1,0);
  P.target=typeof p.target==='string'&&RX_TOOL_TARGET.test(p.target)?p.target:'';
  P.completed=toolInt(p.completed,0,1000000,0);
  P.todayDate=RX_TOOL_DATE.test(p.todayDate||'')?p.todayDate:'';
  P.todayMinutes=P.todayDate===today()&&Number.isFinite(p.todayMinutes)?clamp(p.todayMinutes,0,1440):0;
  P.kindStreak=['simulacro','ejercicios'].indexOf(p.kindStreak)>=0?p.kindStreak:'';
  P.kindCount=P.kindStreak?toolInt(p.kindCount,0,1000000,0):0;
  const F=out.flashcards,seen={};let total=0;
  F.limit=toolInt(f.limit,1,200,20);
  F.correct=toolInt(f.correct,0,1000000,0);
  F.decks=(Array.isArray(f.decks)?f.decks:[]).slice(0,200).map(d=>{
    const id=d&&RX_TOOL_ID.test(d.id)&&!seen[d.id]?d.id:uid();seen[id]=1;
    const deck={id:id,name:String((d&&d.name)||'Mazo').slice(0,80),courseId:(d&&RX_TOOL_ID.test(d.courseId||''))?d.courseId:'',cards:[]};
    deck.cards=(Array.isArray(d&&d.cards)?d.cards:[]).slice(0,Math.max(0,5000-total)).map(c=>({
      id:c&&RX_TOOL_ID.test(c.id)?c.id:uid(),front:String((c&&c.front)||'').slice(0,1000),back:String((c&&c.back)||'').slice(0,1000),
      box:toolInt(c&&c.box,1,5,1),due:c&&RX_TOOL_DATE.test(c.due)?c.due:today()
    }));
    total+=deck.cards.length;
    return deck;
  });
  F.activeDeckId=F.decks.some(d=>d.id===f.activeDeckId)?f.activeDeckId:(F.decks[0]?F.decks[0].id:'');
  return out;
}
const migrateTools=t=>cleanTools(t);
const AUTH_B64=/^[A-Za-z0-9+/]+={0,2}$/,AUTH_KEYS=['salt','hash','it','createdAt'];
function validAuth(a){
  if(!a||typeof a!=='object'||Array.isArray(a))return false;
  if(Object.keys(a).some(k=>AUTH_KEYS.indexOf(k)<0))return false;
  return typeof a.salt==='string'&&AUTH_B64.test(a.salt)&&a.salt.length>=20&&a.salt.length<=64&&
    typeof a.hash==='string'&&AUTH_B64.test(a.hash)&&a.hash.length>=40&&a.hash.length<=128&&
    Number.isInteger(a.it)&&a.it>=100000&&a.it<=2000000&&
    (typeof a.createdAt==='string'||typeof a.createdAt==='number')&&!Number.isNaN(new Date(a.createdAt).getTime());
}
function cleanAuth(a){
  if(!a||typeof a!=='object'||Array.isArray(a))return null;
  const out={salt:a.salt,hash:a.hash,it:a.it,createdAt:a.createdAt};
  return validAuth(out)?out:null;
}
/* Temas por evaluación (planificación por temas, modo institucional). Se valida todo y solo se copian campos conocidos. */
function validTopic(t){
  return !!t&&typeof t==='object'&&!Array.isArray(t)&&/^[\w-]{1,40}$/.test(t.id)&&/^[\w-]{1,40}$/.test(t.courseId)&&
    typeof t.name==='string'&&t.name.trim().length>0&&t.name.length<=120&&[0,1,2].indexOf(t.mastery)>=0&&
    (t.unit==null||(Number.isInteger(t.unit)&&t.unit>=1&&t.unit<=99))&&(t.week==null||(Number.isInteger(t.week)&&t.week>=1&&t.week<=60))&&
    (t.lastStudied==null||/^\d{4}-\d{2}-\d{2}$/.test(t.lastStudied))&&
    (t.history===undefined||(Array.isArray(t.history)&&t.history.length<=20&&t.history.every(h=>h&&/^\d{4}-\d{2}-\d{2}$/.test(h.date)&&['bien','medio','costo'].indexOf(h.feeling)>=0&&(h.taskId===undefined||/^[\w-]{1,40}$/.test(h.taskId)))))&&
    (t.source===undefined||t.source==='syllabus'||t.source==='manual');
}
function cleanTopics(list){
  if(!Array.isArray(list))return [];
  const per={};
  return list.filter(validTopic).filter(t=>(per[t.courseId]=(per[t.courseId]||0)+1)<=60).map(t=>({id:t.id,courseId:t.courseId,name:t.name.trim().slice(0,120),
    unit:t.unit??null,week:t.week??null,mastery:t.mastery,lastStudied:t.lastStudied??null,
    history:(t.history||[]).map(h=>({date:h.date,feeling:h.feeling,...(h.taskId?{taskId:h.taskId}:{})})),source:t.source==='manual'?'manual':'syllabus'}));
}
const fresh=()=>({courses:[],classes:[],personal:[],events:[],tasks:[],sessions:[],settings:{min:60,sessionMin:60,maxSessions:2,paceFactor:1,theme:'cian',themeTouched:false,mode:'light',style:'calma',arvis:cleanArvisConfig(null),chronotype:'no_se'},lastPlan:null,
  wellbeing:{diary:[]},createdAt:today(),lastBackup:null,backupSnooze:null,consent:null,soft:null,adapt:null,moved:null,dismissed:{},weeklySummary:{dismissedWeek:null},topics:[],skipDay:null,support:{name:'',contact:''},profile:{name:'',career:'',university:'',nickname:''},certamen:{plans:[],topicsByCourse:{}},tools:freshTools(),
  account:typeof accountBlank==='function'?accountBlank():{type:null,institutionId:'',email:'',linkedAt:null,auth:null,studentId:''},institutionConsentAt:null});
function migrate(s){
  const f=fresh();for(const k in f)if(s[k]===undefined)s[k]=f[k];
  const a=s.account&&typeof s.account==='object'&&!Array.isArray(s.account)?s.account:null;
  const validType=a&&(a.type==='personal'||a.type==='institucional');
  const validInst=validType&&a.type==='institucional'&&typeof institutionById==='function'&&!!institutionById(a.institutionId);
  if(validType&&(a.type==='personal'||validInst))s.account={type:a.type,institutionId:validInst?a.institutionId:'',email:typeof a.email==='string'?a.email.slice(0,120):'',linkedAt:typeof a.linkedAt==='string'?a.linkedAt:null,auth:cleanAuth(a&&a.auth),studentId:typeof a.studentId==='string'?a.studentId.slice(0,40):''};
  else s.account=accountBlank();
  if(s.account.type!=='institucional')s.account.auth=null;
  if(typeof s.institutionConsentAt!=='string')s.institutionConsentAt=null;
  if(!s.weeklySummary||typeof s.weeklySummary!=='object'||Array.isArray(s.weeklySummary))s.weeklySummary={dismissedWeek:null};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.weeklySummary.dismissedWeek||''))s.weeklySummary.dismissedWeek=null;
  s.topics=cleanTopics(s.topics);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.skipDay||''))s.skipDay=null;
  if(Array.isArray(s.events))s.events.forEach(e=>{
    if(!e||typeof e!=='object')return;
    if(e.topicIds!==undefined)e.topicIds=Array.isArray(e.topicIds)?e.topicIds.filter(id=>/^[\w-]{1,40}$/.test(id)).slice(0,60):[];
    if(e.topicsManual!==undefined&&e.topicsManual!==true)delete e.topicsManual;
  });
  if(!s.wellbeing||!Array.isArray(s.wellbeing.diary))s.wellbeing={diary:[]};
  if(!s.settings||typeof s.settings!=='object')s.settings={};
  if(!s.settings.min)s.settings.min=60;
  if(!themeOk(s.settings.theme))s.settings.theme='cian';
  if(typeof s.settings.themeTouched!=='boolean'){
    const autoUdec=s.settings.theme==='udec'&&s.account&&s.account.type==='institucional';
    s.settings.themeTouched=s.settings.theme!=='cian'&&!autoUdec;
  }
  if(!modeOk(s.settings.mode))s.settings.mode='light';
  if(!styleOk(s.settings.style))s.settings.style='hud';
  s.settings.arvis=cleanArvisConfig(s.settings.arvis,!!(s.profile&&s.profile.name));
  if(!chronotypeOk(s.settings.chronotype))s.settings.chronotype='no_se';
  if([45,60,90].indexOf(s.settings.sessionMin)<0)s.settings.sessionMin=60;
  if(!Number.isInteger(s.settings.maxSessions)||s.settings.maxSessions<1||s.settings.maxSessions>4)s.settings.maxSessions=2;
  if(!Number.isFinite(s.settings.paceFactor)||s.settings.paceFactor<0.7||s.settings.paceFactor>1.4)s.settings.paceFactor=1;
  if(Array.isArray(s.tasks))s.tasks.forEach(t=>{
    if(!t||typeof t!=='object')return;
    ['slotStart','slotEnd'].forEach(k=>{if(t[k]!==undefined&&!/^\d{2}:\d{2}$/.test(String(t[k])))delete t[k]});
    ['hint','why'].forEach(k=>{if(t[k]!==undefined)t[k]=String(t[k]).slice(0,k==='hint'?160:240)});
    if(t.feeling!==undefined&&['bien','medio','costo'].indexOf(t.feeling)<0)delete t.feeling;
    if(t.topicIds!==undefined)t.topicIds=Array.isArray(t.topicIds)?t.topicIds.filter(id=>/^[\w-]{1,40}$/.test(id)).slice(0,3):[];
    if(t.topicFb!==undefined&&['bien','medio','costo'].indexOf(t.topicFb)<0)delete t.topicFb;
    if(t.pinned!==undefined&&t.pinned!==true)delete t.pinned;
    if(t.realMinutes!==undefined&&(!Number.isFinite(t.realMinutes)||t.realMinutes<1||t.realMinutes>1440))delete t.realMinutes;
  });
  delete s.settings.max;                          // la capacidad máxima ahora se calcula cada día
  delete s.reviews;                               // reseñas de texto libre de versiones anteriores: ya no se guardan
  delete s.ratings;                               // aportes anónimos de ramos de versiones anteriores: ya no se guardan
  if(s.wellbeing)delete s.wellbeing.practices;
  if(!s.certamen||typeof s.certamen!=='object'||Array.isArray(s.certamen))s.certamen={plans:[],topicsByCourse:{}};
  if(!Array.isArray(s.certamen.plans))s.certamen.plans=[];
  if(!s.certamen.topicsByCourse||typeof s.certamen.topicsByCourse!=='object'||Array.isArray(s.certamen.topicsByCourse))s.certamen.topicsByCourse={};
  if(!s.profile||typeof s.profile!=='object')s.profile={name:'',career:'',university:'',nickname:''};
  if(s.profile.name==null)s.profile.name=''; if(s.profile.career==null)s.profile.career='';
  if(typeof s.profile.university!=='string')s.profile.university='';
  s.profile.university=s.profile.university.trim().slice(0,80);
  if(typeof s.profile.nickname!=='string')s.profile.nickname='';
  s.profile.nickname=s.profile.nickname.trim().slice(0,40);
  if(s.account.type==='institucional'&&typeof institutionById==='function'){
    const inst=institutionById(s.account.institutionId);
    if(inst)s.profile.university=inst.name;                  // en modo institucional la universidad no se elige aquí
  }
  delete s.profile.onboarded;                  // introducción eliminada: se ignora en perfiles y respaldos antiguos
  delete s.intro;
  if(Array.isArray(s.courses))s.courses.forEach(c=>{
    if(!Array.isArray(c.grades))c.grades=[];
    if(typeof c.share!=='boolean')c.share=false;
    if(!Number.isFinite(c.passGrade)||c.passGrade<1||c.passGrade>7)c.passGrade=4;
    if(typeof c.roundFinal!=='boolean')c.roundFinal=true;
    if(typeof c.syllabusNotes!=='string')c.syllabusNotes='';
    else c.syllabusNotes=c.syllabusNotes.slice(0,2000);
  });
  s.tools=migrateTools(s.tools);
  s.personal=typeof cleanPersonal==='function'?cleanPersonal(s.personal):[];
  return s;
}
let S=fresh();                    // se carga en boot() (ver app.js)
function boot(){                  // lee lo guardado; si está cifrado, queda en LOCKED hasta que se ponga la contraseña
  let j=null;try{j=JSON.parse(localStorage.getItem(KEY))}catch(e){}
  if(j&&j.enc)LOCKED=j;
  else if(j&&!Array.isArray(j)&&(j.courses||j.events||j.tasks||j.wellbeing||j.profile))S=migrate(j);
}
let C={};                         // caché de cálculos; se invalida en cada cambio
const inval=()=>{C={}};
let logrosRevisando=false;
function save(){
  inval();persist();
  try{if(typeof socialAfterSave==='function')socialAfterSave()}catch(e){}
  if(typeof logrosRevisar==='function'&&!logrosRevisando){
    logrosRevisando=true;
    try{logrosRevisar()}finally{logrosRevisando=false}
  }
}
function persist(){
  const json=JSON.stringify(S);
  if(KEYOBJ)writeQ=writeQ.then(()=>encryptState(json)).then(s=>{try{localStorage.setItem(KEY,s)}catch(e){}}).catch(()=>{});
  else{try{localStorage.setItem(KEY,json)}catch(e){}}
}
const course=id=>S.courses.find(c=>c.id===id);
const cname=id=>course(id)?course(id).name:'(ramo eliminado)';
const ccolor=id=>course(id)?course(id).color:'#6b7384';

let section='inicio',tab='inicio',weekStart=mondayOf(today()),pending=[],sylText='',sylCourse='',sylAi=null,sylAiLoading=false,draft=null,ciEdit=false,bsel='suspiro',bt=null,mt=null;
let icsPending=null,icsNotice='',icsEvaluations=[];
