const ARVIS_IA_MODE='simulada';
const ArvisIA=(()=>{
  const IA_MONTHS={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
  const IA_WEEKDAYS={lunes:0,martes:1,miercoles:2,jueves:3,viernes:4,sabado:5,domingo:6};
  const IA_TAB_LABEL={hoy:'Hoy',semana:'Semana',horario:'Mi horario',ramos:'Ramos',syllabus:'Fechas',notas:'Notas',herramientas:'Herramientas',checkin:'Check-in',apoyo:'Apoyo',amigos:'Amigos',perfil:'Perfil',tema:'Apariencia',privacidad:'Privacidad',inicio:'Inicio',cuenta:'Cuenta'};
  const IA_HELP_KEYS=[[/check.?in|como me siento|energia/,'checkin'],[/pomodoro|flashcard|tarjeta|herramienta/,'herramientas'],[/syllabus|programa del ramo/,'syllabus'],[/nota|ponderac|promedio/,'notas'],[/mi horario|actividad(es)? personal|gimnasio|\bgym\b/,'horario'],[/horario|ramo|clase/,'ramos'],[/amig|social/,'amigos'],[/semana|calendario/,'semana'],[/\bhoy\b|plan del dia|micro.?tarea/,'hoy'],[/privacidad|datos personales|respaldo/,'privacidad'],[/tema|apariencia|modo oscuro|color/,'tema'],[/perfil/,'perfil'],[/apoyo|ayuda profesional|psicolog/,'apoyo'],[/inicio/,'inicio']];
  const IA_CRISIS=/suicid|matarme|quitarme la vida|no quiero vivir|hacerme dano|autolesion|cortarme|desaparecer para siempre|no vale la pena vivir/;
  const IA_EVAL=/certamen|prueba|examen|evaluacion|control|entrega|informe|laboratorio|proyecto|solemne|parcial/;
  let pendiente=null;
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const tx=s=>norm(String(s||''));
  const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
  const ready=()=>typeof isInstitutional==='function'&&isInstitutional()&&!!S&&!!S.profile&&!!S.profile.name;
  const base=()=>({texto:'',lista:[],acciones:[],propuesta:null,estado:'normal',pregunta:null});
  const goAction=k=>({label:'Ir a '+(IA_TAB_LABEL[k]||k),go:k});
  const helpKey=t=>{const h=IA_HELP_KEYS.find(([rx])=>rx.test(t));return h?h[1]:null};
  const wait=async value=>{
    const n=JSON.stringify(value||'').length;
    const ms=Math.max(300,Math.min(900,300+Math.round(n/9)));
    await new Promise(r=>setTimeout(r,ms));
  };
  const buildDate=(d,mo,y)=>{
    if(!(mo>=1&&mo<=12&&d>=1&&d<=31))return null;
    const t0=today(),cy=+t0.slice(0,4),year=y?(+y<100?2000+(+y):+y):cy;
    const s=`${year}-${pad(mo)}-${pad(d)}`;
    if(fmt(parse(s))!==s)return null;
    return !y&&s<t0?`${year+1}-${pad(mo)}-${pad(d)}`:s;
  };
  const parseDate=t=>{
    t=tx(t);const t0=today();
    if(/\bpasado manana\b/.test(t))return addDays(t0,2);
    if(/\bmanana\b/.test(t))return addDays(t0,1);
    if(/\bhoy\b/.test(t))return t0;
    let m=t.match(/\ben (\d{1,2}) dias?\b/);
    if(m)return addDays(t0,+m[1]);
    m=t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
    if(m)return buildDate(+m[1],+m[2],m[3]);
    m=t.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?\b/);
    if(m)return buildDate(+m[1],IA_MONTHS[m[2]],m[3]);
    m=t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
    if(m){
      const dow=(parse(t0).getDay()+6)%7,target=IA_WEEKDAYS[m[1]];
      let d=(target-dow+7)%7;if(d===0)d=7;
      if(/\b(semana que viene|la otra semana)\b/.test(t))d+=7;
      return addDays(t0,d);
    }
    return null;
  };
  const findCourse=(t,courses)=>{
    t=tx(t);let best=null,score=0;
    (courses||[]).forEach(c=>{
      const nombre=tx(c.nombre||c.name),n=c.nombre||c.name;
      let sc=t.includes(nombre)?100:0;
      const words=nombre.split(/[^a-z0-9]+/).filter(w=>w.length>=4);
      words.forEach(w=>{if(new RegExp('\\b'+w).test(t))sc+=w.length});
      if(!sc)t.split(/[^a-z0-9]+/).filter(w=>w.length>=4).forEach(w=>{if(words.some(x=>x.startsWith(w)))sc+=w.length});
      if(sc>score){score=sc;best={id:c.id,nombre:n,name:n}}
    });
    return best;
  };
  const eventType=t=>{
    t=tx(t);
    if(/\b(certamen|prueba|examen|evaluacion|solemne|parcial)\b/.test(t))return 'evaluacion';
    if(/\bcontrol\b/.test(t))return 'control';
    if(/\b(entrega|tarea|informe|trabajo|proyecto|laboratorio)\b/.test(t))return 'entrega';
    return 'otro';
  };
  const eventTitle=(raw,type)=>{
    const t=tx(raw),m=t.match(/\b(certamen|prueba|examen|control|solemne|parcial|entrega|tarea|informe|laboratorio|proyecto)\s*(\d{1,2})?\b/);
    return m?cap(m[1])+(m[2]?' '+m[2]:''):(TYPE_LABEL[type]||'Evaluación');
  };
  const when=date=>{
    const d=diffDays(today(),date);
    if(d===0)return 'hoy';
    if(d===1)return 'mañana';
    return `${DAYS[(parse(date).getDay()+6)%7].toLowerCase()} ${dshort(date)} (en ${d} días)`;
  };
  const emptyContext=()=>({estudiante:'',institucion:'',cursos:[],fechas:[],tareas:[],dias:[],energia:null,energiaReciente:[],hoy:today()});
  const context=()=>{
    if(!ready())return null;
    const t0=today(),inst=currentInstitution(),on=typeof consentOn==='function'&&consentOn();
    return {
      estudiante:displayName(),
      institucion:inst?inst.short:'',
      cursos:(S.courses||[]).map(c=>{
        const g=typeof gradeSummary==='function'?gradeSummary(c.grades,c):{need:null,pass:c.passGrade||4};
        return {id:c.id,nombre:c.name,requerido:g.need!=null?Math.round(g.need*10)/10:(c.passGrade||4),
          notas:(c.grades||[]).filter(x=>x.score!=null).map(x=>({nombre:x.name,nota:x.score,ponderacion:x.weight}))};
      }),
      fechas:(S.events||[]).filter(e=>e.date>=addDays(t0,-30)).map(e=>({id:e.id,cursoId:e.courseId,titulo:e.title,tipo:e.type,fecha:e.date})),
      tareas:(S.tasks||[]).map(t=>({id:t.id,cursoId:t.courseId,titulo:t.title,fecha:t.date,minutos:t.minutes,hecha:!!t.done,kind:t.kind||'',eventId:t.eventId||''})),
      dias:[...Array(7)].map((_,i)=>{const d=addDays(t0,i);return {fecha:d,carga:typeof dayLoad==='function'?dayLoad(d):0,capacidad:typeof capFor==='function'?capFor(d):180}}),
      energia:on&&typeof ci==='function'&&ci(t0)?ci(t0).energy:null,
      energiaReciente:on?(S.wellbeing.diary||[]).filter(e=>e.date>=addDays(t0,-6)&&e.energy!=null).map(e=>e.energy):[],
      hoy:t0
    };
  };
  const useContext=c=>c?{...emptyContext(),...c}:(context()||emptyContext());
  const courseName=(ctx,id)=>{const c=ctx.cursos.find(x=>x.id===id);return c?c.nombre:'(ramo eliminado)'};
  const future=(ctx,days)=>ctx.fechas.filter(f=>f.fecha>=ctx.hoy&&diffDays(ctx.hoy,f.fecha)<=(days||7)).sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.titulo.localeCompare(b.titulo));
  const isExam=f=>f.tipo==='evaluacion'||f.tipo==='control';
  const nivel=f=>{const c=f&&S.courses&&S.courses.find(x=>x.id===f.cursoId);return c?c.passGrade||4:4};
  const buildSummary=contexto=>{
    const ctx=useContext(contexto),t0=ctx.hoy,fechas=future(ctx,7),tareas=ctx.tareas.filter(t=>!t.hecha&&t.fecha>=t0&&diffDays(t0,t.fecha)<=7);
    const dias=ctx.dias.length?ctx.dias.slice(0,7):[...Array(7)].map((_,i)=>{const d=addDays(t0,i);return {fecha:d,carga:0,capacidad:capFor(d)}});
    const cargadas=dias.filter(d=>d.capacidad&&d.carga>d.capacidad).length;
    const pesado=dias.slice().sort((a,b)=>b.carga-a.carga)[0]||{fecha:t0,carga:0,capacidad:180};
    const porDia={};
    fechas.filter(isExam).forEach(f=>{(porDia[f.fecha]=porDia[f.fecha]||[]).push(f)});
    const choques=Object.keys(porDia).filter(d=>porDia[d].length>1).sort();
    const prioridades=fechas.map(f=>{
      const c=ctx.cursos.find(x=>x.id===f.cursoId),req=c?c.requerido:nivel(f);
      return {texto:`${f.titulo} · ${courseName(ctx,f.cursoId)} · ${when(f.fecha)}${c?` · nota necesaria ~${comma(Math.round(req*10)/10)}`:''}`,
        dias:diffDays(t0,f.fecha),requerido:req};
    }).sort((a,b)=>a.dias-b.dias||b.requerido-a.requerido).slice(0,3).map(x=>x.texto);
    const alertas=[];
    if(choques.length)choques.forEach(d=>alertas.push(`Se juntan ${porDia[d].length} evaluaciones el ${dshort(d)} (${porDia[d].map(f=>f.titulo).join(', ')}). Te propongo adelantar 30 min de estudio el ${DAYS[(parse(d).getDay()+6)%7].toLowerCase()}.`));
    if(cargadas>=3)alertas.push(`Vienen ${cargadas} días con más carga de lo habitual. Te propongo adelantar 30 min de estudio el martes y dejar el resto liviano.`);
    const baja=ctx.energiaReciente.filter(e=>e<=2).length,modoSuave=ctx.energia!=null&&baja>=2;
    if(modoSuave)alertas.push('Notas varios días con energía baja. Si te hace bien, puedo activar el modo suave por 3 días.');
    const total=fechas.filter(isExam).length;
    const nEv=total===0?'ninguna evaluación':total===1?'1 evaluación':`${total} evaluaciones`,nSes=tareas.length===1?'1 sesión':`${tareas.length} sesiones`;
    const p1=total===0?`Esta semana no tienes evaluaciones y hay ${nSes} planificada${tareas.length===1?'':'s'}. Buen momento para avanzar sin apuro.`:pick([
      `En los próximos 7 días tienes ${nEv} y ${nSes} pendiente${tareas.length===1?'':'s'}. La carga va de ${Math.min.apply(null,dias.map(d=>d.carga))} a ${Math.max.apply(null,dias.map(d=>d.carga))} min por día.`,
      `Para esta semana veo ${nEv} y ${nSes}. El plan se reparte con un límite diario de ${dias[0]?dias[0].capacidad:180} min.`,
      `La semana trae ${nEv} y ${nSes}. Hay espacio para avanzar sin llenar todos los días.`
    ]);
    const p2=pick([
      `El día más pesado es ${DAYS[(parse(pesado.fecha).getDay()+6)%7].toLowerCase()} ${dshort(pesado.fecha)}, con ${pesado.carga} de ${pesado.capacidad} min previstos.`,
      `La carga sube el ${DAYS[(parse(pesado.fecha).getDay()+6)%7].toLowerCase()} ${dshort(pesado.fecha)} (${pesado.carga}/${pesado.capacidad} min); los otros días quedan más tranquilos.`,
      `Por ahora el ${DAYS[(parse(pesado.fecha).getDay()+6)%7].toLowerCase()} ${dshort(pesado.fecha)} concentra la mayor carga (${pesado.carga} de ${pesado.capacidad} min).`
    ]);
    const p3=prioridades.length?`Lo más urgente es ${prioridades[0]}. ${prioridades.length>1?'También aparece '+prioridades[1]+'.':''}`:'No hay evaluaciones marcadas en los próximos 7 días: buen momento para ordenar material sin prisa.';
    const estado=choques.length||cargadas>=3||modoSuave?'preocupado':(!total&&tareas.length<=2?'celebrando':'normal');
    return {titulo:'Tu semana con Arvis',parrafos:[p1,p2,p3].slice(0,3),prioridades,alertas,estado,modoSuave,choques};
  };
  const memoria=historial=>{
    let cursoId=null,fecha=null;
    (historial||[]).forEach(m=>{
      if(!m||m.from!=='yo')return;
      const t=tx(m.text),c=findCourse(t,S.courses||[]),d=parseDate(t);
      if(c)cursoId=c.id;
      if(d)fecha=d;
    });
    if(pendiente&&pendiente.datos){
      if(pendiente.datos.courseId)cursoId=pendiente.datos.courseId;
      if(pendiente.datos.fecha)fecha=pendiente.datos.fecha;
    }
    return {cursoId,fecha};
  };
  // TODO (versión con licencia): reemplazar cada función de ArvisIA por una llamada a una Edge Function de Supabase con un modelo de lenguaje, enviando solo el contexto mínimo de ArvisIA.context() (ramos, fechas, tareas y notas) y NUNCA datos de bienestar sin consentimiento.
  const opcionesRamos=()=>(S.courses||[]).slice(0,8).map(c=>({label:c.name,value:c.name}));
  const opcionesFechas=()=>['mañana','en 3 dias','en 7 dias'].map(v=>({label:v==='mañana'?'Mañana':v.replace('en ','En ').replace(' dias',' días'),value:v}));
  const pregunta=(tipo,texto,opciones=[])=>({tipo,texto,opciones});
  const missing=(kind,d,mem,faltan)=>{const p=askFalta(kind,d,mem,faltan);return {texto:p.texto,pregunta:p}};
  const askFalta=(kind,d,mem,faltan)=>{
    const missing=faltan[0];
    pendiente={kind,datos:d,missing};
    if(missing==='ramo')return pregunta('ramo',`¿De qué ramo ${kind==='addEvent'?'es esa fecha':kind==='registrarNota'?'es la nota':kind==='addStudy'?'quieres estudiar':'lo revisamos'}?`,opcionesRamos());
    if(missing==='fecha')return pregunta('fecha','¿Para qué fecha lo dejamos?',opcionesFechas());
    if(missing==='ponderacion')return pregunta('ponderacion','¿Cuánto pondera esa evaluación? (por ejemplo, 30%)',[{label:'10%',value:'10'},{label:'20%',value:'20'},{label:'30%',value:'30'},{label:'40%',value:'40'}]);
    if(missing==='evento'){
      const evs=future(useContext(null),60).filter(e=>!d.courseId||e.courseId===d.courseId).slice(0,8);
      return pregunta('evento','¿Cuál de estas fechas?',evs.map(e=>({label:`${e.titulo} · ${dshort(e.fecha)}`,value:e.titulo})));
    }
    if(missing==='tarea'){
      const ts=(S.tasks||[]).filter(t=>t.date===today()&&!t.done).slice(0,8);
      return pregunta('tarea','¿Cuál sesión marcamos?',ts.map(t=>({label:`${cname(t.courseId)} · ${t.title||'Estudio'} (${t.minutes} min)`,value:t.title||'Estudio'})));
    }
    return pregunta('texto','¿Me das ese dato?',[]);
  };
  const resolverPendiente=(t,mem)=>{
    if(!pendiente)return null;
    const p=pendiente,d=p.datos,m=mem;
    if(p.missing==='ramo'){
      const c=findCourse(t,S.courses||[])||(S.courses||[]).find(x=>tx(x.name)===t);
      if(!c)return missing(p.kind,d,m,['ramo']);
      d.courseId=c.id;
    }else if(p.missing==='fecha'){
      const f=parseDate(t);
      if(!f)return missing(p.kind,d,m,['fecha']);
      d.fecha=f;
    }else if(p.missing==='ponderacion'){
      const w=t.match(/(\d{1,3})(?:\s*%)?/);
      if(!w||+w[1]<=0||+w[1]>100)return missing(p.kind,d,m,['ponderacion']);
      d.ponderacion=+w[1];
    }else if(p.missing==='evento'||p.missing==='tarea'){
      d.eleccion=t.replace(/^(evento|tarea):\s*/,'');
    }
    p.missing=null;
    const kind=p.kind;
    pendiente=null;
    if(kind==='addEvent')return intencionAdd(tx(`${d.titulo||''} de ${courseName(useContext(null),d.courseId)} el ${d.fecha}`),mem,d);
    if(kind==='moveEvent')return intencionMove(tx(`${d.titulo||''} de ${courseName(useContext(null),d.courseId)} el ${d.fecha}`),mem,d);
    if(kind==='delEvent')return intencionDel(tx(`${d.titulo||''} de ${courseName(useContext(null),d.courseId)}`),mem,d);
    if(kind==='doneTask')return intencionDone(tx(`${d.eleccion||''} de ${courseName(useContext(null),d.courseId)}`),mem,d);
    if(kind==='registrarNota')return intencionNota(tx(`me saque ${d.score} en ${d.nombre||''} de ${courseName(useContext(null),d.courseId)} pondera ${d.ponderacion||''}`),mem,d);
    if(kind==='addStudy')return intencionStudy(tx(`estudiar ${courseName(useContext(null),d.courseId)} el ${d.fecha} ${d.minutos||60} min`),mem,d);
    return null;
  };
  const findEventByText=(t,courseId,d)=>{
    let evs=(S.events||[]).filter(e=>e.date>=addDays(today(),-30));
    if(courseId)evs=evs.filter(e=>e.courseId===courseId);
    if(d&&d.eventId)return evs.find(e=>e.id===d.eventId)||null;
    const m=t.match(/\b(\d{1,2})\b/);
    if(m){
      const named=evs.filter(e=>tx(e.title).includes(' '+m[1]));
      if(named.length)return named[0];
    }
    if(d&&d.eleccion){
      const chosen=evs.filter(e=>tx(e.title)===tx(d.eleccion)||tx(e.title).includes(tx(d.eleccion)));
      if(chosen.length)return chosen[0];
    }
    const words=t.split(/[^a-z0-9]+/).filter(w=>w.length>=4);
    return evs.find(e=>words.some(w=>tx(e.title).includes(w)))||evs[0]||null;
  };
  const scoreFrom=t=>{
    const m=tx(t).match(/\b([1-7](?:[,.]\d{1,2})?)\b/);
    return m?parseFloat(m[1].replace(',','.')):null;
  };
  const minutesFrom=t=>{
    t=tx(t);
    if(/\bmedia hora\b/.test(t))return 30;
    let m=t.match(/\b(\d{1,3})\s*(?:min|minutos)\b/);
    if(m)return Math.min(240,Math.max(15,+m[1]));
    m=t.match(/\b(\d{1,2})(?:[.,](\d))?\s*(?:hora|horas)\b/);
    if(m)return Math.min(240,Math.max(15,Math.round((+m[1]+(m[2]?+m[2]/10:0))*60)));
    return 60;
  };
  const intencionAdd=(t,mem,d)=>{
    const c=d&&d.courseId?S.courses.find(x=>x.id===d.courseId):findCourse(t,S.courses||[]);
    const fecha=(d&&d.fecha)||parseDate(t),type=eventType(t),titulo=d&&d.titulo||eventTitle(t,type);
    if(!(S.courses||[]).length)return {texto:'Primero necesito al menos un ramo. Puedes importarlos desde tu universidad en Ajustes → Cuenta.',acciones:[goAction('cuenta')]};
    if(!c||!fecha){
      const faltan=[!c&&'ramo',!fecha&&'fecha'].filter(Boolean),texto=faltan.length===2?'Me falta el ramo y la fecha. Escríbelo así, por ejemplo: «Agrega certamen 2 el 28/11».':(!c?'Me falta el ramo.':'Ya tengo el ramo; me falta la fecha.');
      const datos={courseId:c&&c.id,titulo,type,fecha};
      return {texto,pregunta:askFalta('addEvent',datos,mem,faltan)};
    }
    if(fecha<today())return {texto:'Esa fecha ya pasó. ¿Me das una de hoy en adelante?',pregunta:askFalta('addEvent',{courseId:c.id,titulo,type},mem,['fecha'])};
    if((S.events||[]).some(e=>e.courseId===c.id&&e.date===fecha&&tx(e.title)===tx(titulo)))return {texto:`Ya tienes «${titulo}» de ${c.name} ese día. No la dupliqué.`};
    return {texto:pick([`Agrego «${titulo}» de ${c.name} para el ${when(fecha)} y después reordeno tus sesiones.`,`Agrego «${titulo}» de ${c.name} el ${when(fecha)}. ¿Confirmas?`]),
      propuesta:{label:'Sí, agregar',kind:'addEvent',data:{courseId:c.id,title:titulo,date:fecha,type}},estado:'normal'};
  };
  const intencionMove=(t,mem,d)=>{
    const c=d&&d.courseId?S.courses.find(x=>x.id===d.courseId):findCourse(t,S.courses||[]);
    const fecha=(d&&d.fecha)||parseDate(t)||mem.fecha;
    if(!c)return {texto:'¿De qué ramo movemos la fecha?',pregunta:askFalta('moveEvent',{fecha},mem,['ramo'])};
    const ev=findEventByText(t,c.id,d);
    if(!ev)return {texto:`No encontré esa fecha en ${c.name}.`,pregunta:askFalta('moveEvent',{courseId:c.id,fecha},mem,['evento'])};
    if(!fecha)return {texto:'¿Para qué día la movemos?',pregunta:askFalta('moveEvent',{courseId:c.id,eventId:ev.id,titulo:ev.title},mem,['fecha'])};
    if(fecha<today())return {texto:'Mejor dejamos la fecha en hoy o más adelante.',pregunta:askFalta('moveEvent',{courseId:c.id,eventId:ev.id,titulo:ev.title},mem,['fecha'])};
    return {texto:pick([`Muevo «${ev.title}» de ${c.name} del ${dshort(ev.date)} al ${when(fecha)}.`,`Te propongo mover «${ev.title}» al ${when(fecha)}; antes era el ${dshort(ev.date)}.`]),
      propuesta:{label:'Sí, mover',kind:'moveEvent',data:{eventId:ev.id,date:fecha,desde:ev.date}},estado:'normal'};
  };
  const intencionDel=(t,mem,d)=>{
    const c=d&&d.courseId?S.courses.find(x=>x.id===d.courseId):findCourse(t,S.courses||[]);
    if(!c)return {texto:'¿De qué ramo sacamos la fecha?',pregunta:askFalta('delEvent',{},mem,['ramo'])};
    const ev=findEventByText(t,c.id,d);
    if(!ev)return {texto:`No encontré esa fecha en ${c.name}.`,pregunta:askFalta('delEvent',{courseId:c.id},mem,['evento'])};
    return {texto:`Quito «${ev.title}» de ${c.name} del ${dshort(ev.date)} y reacomodo el plan. No se pierde nada hasta que confirmes.`,
      propuesta:{label:'Sí, eliminar',kind:'delEvent',data:{eventId:ev.id}},estado:'normal'};
  };
  const intencionDone=(t,mem,d)=>{
    const ts=(S.tasks||[]).filter(x=>x.date===today()&&!x.done);
    if(!ts.length)return {texto:'Hoy no quedan sesiones por marcar. Si quieres, seguimos con otra cosa.'};
    const c=d&&d.courseId?S.courses.find(x=>x.id===d.courseId):findCourse(t,S.courses||[]);
    const q=tx((d&&d.eleccion)||t),cands=c?ts.filter(x=>x.courseId===c.id):ts;
    const task=(d&&d.eventId&&cands.find(x=>x.id===d.eventId))||cands.find(x=>q.includes(tx(x.title)))||cands[0];
    if(!task)return {texto:'¿Cuál sesión marcamos?',pregunta:askFalta('doneTask',{},mem,['tarea'])};
    return {texto:`Marco como hecha «${task.title||'Estudio'}» de ${cname(task.courseId)} (${task.minutes} min).`,
      propuesta:{label:'Sí, marcar',kind:'doneTask',data:{taskId:task.id}},estado:'celebrando'};
  };
  const intencionNota=(t,mem,d)=>{
    const c=d&&d.courseId?S.courses.find(x=>x.id===d.courseId):findCourse(t,S.courses||[]);
    const score=d&&d.score!=null?d.score:scoreFrom(t);
    if(!c)return {texto:'¿En qué ramo registramos la nota?',pregunta:askFalta('registrarNota',{score},mem,['ramo'])};
    if(score==null)return {texto:'¿Qué nota registramos? Escríbela así: 5,2.'};
    const nombre=d&&d.nombre?d.nombre:eventTitle(t,'evaluacion');
    const g=(c.grades||[]).find(x=>tx(x.name).includes(tx(nombre))||tx(nombre).includes(tx(x.name)))||
      (S.events||[]).find(e=>e.courseId===c.id&&tx(e.title).includes(tx(nombre)));
    const peso=d&&d.ponderacion!=null?d.ponderacion:(g&&g.weight);
    if(peso==null)return {texto:`No tengo la ponderación de «${nombre}». ¿Cuánto vale en el promedio?`,pregunta:askFalta('registrarNota',{courseId:c.id,nombre,score},mem,['ponderacion'])};
    return {texto:pick([`Registro ${comma(score)} en «${nombre}» de ${c.name}, con ${peso}% de ponderación.`,`Anoto ${comma(score)} en «${nombre}» de ${c.name} (${peso}%).`]),
      propuesta:{label:'Sí, registrar',kind:'registrarNota',data:{courseId:c.id,name:nombre,score,weight:peso,gradeId:g&&g.id&&g.score!==undefined?g.id:null}},estado:'normal'};
  };
  const intencionStudy=(t,mem,d)=>{
    const c=d&&d.courseId?S.courses.find(x=>x.id===d.courseId):findCourse(t,S.courses||[]);
    const fecha=(d&&d.fecha)||parseDate(t)||mem.fecha,minutos=d&&d.minutos||minutesFrom(t);
    if(!c)return {texto:'¿Qué ramo quieres estudiar?',pregunta:askFalta('addStudy',{fecha,minutos},mem,['ramo'])};
    if(!fecha)return {texto:'¿Qué día apartamos ese bloque?',pregunta:askFalta('addStudy',{courseId:c.id,minutos},mem,['fecha'])};
    return {texto:pick([`Aparto ${minutos} min de estudio de ${c.name} para el ${when(fecha)}.`,`Bloque de ${minutos} min para ${c.name} el ${when(fecha)}. Lo dejo listo si confirmas.`]),
      propuesta:{label:'Sí, agendar',kind:'addStudy',data:{courseId:c.id,date:fecha,minutes:minutos}},estado:'estudiando'};
  };
  const continuaPendiente=(t,p)=>{
    const m=p&&p.missing;if(!m)return false;
    if(m==='ramo')return !!(findCourse(t,S.courses||[])||/^(c\d+|[a-z]{3,20})$/.test(t));
    if(m==='fecha')return !!(parseDate(t)||/\b(hoy|mañana|manana|pasado|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(t));
    if(m==='ponderacion')return /\d/.test(t);
    return t.length<80&&!/\?/.test(t);
  };
  const chatNow=(mensaje,historial)=>{
    const raw=String(mensaje||''),t=tx(raw),mem=memoria(historial),inst=currentInstitution();
    if(pendiente&&!continuaPendiente(t,pendiente))pendiente=null;
    if(IA_CRISIS.test(t))return {texto:pick([
      'Gracias por contármelo. Lo que sientes importa y no tienes que pasarlo sola/o. Por favor habla ahora con alguien que pueda acompañarte:',
      'Gracias por escribirme. No tienes que enfrentar esto sola/o; hay personas que pueden acompañarte ahora mismo:']),
      lista:['Línea de Prevención del Suicidio: *4141 desde un celular (gratuita, 24/7).','Salud Responde: 600 360 7777.',
        'Si hay peligro inmediato: 131 (ambulancia) o 133.',
        inst?`${inst.support.service}: ${inst.support.email} · ${inst.support.phone} (dato de ejemplo).`:''].filter(Boolean),
      acciones:[goAction('apoyo')],estado:'preocupado'};
    const temas=typeof topicsChatReply==='function'?topicsChatReply(raw):null;      // planificación por temas (js/topics.js)
    if(temas){pendiente=null;return {...base(),...temas}}
    if(/\b(llevame|abre|abrir|vamos a|ir a)\b/.test(t)){const k=helpKey(t);if(k)return {texto:'Vamos a '+(IA_TAB_LABEL[k]||k)+'.',acciones:[goAction(k)],navegar:k}}
    if(/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(t)&&t.length<25)
      return {texto:pick([`¡Hola, ${displayName()}! Soy Arvis. Puedo contarte qué tienes hoy, tus próximas evaluaciones y cómo vas en notas, agregar fechas o bajarte la carga. ¿Qué necesitas?`,`¡Hola, ${displayName()}! Estoy aquí para ayudarte a ordenar la semana, revisar notas o preparar lo que viene. ¿Por dónde empezamos?`]),sugerir:true};
    if(pendiente){
      const r=resolverPendiente(t,mem);
      if(r)return r;
    }
    if(/\b(resume|resumen|resumeme)\b/.test(t)&&/\bsemana\b/.test(t)){
      const r=buildSummary();
      return {texto:`${r.titulo}: ${r.parrafos[0]} ${r.parrafos[1]}`,lista:r.prioridades.slice(0,2),estado:r.estado,
        acciones:[{label:'Ver resumen completo',fn:'chatWeeklyFull'}],resumen:true};
    }
    if(/\b(que hago ahora|que toca ahora|ahora que hago|por donde empiezo|que hago hoy)\b/.test(t)){
      const ts=(S.tasks||[]).filter(x=>x.date===today()&&!x.done);
      if(!ts.length)return {texto:pick(['No quedan sesiones pendientes hoy. Puedes descansar tranquila/o o revisar lo que viene.','Hoy el plan está al día. Si quieres, podemos mirar la semana sin presión.']),estado:'celebrando',acciones:[goAction('hoy')]};
      const ctx=useContext(),energia=ctx.energia;
      const orden=ts.slice().sort((a,b)=>{
        const ea=(S.events||[]).find(e=>e.id===a.eventId),eb=(S.events||[]).find(e=>e.id===b.eventId);
        const da=ea?ea.date:'9999-12-31',db=eb?eb.date:'9999-12-31';
        if(energia!=null&&energia<=2){const la=a.kind==='repaso_ligero'?0:1,lb=b.kind==='repaso_ligero'?0:1;return la-lb||a.minutes-b.minutes||da.localeCompare(db)}
        return da.localeCompare(db)||a.minutes-b.minutes;
      });
      const one=orden[0];
      const notaEnergia=energia!=null&&energia<=2?' Con tu check-in de hoy, elijo la opción más ligera.':energia!=null?' Tu check-in de hoy ajusta la sugerencia.':' No usé datos de bienestar: no hay check-in con consentimiento.';
      return {texto:pick([`Empieza por una sola cosa: ${one.title||'Estudio'} de ${cname(one.courseId)} (${one.minutes} min).`,`Te sugiero una sola sesión ahora: ${one.title||'Estudio'} de ${cname(one.courseId)}, ${one.minutes} min.`])+notaEnergia,
        lista:[`${cname(one.courseId)} · ${one.title||'Estudio'} (${one.minutes} min)`],acciones:[goAction('hoy')],
        propuesta:{label:'Ya la hice',kind:'doneTask',data:{taskId:one.id}},estado:'normal'};
    }
    if(/\b(ramo|curso|materia)\b/.test(t)&&/\b(mas complicad|más complicad|dificil|difícil|apretad|complicad)\b/.test(t)){
      const ctx=useContext(),hoy=ctx.hoy;
      const ranking=ctx.cursos.map(c=>{
        const evs=future(ctx,21).filter(e=>e.courseId===c.id),prox=evs[0],dias=prox?diffDays(hoy,prox.fecha):30;
        return {c,score:c.requerido*2+(30-Math.min(dias,30))/3+(evs.length>1?2:0),dias,prox};
      }).sort((a,b)=>b.score-a.score);
      const top=ranking[0];
      if(!top)return {texto:'Todavía no tengo ramos para comparar.'};
      return {texto:pick([`El que se ve más complicado es ${top.c.nombre}.`,`Por fechas y notas, ${top.c.nombre} es el que pide más atención ahora.`])+
        (top.prox?` Tiene «${top.prox.titulo}» el ${when(top.prox.fecha)} y la nota necesaria ronda ${comma(top.c.requerido)}.`:` La nota necesaria ronda ${comma(top.c.requerido)}; conviene revisarlo sin apuro.`),
        lista:ranking.slice(0,3).map(x=>`${x.c.nombre} · nota ~${comma(x.c.requerido)} · ${x.prox?'próxima fecha '+dshort(x.prox.fecha):'sin fecha cercana'}`),
        acciones:[goAction('notas'),goAction('semana')],estado:'normal'};
    }
    if(/\b(cuanto necesito|cuanto tengo que sacar|nota necesaria|para aprobar)\b/.test(t)){
      const c=findCourse(t,S.courses||[])||(mem.cursoId&&S.courses.find(x=>x.id===mem.cursoId));
      if(!c)return {texto:'Dime el ramo y revisamos la nota necesaria.',pregunta:pregunta('ramo','¿De qué ramo?',opcionesRamos())};
      const g=gradeSummary(c.grades,c);
      const texto=g.need==null?`En ${c.name} ya está completo el 100% evaluado; tu promedio es ${comma(g.shown)}.`
        :`En ${c.name} tienes un ${comma(g.shown)} con ${g.wsum}% evaluado. Para aprobar con ${comma(g.pass)} necesitas ~${comma(Math.round(g.need*10)/10)} en lo que queda.`;
      return {texto:pick([texto,`Revisando ${c.name}: ${g.need==null?'ya no queda nota por cubrir.':`necesitas ~${comma(Math.round(g.need*10)/10)} para llegar a ${comma(g.pass)}.`}`]),acciones:[goAction('notas')]};
    }
    if(/\b(mueve|mover|cambia|cambiar|corre|correr|pasa|pasar|traslada)\b/.test(t)&&IA_EVAL.test(t))return intencionMove(t,mem,null);
    if(/\b(agrega|agregar|anota|anotar|anade|registra|registrar|pon|ponme|crea|crear)\b/.test(t)&&IA_EVAL.test(t))return intencionAdd(t,mem,null);
    if(/\b(elimina|eliminar|borra|borrar|quita|quitar|saca|sacar)\b/.test(t)&&IA_EVAL.test(t))return intencionDel(t,mem,null);
    if(/\b(marca|marcar|ya hice|complete|completé|termine|terminé)\b/.test(t)&&/micro.?tarea|tarea|sesion/.test(t))return intencionDone(t,mem,null);
    if(/\b(saque|saqué|obtuve|registra nota|registrar nota|anota nota|me fue|calificacion|calificación)\b/.test(t)&&/\b(nota|saque|saqué|obtuve|calificacion|calificación)\b/.test(t))return intencionNota(t,mem,null);
    if(/\b(estudiar|estudio|bloque de estudio|agendar estudio)\b/.test(t))return intencionStudy(t,mem,null);
    if(/\b(reorganiza|replanifica|reprograma|reordena)\b|modo suave|baja(r)? la carga|estoy (muy )?(cansad|agotad|colapsad)|no alcanzo|me atrase/.test(t)){
      if(typeof softOn==='function'&&softOn(today()))return {texto:'Ya tienes el modo suave activo hasta el '+dshort(S.soft.until)+'. Puedo reorganizar lo pendiente igual, sin culpa.',propuesta:{label:'Reorganizar pendientes',kind:'replan'}};
      return {estado:'cansado',texto:pick(['Te propongo activar el modo suave por 3 días: bajo tu carga un 25% y reacomodo lo pendiente. ¿Lo activo?','Si te sirve, bajo la carga por 3 días y reordeno lo pendiente. Tú decides.']),propuesta:{label:'Activar modo suave',kind:'soft'}};
    }
    if(/\b(pomodoro|concentrar(me)?|empezar a estudiar|ponerme a estudiar|temporizador)\b/.test(t))
      return {estado:'estudiando',texto:'¿Parto un pomodoro de '+pomCfg().focusMin+' minutos? Te llevo a Herramientas.',propuesta:{label:'Iniciar pomodoro',kind:'pomodoro'}};
    if(/\b(hoy|ahora)\b/.test(t)&&/\b(que|tengo|toca|plan|hago|tareas?|pendiente)\b/.test(t)&&!/como (se )?usa/.test(t)){
      const ts=(S.tasks||[]).filter(x=>x.date===today()&&!x.done),cap=capFor(today()),hecho=doneToday();
      const check=typeof ci==='function'?ci(today()):null;
      const privacidad=check?'Tu check-in de hoy ajusta la capacidad.':'No usé datos de bienestar: no hay check-in con consentimiento.';
      if(!ts.length)return {estado:hecho?'celebrando':'normal',texto:pick([hecho?`Hoy ya sumaste ${hecho} min y no quedan sesiones. Puedes descansar tranquila/o. ${privacidad}`:`No tienes sesiones para hoy. Si agregas fechas, armo un plan liviano. ${privacidad}`,`Hoy está despejado. Podemos dejarlo así. ${privacidad}`]),acciones:[goAction('hoy')]};
      return {texto:`Para hoy tienes ${ts.length} sesión(es). Capacidad ~${cap} min · ${hecho} min registrados. ${privacidad}`,
        lista:ts.slice(0,6).map(x=>`${cname(x.courseId)} · ${x.title||'Estudio'} (${x.minutes} min)`),acciones:[goAction('hoy')]};
    }
    if(/\b(proxim|evaluacion|certamen|prueba|control|entrega|examen|fecha)/.test(t)&&/\b(que|cuando|cuales|tengo|vienen|hay|proxim)/.test(t)){
      const evs=future(useContext(null),21),c=findCourse(t,S.courses||[]),lista=c?evs.filter(e=>e.courseId===c.id):evs;
      if(!lista.length)return {texto:c?`No veo evaluaciones de ${c.nombre} en las próximas 3 semanas.`:'No tienes evaluaciones en las próximas 3 semanas.',acciones:[goAction('syllabus')]};
      return {estado:diffDays(today(),lista[0].fecha)<3?'preocupado':'normal',texto:pick([`Esto viene en las próximas 3 semanas${c?' en '+c.nombre:''}:`,`Te tengo estas fechas a la vista${c?' de '+c.nombre:''}:`]),
        lista:lista.slice(0,8).map(e=>`${e.titulo} · ${courseName(useContext(null),e.cursoId)} · ${when(e.fecha)}`),acciones:[goAction('semana')]};
    }
    if(/\b(nota|notas|promedio|como voy|apruebo|aprobar|necesito sacar)\b/.test(t)&&!/como (se )?usa/.test(t)){
      const c=findCourse(t,S.courses||[]),cs=c?[c]:S.courses;
      if(!cs.length)return {texto:'Aún no tienes ramos registrados.',acciones:[goAction('ramos')]};
      const lines=cs.map(k=>{
        const g=gradeSummary(k.grades,k);
        if(g.avg==null)return `${k.name}: sin notas todavía.`;
        let s=`${k.name}: promedio ${comma(g.shown)} con ${g.wsum}% evaluado.`;
        if(g.need!=null)s+=g.need<=1?' Ya tienes asegurado el '+comma(g.pass)+'.':(g.need>7?' Con lo que queda no alcanza el '+comma(g.pass)+'; conversa con tu docente.':` Necesitas ~${comma(Math.round(g.need*10)/10)} en lo que queda.`);
        return s;
      });
      return {texto:c?'Así vas:':'Así vas en tus ramos:',lista:lines,acciones:[goAction('notas')]};
    }
    if(/\b(receso|feriado|vacaciones|semana de certamenes|calendario academico|cuando termina|fin de semestre)\b/.test(t)&&inst){
      const c=institutionCalendar(inst),t0=today();
      const items=[...c.examWeeks.map(x=>`${x.label}: ${dshort(x.start)} – ${dshort(x.end)}`),...c.breaks.map(x=>`${x.label}: ${dshort(x.start)} – ${dshort(x.end)}`),
        ...c.holidays.filter(h=>h.date>=t0).map(h=>`${h.label}: ${dshort(h.date)}`),`Fin de clases: ${dshort(c.classesEnd)}`];
      return {texto:`Calendario de ${inst.short} (datos de ejemplo):`,lista:items,acciones:[goAction('semana')]};
    }
    if(/\b(psicolog|dise|bienestar estudiantil|hablar con alguien|apoyo|ansiedad|angustia|triste|estres|estresad)/.test(t)&&inst)
      return {estado:'preocupado',texto:`Siento que estés pasando por esto. En ${inst.short} puedes contactar a ${inst.support.service} (${inst.support.email} · ${inst.support.phone}, ${inst.support.hours}; dato de ejemplo).`,
        acciones:[goAction('apoyo')]};
    const k=helpKey(t);
    if(k&&typeof AYUDA!=='undefined'&&AYUDA[k]){
      const h=AYUDA[k];
      return {texto:`${h.title}: ${h.desc}`,lista:h.steps||[],acciones:[goAction(k)]};
    }
    return {texto:pick(['Todavía soy un prototipo y no entendí eso. Prueba con alguna de estas ideas:','No situé esa petición, pero puedo ayudarte con esto:']),sugerir:true};
  };
  async function chat(mensaje,historial){
    if(!ready())return null;
    const r=chatNow(mensaje,historial);
    await wait(r);
    return r;
  }
  async function weeklySummary(contexto){
    if(!ready()&&!contexto)return null;
    const r=buildSummary(contexto);
    await wait(r);
    return r;
  }
  const IA_SEGURO='Seguro',IA_REVISION='Revísalo';
  const IA_FC_VACIO='No encontré material suficiente para tarjetas. Prueba con definiciones «Término: definición» u «X es Y», fórmulas con «=», listas con viñetas bajo un título o preguntas seguidas de su respuesta.';
  const linea=s=>String(s||'').replace(/\s+/g,' ').trim();
  const numero=s=>{const n=parseNum(String(s==null?'':s).replace(',','.'));return Number.isFinite(n)?n:null};
  const notaStr=v=>Number(v).toFixed(1).replace('.',',');
  const articulo=t=>/(as|iones|ades|ices)$/.test(tx(t))?'las':'los';

  function extractSyllabusSync(texto,courseId){
    if(!ready())return null;
    const bruto=String(texto||''),lineas=bruto.split(/\r?\n/).map(linea).filter(Boolean);
    const fechas=(typeof detectEvents==='function'?detectEvents(bruto,courseId):[]).map(e=>({
      courseId:e.courseId,title:e.title,date:e.date,type:e.type,keep:e.keep,note:e.note||'',
      confianza:e.type==='otro'||/rango|paso/.test(tx(e.note||''))?IA_REVISION:IA_SEGURO
    }));
    const reglas=[],contenidos=[],ponderaciones=[],avisos=[],usadas=new Set();
    const agregarRegla=(texto,campo,valor,confianza,note)=>{
      const t=linea(texto);if(t.length<4)return;
      const clave=norm(t);if(reglas.some(r=>norm(r.texto)===clave))return;
      reglas.push({texto:t.slice(0,200),campo:campo||'',valor:valor==null?null:valor,keep:true,confianza,note:note||''});
    };
    const agregarPonderacion=(nombre,peso,confianza,note)=>{
      const n=linea(nombre).slice(0,80);if(n.length<2||!(peso>0&&peso<=100))return;
      if(ponderaciones.some(p=>norm(p.nombre)===norm(n)))return;
      ponderaciones.push({nombre:n,peso:Math.round(peso*10)/10,keep:true,confianza,note:note||''});
    };
    const agregarContenido=(texto,confianza)=>{
      const t=linea(texto);if(t.length<3)return;
      if(contenidos.some(c=>norm(c.texto)===norm(t)))return;
      contenidos.push({texto:t.slice(0,200),keep:true,confianza});
    };

    lineas.forEach((l,i)=>{
      const t=tx(l);let m;
      if(/nota\s+(?:m[ií]nima|de aprobaci[oó]n|aprobatoria|para aprobar)/.test(t)&&(m=l.match(/(\d+(?:[.,]\d+)?)/))){
        const v=numero(m[1]);
        if(v>=1&&v<=7){agregarRegla(`Nota mínima ${notaStr(v)}`,'passGrade',v,/aprox|\?/.test(t)?IA_REVISION:IA_SEGURO);usadas.add(i)}
      }
      if(/exigencia/.test(t)&&(m=l.match(/(\d+(?:[.,]\d+)?)\s*%/))){
        const v=numero(m[1]);
        if(v>0&&v<=100){agregarRegla(`Exigencia: ${comma(Math.round(v*10)/10)} %`,'exigencia',v,/aprox|\?/.test(t)?IA_REVISION:IA_SEGURO);usadas.add(i)}
      }
      if(/eximici[oó]n|examen\s+obligatorio|asistencia\s+m[ií]nima/.test(t)){
        agregarRegla(l,'',null,/aprox|\?|mas de|más de|menos de/.test(t)?IA_REVISION:IA_SEGURO,'Requisito informativo del syllabus');
        usadas.add(i);
      }
    });

    lineas.forEach((l,i)=>{
      if(usadas.has(i))return;
      const t=tx(l);
      if(/nota final\s*=/.test(t)||/promedio final\s*=/.test(t)){
        const rhs=l.split('=').slice(1).join('=');
        const rx=/(\d+(?:[.,]\d+)?)\s*[·•*×xX]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ][\wÁÉÍÓÚáéíóúÑñ]*\d*)/g;
        let m;
        while((m=rx.exec(rhs))){
          let w=numero(m[1]);if(w==null)continue;
          if(w>0&&w<=1)w=Math.round(w*1000)/10;
          agregarPonderacion(m[2],w,IA_SEGURO,'Peso obtenido de la fórmula de nota final');
        }
        return;
      }
      const pm=l.match(/(\d+(?:[.,]\d+)?)\s*%/);if(!pm)return;
      const rango=l.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*%/);
      const dudoso=!!rango||/aprox|~|\?/.test(t);
      const w=numero(rango?rango[1]:pm[1]);
      let nombre=l.slice(0,(rango||pm).index).replace(/^[\s\-–—•·*|]+|[\s:;,()\-–—]+$/g,'').trim();
      nombre=nombre.replace(/^(ponderaci[oó]n|pondera|vale)\s*(de|es|del|:)?\s*/i,'').trim();
      if(nombre.length<2||/\d{1,2}[\/\-]\d{1,2}/.test(nombre))return;
      agregarPonderacion(nombre,w,dudoso?IA_REVISION:IA_SEGURO,
        dudoso?'Porcentaje ambiguo: revísalo':'');
    });

    let conTema=false;
    lineas.forEach((l,i)=>{
      if(usadas.has(i))return;
      const m=l.match(/^(semana|unidad|m[oó]dulo|tema|cap[ií]tulo)\s*(\d{1,2})?\s*(?:[:.–-]\s*(.+))?$/i);
      if(m){
        const rotulo=cap(m[1])+(m[2]?' '+m[2]:'');
        agregarContenido(m[3]?`${rotulo}: ${linea(m[3])}`:rotulo,m[3]?IA_SEGURO:IA_REVISION);
        conTema=!!m[3];return;
      }
      if(conTema&&/^[-•*]\s+\S/.test(l)){
        agregarContenido(l.replace(/^[-•*]\s+/,''),IA_REVISION);return;
      }
      if(l&&!/^[-•*]/.test(l))conTema=false;
    });

    const suma=ponderaciones.reduce((a,p)=>a+(Number(p.peso)||0),0);
    if(Math.round(suma*10)/10!==100)avisos.push(`Las ponderaciones suman ${comma(Math.round(suma*10)/10)} %, no 100 %. Revísalas antes de confirmar.`);
    if(fechas.some(f=>f.confianza===IA_REVISION))avisos.push('Hay fechas sin tipo claro o con rango: revísalas antes de confirmar.');
    const pass=reglas.find(r=>r.campo==='passGrade'),exig=reglas.find(r=>r.campo==='exigencia');
    return {courseId,fechas,ponderaciones,reglas,contenidos,avisos,
      passGrade:pass?Math.round(pass.valor*100)/100:null,exigencia:exig?exig.valor:null};
  }

  function makeFlashcardsSync(texto,opciones){
    if(!ready())return null;
    const o=opciones||{};
    const pedida=+o.cantidad;
    const cantidad=Number.isFinite(pedida)?clamp(Math.round(pedida),1,50):20;
    const tipo=['completar','mixto'].includes(tx(o.tipo))?tx(o.tipo):'preguntas';
    const bruto=String(texto||''),todas=bruto.split(/\r?\n/).map(linea).filter(l=>l.trim().length>=4&&l.length<=300);
    const descartadas=bruto.split(/\r?\n/).filter(l=>l.trim()).length-todas.length;
    const preguntas=[],vistas=new Set(),usadas=new Set();
    const add=(front,back,kind,indices)=>{
      const f=linea(front).slice(0,300),b=linea(back).slice(0,300);
      if(f.length<4||!b||b.length>300)return false;
      const key=norm(f)+'|'+norm(b);if(vistas.has(key))return false;
      vistas.add(key);preguntas.push({front:f,back:b,tipo:kind});
      (indices||[]).forEach(i=>usadas.add(i));return true;
    };

    todas.forEach((l,i)=>{
      if(usadas.has(i)||!/:$/.test(l)||/=|\?$/.test(l))return;
      const vi=[],balas=/^(?:[-•*]\s+\S|\d+[.)]\s+\S)/;
      let j=i+1;
      while(j<todas.length&&balas.test(todas[j])){vi.push(todas[j].replace(/^(?:[-•*]\s+|\d+[.)]\s+)/,''));j++}
      if(vi.length<2)return;
      const titulo=l.slice(0,-1).trim();if(titulo.length>80)return;
      add(`¿Cuáles son ${articulo(titulo)} ${titulo.toLowerCase()}?`,vi.join('; '),'lista',
        Array.from({length:j-i},(_,k)=>i+k));
    });
    todas.forEach((l,i)=>{
      if(usadas.has(i)||!/\?$/.test(l))return;
      let j=i+1;while(j<todas.length&&!todas[j])j++;
      if(j>=todas.length||usadas.has(j)||/\?$/.test(todas[j]))return;
      add(l,todas[j],'pregunta',[i,j]);
    });
    todas.forEach((l,i)=>{
      if(usadas.has(i)||!/=/.test(l))return;
      if(/^(nota final|promedio final)\s*=/.test(tx(l)))return;
      const izq=l.split('=')[0].replace(/^[\s\-–—:;•*|]+|[\s]+$/g,'').trim();
      if(!izq||izq.length>120)return;
      add(`¿Cuál es la fórmula de ${izq}?`,l,'formula',[i]);
    });
    todas.forEach((l,i)=>{
      if(usadas.has(i))return;
      const m=l.match(/^([^:?]{2,60}):\s*(.+)$/);
      if(m&&m[1].trim().length>=2&&m[2].trim().length>=3){
        add(`¿Qué es ${m[1].trim()}?`,m[2].trim().replace(/^se refiere a\s*/i,''),'definicion',[i]);return;
      }
      const d=l.match(/^(.{2,60}?)\s+(?:se define como|se refiere a|es|son)\s+(.{3,})$/i);
      if(d)add(`¿Qué es ${d[1].trim()}?`,d[2].trim(),'definicion',[i]);
    });

    const completar=[];
    todas.forEach((l,i)=>{
      let termino=null,frente=null;
      let m=l.match(/^([^:?]{2,60}):\s*(.+)$/);
      if(m){termino=m[1].trim();frente='____'+l.slice(termino.length)}
      else if((m=l.match(/^(.{2,60}?)\s+(?:se define como|se refiere a|es|son)\s+(.{3,})$/i))){
        termino=m[1].trim();frente='____'+l.slice(termino.length);
      }else if(/=/.test(l)&&!/^(nota final|promedio final)\s*=/.test(tx(l))){
        termino=l.split('=')[0].trim();frente='____ = '+l.split('=').slice(1).join('=').trim();
      }else if(/\?$/.test(l)&&todas[i+1]){
        const respuesta=todas[i+1].replace(/^[-•*]\s+/,'').trim(),pal=respuesta.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]{4,}/);
        if(pal){termino=pal[0];frente=respuesta.replace(termino,'____')}
      }
      if(termino&&frente&&termino.length<=60){
        const key=norm(frente)+'|'+norm(termino);
        if(!vistas.has(key)){vistas.add(key);completar.push({front:frente.slice(0,300),back:termino,tipo:'completar'})}
      }
    });

    let elegidas=[];
    if(tipo==='completar')elegidas=completar.slice(0,cantidad);
    else if(tipo==='mixto'){
      const p=preguntas.slice(0,Math.ceil(cantidad/2)),c=completar.slice(0,cantidad-Math.ceil(cantidad/2));
      for(let i=0;i<cantidad&&(p.length||c.length);i++){
        if(i%2===0&&p.length)elegidas.push(p.shift());
        else if(c.length)elegidas.push(c.shift());
        else if(p.length)elegidas.push(p.shift());
      }
      elegidas=elegidas.concat(p,c).slice(0,cantidad);
    }else elegidas=preguntas.slice(0,cantidad);
    return {tarjetas:elegidas,mensaje:elegidas.length?'':IA_FC_VACIO,avisos:[],
      analizadas:todas.length,descartadas,cantidad,tipo};
  }

  async function extractSyllabus(texto,courseId){
    if(!ready())return null;
    const r=extractSyllabusSync(texto,courseId);await wait(r);return r;
  }
  async function makeFlashcards(texto,opciones){
    if(!ready())return null;
    const r=makeFlashcardsSync(texto,opciones);await wait(r);return r;
  }
  function reset(){pendiente=null}
  /* Planificación por temas: hoy reglas locales (js/topics.js).
     TODO (licencia): reemplazar por un modelo de lenguaje vía Supabase Edge Function, enviando solo temas, fechas, pesos y dominio. */
  function buildTopicMap(){return ready()&&typeof topicsSync==='function'?topicsSync():null}
  async function planStudy(){
    if(!ready()||typeof replanAll!=='function')return null;
    replanAll();const r=typeof weekPlanSync==='function'?weekPlanSync():null;await wait(r);return r;
  }
  function weekPlan(){return ready()&&typeof weekPlanSync==='function'?weekPlanSync():null}
  return {mode:ARVIS_IA_MODE,context,chat,weeklySummary,weeklySummarySync:buildSummary,buildTopicMap,planStudy,weekPlan,
    extractSyllabus,extractSyllabusSync,makeFlashcards,makeFlashcardsSync,reset,
    parseDate,findCourse:(t,courses)=>findCourse(t,courses||S.courses),eventType,eventTitle,when,future:(days)=>future(useContext(null),days)};
})();
