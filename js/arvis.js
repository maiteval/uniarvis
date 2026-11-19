const ARVIS_MENSAJES={
  energia:[
    '¡Batería llena! Buen día para avanzar en lo difícil.',
    'Vienes con energía: podemos partir por lo más importante.',
    'Todo el pecho encendido. Hoy puedes dar un buen paso.'
  ],
  normal:[
    'Aquí estoy. ¿Por dónde partimos?',
    'Vamos a lo que se pueda, sin apuro.',
    'Un pasito a la vez también es avanzar.'
  ],
  sinCheckin:[
    'Aún no sé cómo vienes. Haz el check-in y ajusto el día contigo.',
    'Si haces el check-in, puedo acompañarte mejor hoy.',
    'Un check-in cortito y seguimos a tu ritmo.'
  ],
  celebrando:[
    '¡Listo! Eso ya está hecho.',
    'Buen trabajo. A disfrutar el descanso.',
    'Sumó. Gracias por darle una vuelta.'
  ],
  estudiando:[
    'Estoy contigo en este foco.',
    'Modo estudio: solo una cosa a la vez.',
    'Aquí acompañando, sin apuro.'
  ],
  preocupado:[
    'Vi una evaluación cerca y aún no hay plan para ese ramo.',
    'Hay una fecha pronta: mejor le ponemos un plan liviano.'
  ],
  cansado:[
    'Queda poca energía. Hagamos solo lo mínimo de hoy.',
    'Bajemos el volumen: lo esencial basta.',
    'No hace falta más. Podemos parar cuando quieras.'
  ],
  descansando:[
    'Hoy toca recargar. Descansar también es avanzar.',
    'Batería en cero: vale la pena parar un rato.',
    'Hoy no se exige nada. Primero, respirar.'
  ]
};
let arvisMomento=null;
const arvisOn=()=>!(typeof S!=='undefined'&&S&&S.settings&&S.settings.arvis===false);
const arvisPick=arr=>arr[Math.floor(Math.random()*arr.length)];
function arvisCheckinHoy(){
  const d=today();
  if(typeof diaryOn==='function'){
    const e=diaryOn(d);
    if(e&&e.energy!=null)return e;
  }
  const diary=S&&S.wellbeing&&S.wellbeing.diary;
  return diary?diary.find(e=>e.date===d&&e.energy!=null)||null:null;
}
function arvisEstadoDelDia(){
  const e=arvisCheckinHoy();
  if(!e)return 'normal';
  const n=Number(e.energy);
  if(n>=4)return 'energia';
  if(n===3)return 'normal';
  if(n===2)return 'cansado';
  return 'descansando';
}
function arvis(estado,mensaje,opciones){
  if(!arvisOn())return '';
  const o=opciones||{},key=ARVIS_MENSAJES[estado]?estado:'normal';
  const txt=mensaje||o.mensaje||arvisPick(ARVIS_MENSAJES[key]);
  const action=o.action?`<div class="arvis-action">${o.action}</div>`:'';
  return `<div class="arvis-card${o.mediano?' arvis-md':o.pequeno?' arvis-sm':''}${o.clase?' '+esc(o.clase):''}"${o.id?` id="${esc(o.id)}"`:''}>
    <img src="icons/arvis/arvis-${key}.svg" alt="">
    <div class="arvis-bubble"><p>${esc(txt)}</p>${action}</div>
  </div>`;
}
function arvisInicioHtml(){
  if(!arvisOn())return '';
  if(!arvisCheckinHoy())return arvis('normal',arvisPick(ARVIS_MENSAJES.sinCheckin),{action:'<button class="lnk" type="button" onclick="go(\'bienestar\')">Hacer check-in</button>',id:'arvis-inicio'});
  return arvis(arvisEstadoDelDia(),null,{id:'arvis-inicio'});
}
function arvisCelebrar(mensaje,scope){
  if(arvisOn())arvisMomento={ts:Date.now(),mensaje:mensaje||'',scope:scope||''};
}
function arvisMomentoHtml(scope){
  if(!arvisMomento||!arvisOn())return '';
  if(scope){if(arvisMomento.scope&&arvisMomento.scope!==scope)return ''}
  else if(arvisMomento.scope)return '';
  const m=arvisMomento,reciente=Date.now()-m.ts<12000;
  arvisMomento=null;
  return reciente?arvis('celebrando',m.mensaje||null,{mediano:scope==='pomodoro',id:'arvis-celebrando'}):'';
}
function arvisEstudiandoHtml(){
  if(!arvisOn()||arvisMomento)return '';
  const p=S&&S.tools&&S.tools.pomodoro;
  if(!p||!p.running||p.phase!=='focus')return '';
  return arvis('estudiando',null,{mediano:true,id:'arvis-estudiando'});
}
function arvisAlertaHtml(){
  if(!arvisOn())return '';
  const t0=today(),proxima=(S.events||[]).filter(e=>
    (e.type==='evaluacion'||e.type==='control'||/certamen|prueba/i.test(e.title||''))&&
    diffDays(t0,e.date)>=0&&diffDays(t0,e.date)<3
  ).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!proxima)return '';
  const planeado=(S.tasks||[]).some(t=>t.courseId===proxima.courseId&&!t.done&&t.date>=t0&&t.date<=proxima.date);
  if(planeado)return '';
  return arvis('preocupado',null,{action:'<button class="btn sec" type="button" onclick="go(\'semana\')">Planificar</button>',id:'arvis-alerta'});
}
function arvisVacioHtml(kind){
  if(!arvisOn())return '';
  const msgs={
    ramos:'Aún no hay ramos. Escribe el nombre de uno y toca Agregar para empezar.',
    tareas:'No hay micro-tareas. Agrega ramos y fechas para que aparezca un plan liviano.',
    amigos:'Todavía no hay amigos. Comparte tu código o invita a alguien con el suyo.'
  };
  if(!msgs[kind])return '';
  return arvis('normal',msgs[kind],{pequeno:true,id:'arvis-vacio-'+kind});
}
function arvisAvatarHtml(){
  return arvisOn()?'<img class="arvis-avatar" src="icons/arvis/arvis-normal.svg" alt="">':'';
}
