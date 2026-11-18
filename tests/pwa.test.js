// Uso: node tests/pwa.test.js <url base, ej. http://localhost:8765/> <carpeta temporal>
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
  const base=process.argv[2],tmp=process.argv[3];fs.mkdirSync(tmp,{recursive:true});
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1100,height:900},acceptDownloads:true});
  await ctx.addInitScript(()=>{try{localStorage.setItem('entrenador-academico-tour-seen-v1','1')}catch(e){}});
  const p=await ctx.newPage();
  const res=[],errs=[],ext=[];
  const ok=(n,c,x='')=>res.push((c?'OK   ':'FALLA')+' '+n+(x?'  → '+x:''));
  p.on('request',r=>{const u=r.url();if(!/^(http:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(u))ext.push(u)});
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  p.on('dialog',d=>d.accept());
  const onboard=async()=>{
    if(await p.locator('#reg-name').count()){
      await p.fill('#reg-name','Estudiante');
      await p.fill('#reg-career','Carrera');
      await p.locator('.hud-btn').click();
    }
    const choice=p.locator('[data-focus-id="account-personal"]');if(await choice.count())await choice.click();
  };
  const open=async(sec,sub)=>{
    await p.locator('.brand').click();
    if(sec!=='Inicio')await p.locator('.home-card').filter({hasText:sec}).click();
    if(sub)await p.click('nav >> text="'+sub+'"');
  };
  const confirmOk=async()=>{
    const d=p.locator('#confirm-dialog');await d.waitFor({state:'visible'});
    await p.click('#confirm-ok');await d.waitFor({state:'hidden'});
  };
  await p.goto(base);
  await onboard();

  // --- PWA ---
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.reload();
  ok('el service worker controla la página',await p.evaluate(()=>!!navigator.serviceWorker.controller));
  const mf=await p.evaluate(async()=>(await fetch('manifest.webmanifest')).json());
  ok('manifest válido',mf.display==='standalone'&&mf.icons.length===3&&mf.lang==='es');
  const ic=await p.evaluate(async()=>{const o=[];for(const u of ['icons/icon-192.png','icons/icon-512.png','icons/icon.svg']){const r=await fetch(u);o.push(u+':'+r.status)}return o});
  ok('iconos disponibles',ic.every(x=>x.endsWith(':200')),ic.join(' '));
  const av=await p.evaluate(async()=>{
    const names=['energia','normal','celebrando','estudiando','preocupado','cansado','descansando'],o=[];
    for(const n of names){const r=await fetch('icons/arvis/arvis-'+n+'.svg');o.push(n+':'+r.status)}
    return o;
  });
  ok('SVG de Arvis disponibles',av.every(x=>x.endsWith(':200')),av.join(' '));
  await ctx.setOffline(true);await p.reload();
  ok('funciona sin conexión',(await p.textContent('#app')).includes('Elige por dónde empezar hoy'));
  await p.waitForFunction(()=>{const i=document.querySelector('.arvis-card img');return i&&i.complete&&i.naturalWidth>0},null,{timeout:5000}).catch(()=>{});
  ok('Arvis se ve sin conexión',await p.evaluate(()=>{const i=document.querySelector('.arvis-card img');return !!i&&i.complete&&i.naturalWidth>0}));
  await ctx.setOffline(false);

  // --- datos de ejemplo + ICS ---
  await open('Ajustes','Datos de ejemplo');await p.click('text=Cargar datos de ejemplo');
  await onboard();
  await open('Académico','Syllabus y fechas');
  const nEv=await p.evaluate(()=>S.events.length);
  const [dl]=await Promise.all([p.waitForEvent('download'),p.click('text=Exportar a calendario (.ics)')]);
  const ics=fs.readFileSync(await dl.path(),'utf8'),lines=ics.split('\r\n');
  ok('ICS: estructura válida',ics.startsWith('BEGIN:VCALENDAR')&&lines.includes('END:VCALENDAR')&&(ics.match(/BEGIN:VEVENT/g)||[]).length===nEv,nEv+' eventos');
  ok('ICS: líneas ≤ 75 bytes',lines.every(l=>Buffer.byteLength(l)<=75),'máx '+Math.max(...lines.map(l=>Buffer.byteLength(l))));
  ok('ICS: fechas de día completo',/DTSTART;VALUE=DATE:\d{8}/.test(ics)&&/DTEND;VALUE=DATE:\d{8}/.test(ics));

  // --- respaldo y restauración ---
  await open('Ajustes','Privacidad');
  const [bk]=await Promise.all([p.waitForEvent('download'),p.click('text=Descargar respaldo (JSON)')]);
  const bkPath=tmp+'/respaldo.json';fs.copyFileSync(await bk.path(),bkPath);
  const bj=JSON.parse(fs.readFileSync(bkPath,'utf8'));
  ok('respaldo contiene los datos',bj.courses.length===4&&bj.events.length===nEv);
  const lb=await p.evaluate(()=>S.lastBackup);ok('se registra la fecha del último respaldo',/^\d{4}-\d{2}-\d{2}$/.test(lb),lb);
  await p.evaluate(()=>{S=fresh();save();render()});
  ok('estado vaciado antes de restaurar',await p.evaluate(()=>S.courses.length===0));
  await onboard();
  await p.setInputFiles('input[onchange="importData(this)"]',bkPath);await confirmOk();await p.waitForTimeout(400);
  const rs=await p.evaluate(()=>({c:S.courses.length,e:S.events.length,d:S.wellbeing.diary.length,t:S.tasks.length}));
  ok('restaurar respaldo recupera todo',rs.c===4&&rs.e===nEv&&rs.d>0&&rs.t>0,JSON.stringify(rs));
  const antiguo=JSON.parse(JSON.stringify(bj));antiguo.ratings=[{id:'r1',course:'Cálculo III',load:5,diff:5,evalType:'certamenes',hours:12}];
  fs.writeFileSync(tmp+'/antiguo.json',JSON.stringify(antiguo));
  await p.setInputFiles('input[onchange="importData(this)"]',tmp+'/antiguo.json');await confirmOk();await p.waitForTimeout(400);
  const oldRs=await p.evaluate(()=>({c:S.courses.length,e:S.events.length,r:('ratings' in S)}));
  ok('respaldo antiguo con aportes se restaura ignorando ratings',oldRs.c===4&&oldRs.e===nEv&&!oldRs.r,JSON.stringify(oldRs));

  // --- seguridad al importar ---
  const evil=JSON.parse(JSON.stringify(bj));evil.courses[0].color='#fff" onmouseover="window.__pwn=1';
  fs.writeFileSync(tmp+'/malo1.json',JSON.stringify(evil));
  await p.setInputFiles('input[onchange="importData(this)"]',tmp+'/malo1.json');await p.waitForTimeout(300);
  ok('rechaza respaldo con color malicioso y conserva los datos',await p.evaluate(()=>S.courses.length===4&&S.courses[0].color.startsWith('#')&&S.courses[0].color.length===7));
  const evil2=JSON.parse(JSON.stringify(bj));evil2.courses[0].name='<img src=x onerror="window.__pwn=1">';evil2.adapt={n:'<img src=x onerror="window.__pwn=1">',date:'2099-01-01'};
  fs.writeFileSync(tmp+'/malo2.json',JSON.stringify(evil2));
  await p.setInputFiles('input[onchange="importData(this)"]',tmp+'/malo2.json');await confirmOk();await p.waitForTimeout(400);
  await open('Planificación','Hoy');await open('Académico','Mis ramos y horario');await p.waitForTimeout(300);
  ok('nombres con HTML se muestran como texto (sin ejecutar nada)',await p.evaluate(()=>!window.__pwn&&!document.querySelector('#app img')&&S.adapt===null));
  fs.writeFileSync(tmp+'/malo3.json','{"hola":1}');
  await open('Ajustes','Privacidad');
  await p.setInputFiles('input[onchange="importData(this)"]',tmp+'/malo3.json');
  await p.waitForTimeout(300);
  ok('rechaza archivos que no son respaldos y conserva los datos',await p.evaluate(()=>S.courses.length===4&&/no parece un respaldo/.test(document.querySelector('#toast').textContent)));

  // --- recordatorio de respaldo ---
  await p.evaluate(()=>{S.lastBackup=addDays(today(),-20);S.backupSnooze=null;save();go('hoy')});
  ok('recordatorio de respaldo aparece tras 14+ días',(await p.textContent('#app')).includes('Hace 20 días que no guardas un respaldo'));
  await p.click('text=Recordármelo en una semana');
  ok('posponer oculta el recordatorio',!(await p.textContent('#app')).includes('no guardas un respaldo'));

  // --- lectura de PDF con el lector incluido ---
  const pp=await ctx.newPage();
  await pp.setContent('<html><body style="font:16px sans-serif"><p>Calendario de evaluaciones</p><p>Certamen 1: 12 de noviembre</p><p>Entrega informe 20/12/2026</p><p>Control 2 - 5-12-2026</p></body></html>');
  fs.writeFileSync(tmp+'/syllabus.pdf',await pp.pdf({format:'A4'}));await pp.close();
  await open('Académico','Syllabus y fechas');
  await p.setInputFiles('input[type=file][accept*=".pdf"]',tmp+'/syllabus.pdf');
  await p.waitForFunction(()=>sylText&&sylText.length>20,null,{timeout:15000}).catch(()=>{});
  await p.evaluate(()=>{sylCourse=S.courses[0].id;analyze()});
  const pend=await p.evaluate(()=>pending.map(x=>x.date+'|'+x.type));
  ok('PDF: se leen las fechas con el lector incluido',pend.length>=3&&pend.some(x=>x.includes('-11-12')),pend.join(' ; '));

  ok('sin peticiones a servidores externos',ext.length===0,ext.join(', '));
  ok('sin errores de JavaScript',errs.length===0,errs.join(' || '));
  console.log(res.join('\n'));
  process.exitCode=res.some(r=>r.startsWith('FALLA'))?1:0;
  await b.close();
})().catch(e=>{console.error('ERROR DEL TEST',e);process.exit(1)});
