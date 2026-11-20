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
const ARVIS_ITEMS={
  'gorro-lana':{nombre:'Gorro de lana',articulo:'el',espacio:'cabeza',src:'icons/arvis/items/gorro-lana.svg'},
  birrete:{nombre:'Birrete',articulo:'el',espacio:'cabeza',src:'icons/arvis/items/birrete.svg'},
  'gorro-dormir':{nombre:'Gorro de dormir',articulo:'el',espacio:'cabeza',src:'icons/arvis/items/gorro-dormir.svg'},
  'corona-flores':{nombre:'Corona de flores',articulo:'la',espacio:'cabeza',src:'icons/arvis/items/corona-flores.svg'},
  'lentes-sol':{nombre:'Lentes de sol',articulo:'los',espacio:'cara',src:'icons/arvis/items/lentes-sol.svg'},
  'lentes-redondos':{nombre:'Lentes redondos',articulo:'los',espacio:'cara',src:'icons/arvis/items/lentes-redondos.svg'},
  capa:{nombre:'Capa',articulo:'la',espacio:'espalda',src:'icons/arvis/items/capa.svg'},
  mochila:{nombre:'Mochila',articulo:'la',espacio:'espalda',src:'icons/arvis/items/mochila.svg'},
  audifonos:{nombre:'Audífonos',articulo:'los',espacio:'mano',src:'icons/arvis/items/audifonos.svg'},
  'taza-cafe':{nombre:'Taza de café',articulo:'la',espacio:'mano',src:'icons/arvis/items/taza-cafe.svg'},
  'lapiz-gigante':{nombre:'Lápiz gigante',articulo:'el',espacio:'mano',src:'icons/arvis/items/lapiz-gigante.svg'}
};
let arvisMomento=null;
const arvisConfig=()=>{
  const a=S&&S.settings&&S.settings.arvis;
  return a&&typeof a==='object'&&!Array.isArray(a)?a:cleanArvisConfig(a);
};
const arvisOn=()=>arvisConfig().enabled!==false;
const arvisPick=arr=>arr[Math.floor(Math.random()*arr.length)];
function arvisFigura(estado,tamano,baseClass){
  const size=Number(tamano)>0?Number(tamano):96;
  const key=ARVIS_MENSAJES[estado]?estado:'normal';
  const eq=arvisConfig().equipados||{};
  const layer=slot=>{
    const id=eq[slot],item=id&&ARVIS_ITEMS[id];
    return item&&item.espacio===slot&&id!=='capa'&&id!=='mochila'?`<img class="arvis-item" src="${item.src}" alt="">`:'';
  };
  const back=eq.espalda&&ARVIS_ITEMS[eq.espalda]?`<img class="arvis-item arvis-back" src="${ARVIS_ITEMS[eq.espalda].src}" alt="">`:'';
  const cara=key==='estudiando'?'':layer('cara');
  const mano=key==='estudiando'||key==='celebrando'?'':layer('mano');
  const bc=baseClass?' '+baseClass:'';
  return `<span class="arvis-figura" style="--arvis-size:${size}px">
    <img class="arvis-base${bc}" src="icons/arvis/arvis-${key}.svg" alt="">
    ${back}${layer('cabeza')}${cara}${mano}
  </span>`;
}
const ARVIS_ESTADOS_LABEL={energia:'Con energía',normal:'Aquí',cansado:'Cansado',descansando:'Descansando'};
function arvisHeaderHtml(){
  if(!arvisOn())return '';
  const cfg=arvisConfig(),nuevo=(cfg.desbloqueados||[]).some(id=>(cfg.vistos||[]).indexOf(id)<0);
  const estado=arvisEstadoDelDia(),label=ARVIS_ESTADOS_LABEL[estado]||'Arvis';
  return `<button class="arvis-header-btn" type="button" aria-label="Personalizar a Arvis" title="Estado de hoy: ${esc(label)}" onclick="go('arvis')" data-focus-id="arvis-header">
    ${arvisFigura(estado,34)}<span class="arvis-header-label">${esc(label)}</span>${nuevo?'<span class="arvis-nuevo" aria-hidden="true"></span>':''}
  </button>`;
}
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
    ${arvisFigura(key,o.mediano?120:o.pequeno?56:96)}
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
  return arvisOn()?arvisFigura('normal',56,'arvis-avatar'):'';
}
