const {chromium}=require('playwright');
const path=require('path');
(async()=>{
  const file=process.argv[2]||path.join(__dirname,'..','index.html');
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1100,height:900}});
  const res=[],errs=[];
  const ok=(name,cond,extra='')=>res.push((cond?'OK   ':'FALLA')+' '+name+(extra?'  → '+extra:''));
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());
  try{
    await p.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
    await p.goto('file://'+path.resolve(file));
    const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
    if(await p.locator('#reg-name').count()){
      await p.fill('#reg-name','Horario');await p.fill('#reg-career','Carrera');
      await p.locator('.hud-btn').click();
    }
    // Día fijo de la semana próxima (lunes) para que la prueba no dependa de la fecha.
    const lunes=await p.evaluate(()=>addDays(mondayOf(today()),7));
    await p.evaluate(()=>{
      S=fresh();S.profile={name:'Horario',career:'Carrera',university:'',nickname:''};S.account.type='personal';
      S.courses=[{id:'c1',name:'Cálculo',difficulty:3,color:'#3b6df0',grades:[],share:false,passGrade:4,roundFinal:true}];
      S.settings.chronotype='noche';save();inval();go('horario');
    });
    await p.waitForTimeout(200);

    ok('Planificación tiene la pestaña Mi horario',await p.locator('nav >> text="Mi horario"').count()>0);
    ok('la ruta es #/planificacion/horario',p.url().endsWith('#/planificacion/horario'),p.url());
    ok('sin actividades muestra el estado vacío',(await p.textContent('#app')).includes('Aún no agregas actividades'));

    // Validaciones del formulario
    await p.click('[data-focus-id="add-personal"]');
    ok('pide marcar al menos un día',(await p.textContent('#toast').catch(()=>''))?.includes('Marca al menos un día')||await p.evaluate(()=>S.personal.length===0));
    await p.fill('#pa-start','20:00');await p.fill('#pa-end','19:00');
    await p.locator('.pa-day').filter({hasText:'Lun'}).click();
    await p.click('[data-focus-id="add-personal"]');
    ok('rechaza horas invertidas',await p.evaluate(()=>S.personal.length===0));

    // Gimnasio semanal lunes y miércoles 18:00–21:30
    await p.fill('#pa-title','Gimnasio');
    await p.locator('.pa-day').filter({hasText:'Mié'}).click();
    await p.fill('#pa-start','18:00');await p.fill('#pa-end','21:30');
    await p.click('[data-focus-id="add-personal"]');
    const gym=await p.evaluate(()=>S.personal[0]);
    ok('guarda la actividad semanal',gym&&gym.kind==='deporte'&&gym.title==='Gimnasio'&&JSON.stringify(gym.days)==='[0,2]'&&gym.start==='18:00'&&gym.end==='21:30',JSON.stringify(gym));
    ok('la lista muestra la actividad',(await p.textContent('#app')).includes('Gimnasio · Lun, Mié · 18:00–21:30'));

    // Salud de una sola fecha: no guarda detalle
    await p.locator('input[name="pa-rep"][value="fecha"]').check();
    await p.waitForTimeout(100);
    await p.fill('#pa-title','Psiquiatra');
    await p.selectOption('#pa-kind','salud');
    ok('en Salud se oculta el nombre',await p.locator('#pa-title-wrap').isHidden()&&await p.locator('#pa-salud-note').isVisible());
    await p.fill('#pa-date',lunes);
    await p.fill('#pa-start','10:00');await p.fill('#pa-end','11:00');
    await p.click('[data-focus-id="add-personal"]');
    const salud=await p.evaluate(()=>S.personal.find(a=>a.kind==='salud'));
    ok('Salud se guarda sin detalle',salud&&salud.title===''&&salud.date&&!salud.days,JSON.stringify(salud));
    ok('Salud nunca guarda el texto escrito',!(await p.evaluate(()=>localStorage.getItem(KEY)||'')).includes('Psiquiatra'));

    // El planificador no pone sesiones encima
    const plan=await p.evaluate(d=>{
      S.events=[{id:'e1',courseId:'c1',title:'Certamen 1',date:addDays(d,3),type:'evaluacion'}];
      replanAll();
      const busy=personalWindows(d);
      const ses=S.tasks.filter(t=>t.date===d&&t.slotStart);
      const choca=ses.filter(t=>busy.some(w=>toMin(t.slotStart)<w.b&&toMin(t.slotEnd)>w.a));
      const libre=freeWindows(d,60).every(([a,b])=>!busy.some(w=>a<w.b&&b>w.a));
      return {ses:ses.length,choca:choca.length,libre,busy};
    },lunes);
    ok('las ventanas libres excluyen las actividades',plan.libre,JSON.stringify(plan));
    ok('ninguna sesión choca con una actividad',plan.choca===0,JSON.stringify(plan));

    // Capacidad: el día con actividades tiene menos base que uno sin ellas
    const cap=await p.evaluate(d=>{inval();const conA=capInfo(d);const otro=addDays(d,1);inval();const sinA=capInfo(otro);return {con:conA.base,pm:conA.pm,sin:sinA.base,txt:capExplain(conA).join(' ')}},lunes);
    ok('la capacidad descuenta el tiempo de actividades',cap.pm===270&&cap.con<cap.sin,JSON.stringify(cap));
    ok('la explicación de capacidad lo menciona',cap.txt.includes('Actividades personales hoy'));

    // Semana y agenda las muestran
    await p.evaluate(d=>{weekStart=mondayOf(d);go('semana')},lunes);
    await p.waitForTimeout(200);
    ok('Semana dibuja los bloques personales',await p.locator('.blk-personal').count()===3,String(await p.locator('.blk-personal').count()));
    const agenda=await p.evaluate(d=>agendaItems(d).map(x=>x.html).join(' '),lunes);
    ok('la agenda del día incluye gimnasio y salud',agenda.includes('Gimnasio')&&agenda.includes('Salud'));

    // Quitar con deshacer
    await p.evaluate(()=>go('horario'));
    await p.locator('.task').filter({hasText:'Gimnasio'}).locator('button.del').click();
    ok('quitar elimina la actividad',await p.evaluate(()=>!S.personal.some(a=>a.title==='Gimnasio')));

    // Respaldos: validación y limpieza
    const bk=await p.evaluate(()=>{
      const good=[{id:'pa1',kind:'trabajo',title:'Turno',days:[4,4,1],start:'09:00',end:'13:00'}];
      const bad=[{id:'pa2',kind:'secreto',title:'x',days:[1],start:'09:00',end:'10:00'}];
      return {clean:JSON.stringify(cleanPersonal(good)),badOk:validPersonal(bad[0]),
        saludClean:cleanPersonal([{id:'pa3',kind:'salud',title:'Detalle',date:'2030-01-01',start:'09:00',end:'10:00'}])[0].title,
        migr:JSON.stringify(migrate({courses:[],events:[],tasks:[],classes:[],sessions:[],wellbeing:{diary:[]},personal:bad}).personal)};
    });
    ok('limpia días repetidos y los ordena',bk.clean==='[{"id":"pa1","kind":"trabajo","title":"Turno","start":"09:00","end":"13:00","days":[1,4]}]',bk.clean);
    ok('rechaza tipos desconocidos',bk.badOk===false&&bk.migr==='[]',bk.migr);
    ok('al importar Salud se borra el detalle',bk.saludClean==='');

    // Las actividades no se comparten: no aparecen en datos de amigos
    const share=await p.evaluate(()=>typeof socialWeekBlocks==='function'?String(socialWeekBlocks(today(),0)):'');
    ok('no aparecen en lo que se comparte con amigos',!share.includes('Turno')&&!share.includes('Salud'));

    // Móvil: sin scroll horizontal
    await p.setViewportSize({width:390,height:844});
    await p.evaluate(()=>go('horario'));await p.waitForTimeout(150);
    ok('móvil sin scroll horizontal',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  }catch(e){res.push('ERROR DEL TEST '+e.message.split('\n')[0])}
  ok('sin errores de consola',errs.length===0,errs.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r=>!r.startsWith('OK'))?1:0);
})();
