/* U.A.R.V.I.S. · Arvis pregunta: trivia generada desde tus diapositivas (PPTX o PDF).
   Todo ocurre en este dispositivo: el archivo no se sube a ningún servidor y solo se guardan las preguntas.
   Generador local por reglas (igual que el resto de la IA simulada de Uarvis).
   TODO (licencia): permitir un modelo de lenguaje vía Supabase Edge Function, con consentimiento explícito. */
const QZ_MAX_FILE=50*1024*1024,QZ_MAX_ENTRY=8*1024*1024,QZ_MAX_SLIDES=300;
const QZ_TIME={opcion:20,vf:12};
let qzFile=null,qzBusy=false,qzMsg='',qzCount='10',qzCourse='',qzGame=null,qzTimer=null;

/* ---------- Lector ZIP mínimo (PPTX es un ZIP con XML) ---------- */
async function qzInflate(bytes){
  if(typeof DecompressionStream!=='function')throw new Error('Este navegador no puede abrir archivos .pptx. Exporta la presentación como PDF.');
  const ds=new DecompressionStream('deflate-raw');
  const out=new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
function qzZipEntries(buf){
  const dv=new DataView(buf),u8=new Uint8Array(buf);
  let eocd=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('El archivo no parece ser un .pptx válido.');
  const n=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);
  const dec=new TextDecoder(),map={};
  for(let k=0;k<n&&p+46<=buf.byteLength;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),comp=dv.getUint32(p+20,true),size=dv.getUint32(p+24,true);
    const nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=dec.decode(u8.subarray(p+46,p+46+nl));
    map[name]={method,comp,size,off};
    p+=46+nl+xl+cl;
  }
  return {
    has:name=>!!map[name],
    names:()=>Object.keys(map),
    async text(name){
      const e=map[name];if(!e)return null;
      if(e.size>QZ_MAX_ENTRY)throw new Error('Una diapositiva es demasiado grande para leerla.');
      const lh=e.off;if(dv.getUint32(lh,true)!==0x04034b50)throw new Error('El archivo .pptx está dañado.');
      const start=lh+30+dv.getUint16(lh+26,true)+dv.getUint16(lh+28,true);
      const raw=u8.subarray(start,start+e.comp);
      const data=e.method===0?raw:e.method===8?await qzInflate(raw):null;
      if(!data)throw new Error('El archivo .pptx usa una compresión no compatible.');
      return dec.decode(data);
    }
  };
}
const qzXml=s=>new DOMParser().parseFromString(s,'application/xml');
const qzTags=(el,tag)=>Array.from(el.getElementsByTagNameNS('*',tag));
const qzClean=s=>String(s||'').replace(/[\u0000-\u001f]+/g,' ').replace(/^[\s\-–—•·*▪►✓→]+/,'').replace(/\s+/g,' ').trim();

async function pptxSlides(file){
  const zip=qzZipEntries(await file.arrayBuffer());
  let order=[];
  const pres=await zip.text('ppt/presentation.xml'),rels=await zip.text('ppt/_rels/presentation.xml.rels');
  if(pres&&rels){
    const target={};
    qzTags(qzXml(rels),'Relationship').forEach(r=>{target[r.getAttribute('Id')]=r.getAttribute('Target')});
    order=qzTags(qzXml(pres),'sldId').map(s=>{
      const id=s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      const t=target[id]||'';return t?'ppt/'+t.replace(/^\/?(ppt\/)?/,''):'';
    }).filter(x=>x&&zip.has(x));
  }
  if(!order.length)order=zip.names().filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a,b)=>+a.match(/(\d+)\.xml$/)[1]-+b.match(/(\d+)\.xml$/)[1]);
  const slides=[];
  for(const name of order.slice(0,QZ_MAX_SLIDES)){
    const doc=qzXml(await zip.text(name)||'');
    let title='';const lines=[];
    qzTags(doc,'sp').forEach(sp=>{
      const ph=qzTags(sp,'ph')[0],type=ph?ph.getAttribute('type')||'':'';
      const paras=qzTags(sp,'p').filter(p=>p.namespaceURI&&/drawingml/.test(p.namespaceURI))
        .map(p=>qzClean(qzTags(p,'t').map(t=>t.textContent).join(''))).filter(Boolean);
      if(!paras.length)return;
      if((type==='title'||type==='ctrTitle')&&!title)title=paras.join(' ');
      else if(type!=='sldNum'&&type!=='dt'&&type!=='ftr')lines.push(...paras);
    });
    qzTags(doc,'tc').forEach(tc=>{const t=qzClean(qzTags(tc,'t').map(x=>x.textContent).join(' '));if(t)lines.push(t)});
    slides.push({n:slides.length+1,title:qzClean(title),lines});
  }
  return slides;
}
async function pdfSlides(file){
  await loadPdfJs();
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,slides=[];
  for(let p=1;p<=Math.min(pdf.numPages,QZ_MAX_SLIDES);p++){
    const tc=await (await pdf.getPage(p)).getTextContent();
    const rows=[];
    for(const it of tc.items){
      if(!it.str||!it.str.trim())continue;
      const y=Math.round(it.transform[5]),h=Math.abs(it.transform[3])||Math.abs(it.height)||0;
      let r=rows.find(r=>Math.abs(r.y-y)<=3);
      if(!r){r={y,h:0,parts:[]};rows.push(r)}
      r.parts.push({x:it.transform[4],s:it.str});r.h=Math.max(r.h,h);
    }
    rows.sort((a,b)=>b.y-a.y);
    const lines=rows.map(r=>({h:r.h,t:qzClean(r.parts.sort((a,b)=>a.x-b.x).map(x=>x.s).join(' '))}))
      .filter(l=>l.t&&!/^\d{1,3}$/.test(l.t));
    if(!lines.length){slides.push({n:p,title:'',lines:[]});continue}
    const hs=lines.map(l=>l.h).sort((a,b)=>a-b),med=hs[Math.floor(hs.length/2)]||0;
    let ti=lines.findIndex(l=>l.h>=Math.max(...hs)&&l.h>med*1.15&&l.t.length<=90);
    if(ti<0)ti=lines[0].t.length<=90?0:-1;
    slides.push({n:p,title:ti>=0?lines[ti].t:'',lines:lines.filter((_,i)=>i!==ti).map(l=>l.t)});
  }
  return slides;
}

/* ---------- Generador local de preguntas ---------- */
const QZ_STOP=new Set('para como entre sobre desde hasta donde cuando porque aunque mientras tambien también puede pueden deben debe tiene tienen hacer cada todos todas otros otras otro otra este esta estos estas ellos ellas mucho muchos mayor menor según segun durante través traves mediante partir siempre nunca entonces luego además ademas solo sólo cual cuales cuál cuáles parte forma tipo tipos ejemplo ejemplos general importante slide diapositiva página pagina'.split(' '));
const qzNorm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
function qzShuffle(a,rnd=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function qzPickOthers(pool,exclude,n,rnd){
  const seen=new Set(exclude.map(qzNorm)),out=[];
  for(const x of qzShuffle(pool,rnd)){const k=qzNorm(x);if(!k||seen.has(k))continue;seen.add(k);out.push(x);if(out.length>=n)break}
  return out;
}
function qzMake(q,correct,others,slide,kind,rnd){
  const opts=qzShuffle([correct,...others],rnd).map(o=>String(o).slice(0,300));
  return {q:String(q).slice(0,300),opts,ok:opts.indexOf(String(correct).slice(0,300)),slide,kind};
}
function quizFromSlides(slides,cantidad=10,rnd=Math.random){
  const S2=(slides||[]).map(s=>{
    let title=qzClean(s.title),lines=(s.lines||[]).map(qzClean).filter(l=>l.length>=4&&l.length<=300);
    if(!title&&lines.length&&lines[0].length<=80){title=lines[0];lines=lines.slice(1)}
    return {n:s.n,title:title.slice(0,120),lines};
  }).filter(s=>s.title||s.lines.length);
  const defs=[],stmts=[],freq={};
  S2.forEach(s=>s.lines.forEach(l=>{
    let m=l.match(/^([^:]{2,60}?)\s*[:–—]\s+(.{8,})$/)||l.match(/^([^:]{2,60}?)\s+-\s+(.{8,})$/);
    let verbo='es';
    if(!m){const d=l.match(/^(.{2,60}?)\s+(es|son|se define como|se refiere a|corresponde a|consiste en)\s+(.{8,})$/i);if(d){m=[d[0],d[1],d[3]];verbo=/^son$/i.test(d[2])?'son':'es'}}
    if(m&&m[1].split(' ').length<=7)defs.push({term:m[1].trim(),def:m[2].trim().replace(/\.$/,''),verbo,slide:s.n});
    const words=l.split(' ');
    if(words.length>=5&&l.length>=25&&l.length<=220)stmts.push({t:l,slide:s.n,title:s.title});
    words.forEach(w=>{const k=w.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü]/g,'');if(k.length>=6&&!QZ_STOP.has(qzNorm(k)))freq[k]=(freq[k]||0)+1});
  }));
  const titles=[...new Map(S2.filter(s=>s.title&&s.title.length<=90).map(s=>[qzNorm(s.title),s.title])).values()];
  const keywords=Object.keys(freq);
  const defTexts=defs.map(d=>d.def),terms=defs.map(d=>d.term);
  const fillers=stmts.map(s=>s.t);
  const byType={def:[],inv:[],tema:[],completar:[],vf:[]};
  defs.forEach((d,i)=>{
    const oth=qzPickOthers(defTexts.filter((_,j)=>j!==i),[d.def],3,rnd);
    if(oth.length<3)oth.push(...qzPickOthers(fillers,[d.def,...oth],3-oth.length,rnd));
    if(oth.length===3)byType.def.push(qzMake(`¿Qué ${d.verbo} «${d.term}»?`,d.def,oth,d.slide,'definicion',rnd));
    const ot=qzPickOthers(terms.filter((_,j)=>j!==i),[d.term],3,rnd);
    if(ot.length<3)ot.push(...qzPickOthers(titles.concat(keywords),[d.term,...ot],3-ot.length,rnd));
    if(ot.length===3)byType.inv.push(qzMake(`¿A qué concepto corresponde: «${d.def}»?`,d.term,ot,d.slide,'concepto',rnd));
    if(defs.length>=2){
      const falso=rnd()<0.5,otro=defs[(i+1+Math.floor(rnd()*(defs.length-1)))%defs.length];
      const enunciado=`${d.term} ${d.verbo} ${falso?otro.def:d.def}`;
      if(!falso||qzNorm(otro.def)!==qzNorm(d.def))byType.vf.push({q:`Verdadero o falso: «${enunciado}».`.slice(0,300),opts:['Verdadero','Falso'],ok:falso?1:0,slide:d.slide,kind:'vf'});
    }
  });
  if(titles.length>=4)stmts.forEach(s=>{
    if(!s.title||qzNorm(s.t).includes(qzNorm(s.title)))return;
    const oth=qzPickOthers(titles,[s.title],3,rnd);
    if(oth.length===3)byType.tema.push(qzMake(`¿En qué tema de la presentación aparece esta idea? «${s.t}»`,s.title,oth,s.slide,'tema',rnd));
  });
  stmts.forEach(s=>{
    const cands=s.t.split(' ').map(w=>w.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü]/g,'')).filter(w=>freq[w]&&w.length>=6);
    if(!cands.length)return;
    const kw=cands.sort((a,b)=>b.length-a.length)[0];
    const inLine=new Set(s.t.split(' ').map(qzNorm));
    const oth=qzPickOthers(keywords.filter(k=>!inLine.has(qzNorm(k))&&Math.abs(k.length-kw.length)<=5),[kw],3,rnd);
    if(oth.length===3)byType.completar.push(qzMake(`Completa: «${s.t.replace(kw,'____')}»`,kw,oth,s.slide,'completar',rnd));
  });
  const seen=new Set(),out=[],colas=Object.values(byType).map(c=>qzShuffle(c,rnd)).filter(c=>c.length);
  const want=clamp(Math.round(+cantidad)||10,1,30);
  while(out.length<want&&colas.some(c=>c.length)){
    for(const c of colas){
      if(out.length>=want)break;
      while(c.length){const q=c.shift(),k=qzNorm(q.q);if(seen.has(k)||q.ok<0)continue;seen.add(k);out.push(q);break}
    }
  }
  return {preguntas:out,diapositivas:S2.length,conTexto:S2.filter(s=>s.lines.length).length};
}

/* ---------- Guardado ---------- */
const qzCfg=()=>{if(!S.tools.quiz)S.tools.quiz=freshQuiz();return S.tools.quiz};
async function qzRead(file){
  const head=new Uint8Array(await file.slice(0,8).arrayBuffer());
  const isZip=head[0]===0x50&&head[1]===0x4b,isPdf=head[0]===0x25&&head[1]===0x50&&head[2]===0x44&&head[3]===0x46;
  const isOle=head[0]===0xd0&&head[1]===0xcf&&head[2]===0x11&&head[3]===0xe0;
  if(isOle||/\.ppt$/i.test(file.name))throw new Error('Ese es el formato antiguo .ppt. Ábrelo en PowerPoint y guárdalo como .pptx o PDF.');
  if(isPdf)return {tipo:'pdf',slides:await pdfSlides(file)};
  if(isZip)return {tipo:'pptx',slides:await pptxSlides(file)};
  throw new Error('Sube una presentación .pptx o un PDF.');
}
function qzOnFile(inp){
  const f=inp&&inp.files&&inp.files[0];qzMsg='';
  if(!f){qzFile=null;return render()}
  if(f.size>QZ_MAX_FILE){qzFile=null;inp.value='';toast('El archivo pesa más de 50 MB.');return render()}
  qzFile=f;render();
}
async function createQuiz(){
  if(qzBusy)return;
  if(!qzFile)return toast('Primero elige una presentación (.pptx o PDF).');
  const Q=qzCfg();
  if(Q.sets.length>=QUIZ_MAX_SETS)return toast(`Puedes guardar hasta ${QUIZ_MAX_SETS} trivias. Borra alguna para crear otra.`);
  qzBusy=true;qzMsg='';render();
  try{
    const {tipo,slides}=await qzRead(qzFile);
    const r=quizFromSlides(slides,+qzCount);
    qzBusy=false;
    if(r.preguntas.length<3){
      qzMsg=r.conTexto?'Encontré muy poco texto para armar preguntas. Funciona mejor con diapositivas que tengan títulos, viñetas y definiciones (por ejemplo «Concepto: explicación»).'
        :'No encontré texto en el archivo. Si las diapositivas son imágenes o escaneos, no se pueden leer.';
      return render();
    }
    const set={id:uid(),name:qzFile.name.replace(/\.(pptx|pdf)$/i,'').slice(0,80)||'Presentación',courseId:qzCourse&&course(qzCourse)?qzCourse:'',
      tipo,createdAt:today(),best:0,plays:0,questions:r.preguntas};
    Q.sets.unshift(set);save();
    qzFile=null;
    toast(`Trivia lista: ${r.preguntas.length} preguntas de ${r.diapositivas} diapositivas.`);
    startQuiz(set.id);
  }catch(e){qzBusy=false;qzMsg='No se pudo leer el archivo. '+(e&&e.message||'');render()}
}
async function delQuiz(id){
  const Q=qzCfg(),s=Q.sets.find(x=>x.id===id);if(!s)return;
  if(!await askConfirm({title:'Borrar trivia',text:`¿Borrar "${s.name}"?`,okLabel:'Borrar',danger:true}))return;
  Q.sets=Q.sets.filter(x=>x.id!==id);save();render();
}

/* ---------- Juego ---------- */
function qzStopTimer(){if(qzTimer){clearInterval(qzTimer);qzTimer=null}}
function startQuiz(id){
  const s=qzCfg().sets.find(x=>x.id===id);if(!s)return;
  qzStopTimer();
  qzGame={id,order:qzShuffle(s.questions.map((_,i)=>i)),i:0,score:0,streak:0,bestStreak:0,answers:[],picked:null,phase:'play',deadline:0};
  qzNext(true);
}
function qzLimit(q){return (q.kind==='vf'?QZ_TIME.vf:QZ_TIME.opcion)*1000}
function qzCurrent(){const s=qzGame&&qzCfg().sets.find(x=>x.id===qzGame.id);return s?s.questions[qzGame.order[qzGame.i]]:null}
function qzNext(first){
  if(!qzGame)return;
  if(!first)qzGame.i++;
  qzStopTimer();
  if(qzGame.i>=qzGame.order.length)return qzFinish();
  qzGame.phase='play';qzGame.picked=null;
  qzGame.deadline=Date.now()+qzLimit(qzCurrent());
  render();
  qzTimer=setInterval(qzTick,250);
}
function qzTick(){
  if(!qzGame||qzGame.phase!=='play')return qzStopTimer();
  const left=qzGame.deadline-Date.now(),q=qzCurrent();
  const bar=$('#qz-bar'),txt=$('#qz-secs');
  if(bar&&q)bar.style.width=Math.max(0,left/qzLimit(q)*100)+'%';
  if(txt)txt.textContent=Math.max(0,Math.ceil(left/1000))+' s';
  if(left<=0)qzAnswer(-1);
}
function qzAnswer(idx){
  if(!qzGame||qzGame.phase!=='play')return;
  qzStopTimer();
  const q=qzCurrent(),left=Math.max(0,qzGame.deadline-Date.now()),ok=idx===q.ok;
  let pts=0;
  if(ok){qzGame.streak++;qzGame.bestStreak=Math.max(qzGame.bestStreak,qzGame.streak);pts=100+Math.round(left/1000)*5+(qzGame.streak>=3?20:0)}
  else qzGame.streak=0;
  qzGame.score+=pts;qzGame.picked=idx;qzGame.phase='feedback';
  qzGame.answers.push({qi:qzGame.order[qzGame.i],ok,pts,timeout:idx<0});
  render();
  const nb=$('#qz-next');if(nb)nb.focus();
}
function qzFinish(){
  qzStopTimer();
  const s=qzCfg().sets.find(x=>x.id===qzGame.id);
  qzGame.phase='end';
  if(s){s.plays=Math.min(1000000,(s.plays||0)+1);qzGame.record=qzGame.score>(s.best||0);s.best=Math.max(s.best||0,qzGame.score);save()}
  if(typeof logrosRevisar==='function')logrosRevisar('quiz');
  render();
}
function quitQuiz(){qzStopTimer();qzGame=null;render()}
function qzWrongToFlashcards(){
  const s=qzGame&&qzCfg().sets.find(x=>x.id===qzGame.id);if(!s)return;
  const wrong=qzGame.answers.filter(a=>!a.ok).map(a=>s.questions[a.qi]);
  if(!wrong.length)return toast('No tuviste errores. ¡Nada que repasar!');
  const F=fcCfg();
  if(!S.tools.flashcards)S.tools.flashcards=F;
  let deck=F.decks.find(d=>d.name===`Arvis pregunta · ${s.name}`.slice(0,80));
  if(!deck){deck={id:uid(),name:`Arvis pregunta · ${s.name}`.slice(0,80),courseId:s.courseId||'',cards:[]};F.decks.push(deck)}
  let n=0;
  wrong.forEach(q=>{
    const front=q.q.slice(0,1000),back=(q.opts[q.ok]+` (diapositiva ${q.slide})`).slice(0,1000);
    if(deck.cards.some(c=>c.front===front))return;
    deck.cards.push({id:uid(),front,back,box:1,due:today()});n++;
  });
  F.activeDeckId=deck.id;save();
  toast(n?`${n} pregunta(s) pasadas al mazo "${deck.name}".`:'Esas preguntas ya estaban en tus flashcards.');
  render();
}

/* ---------- Vistas ---------- */
const qzKindLabel={definicion:'Definición',concepto:'Concepto',tema:'Tema',completar:'Completar',vf:'Verdadero o falso'};
function qzPlayHtml(){
  const s=qzCfg().sets.find(x=>x.id===qzGame.id),q=qzCurrent();
  if(!s||!q){qzGame=null;return ''}
  const total=qzGame.order.length,fb=qzGame.phase==='feedback',last=qzGame.answers[qzGame.answers.length-1];
  const opts=q.opts.map((o,i)=>{
    let cls='qz-opt';
    if(fb){if(i===q.ok)cls+=' qz-ok';else if(i===qzGame.picked)cls+=' qz-bad'}
    return `<button class="${cls}" ${fb?'disabled':''} data-focus-id="qz-opt-${i}" onclick="qzAnswer(${i})"><span class="qz-letter" aria-hidden="true">${'ABCD'[i]}</span><span>${esc(o)}</span></button>`;
  }).join('');
  const left=Math.max(0,qzGame.deadline-Date.now());
  return `<div class="card qz-card" aria-live="polite">
    <div class="row qz-top"><b>${esc(s.name)}</b><span class="mute">Pregunta ${qzGame.i+1} de ${total}</span>
      <span class="qz-score">${qzGame.score} pts${qzGame.streak>=2?` · racha ${qzGame.streak}`:''}</span></div>
    ${fb?'':`<div class="qz-timer" aria-hidden="true"><div id="qz-bar" style="width:${left/qzLimit(q)*100}%"></div></div><p class="mute qz-secs" id="qz-secs">${Math.ceil(left/1000)} s</p>`}
    <p class="qz-kind">${qzKindLabel[q.kind]||'Pregunta'} · diapositiva ${q.slide}</p>
    <h2 class="qz-q">${esc(q.q)}</h2>
    <div class="qz-opts${q.opts.length===2?' qz-two':''}">${opts}</div>
    ${fb?`<p class="qz-feedback ${last.ok?'ok':'bad'}" role="status">${last.ok?`¡Correcto! +${last.pts} pts`:last.timeout?'Se acabó el tiempo.':'Incorrecto.'}${last.ok?'':` La respuesta era: <b>${esc(q.opts[q.ok])}</b> (diapositiva ${q.slide}).`}</p>
      <div class="row"><button class="btn" id="qz-next" data-focus-id="qz-next" onclick="qzNext()">${qzGame.i+1<total?'Siguiente':'Ver resultado'}</button>
      <button class="btn sec" onclick="quitQuiz()">Salir</button></div>`
      :`<div class="row"><button class="btn sec" onclick="quitQuiz()">Salir</button></div>`}
  </div>`;
}
function qzEndHtml(){
  const s=qzCfg().sets.find(x=>x.id===qzGame.id);if(!s){qzGame=null;return ''}
  const ok=qzGame.answers.filter(a=>a.ok).length,total=qzGame.answers.length,pct=total?Math.round(ok/total*100):0;
  const wrong=qzGame.answers.filter(a=>!a.ok).map(a=>s.questions[a.qi]);
  const msg=pct>=80?'¡Dominas esta presentación!':pct>=50?'Vas bien. Repasa las que fallaste y vuelve a jugar.':'Buen comienzo: repasa esas diapositivas y vuelve a intentarlo.';
  return `<div class="card qz-card">
    <h2>Resultado</h2>
    ${arvis(pct>=80?'celebrando':pct>=50?'normal':'estudiando',msg,{pequeno:true,id:'arvis-qz'})||`<p>${esc(msg)}</p>`}
    <p class="qz-final"><b>${qzGame.score} pts</b> · ${ok} de ${total} correctas (${pct} %) · mejor racha ${qzGame.bestStreak}</p>
    ${qzGame.record&&s.plays>1?'<p class="qz-feedback ok">¡Nuevo récord en esta trivia!</p>':''}
    ${wrong.length?`<h3>Para repasar</h3><ul class="qz-wrong">${wrong.map(q=>`<li>${esc(q.q)}<br><span class="mute">Respuesta: <b>${esc(q.opts[q.ok])}</b> · diapositiva ${q.slide}</span></li>`).join('')}</ul>`:''}
    <div class="row">
      <button class="btn" data-focus-id="qz-again" onclick="startQuiz('${s.id}')">Jugar de nuevo</button>
      ${wrong.length?`<button class="btn sec" data-focus-id="qz-to-fc" onclick="qzWrongToFlashcards()">Pasar falladas a flashcards</button>`:''}
      <button class="btn sec" onclick="quitQuiz()">Volver</button>
    </div></div>`;
}
function viewPregunta(){
  if(qzGame&&qzGame.phase!=='end'&&!qzCurrent())qzGame=null;
  if(qzGame)return `${screenHelp('pregunta')}${qzGame.phase==='end'?qzEndHtml():qzPlayHtml()}`;
  qzStopTimer();
  const Q=qzCfg();
  const courses=S.courses.map(c=>`<option value="${c.id}" ${qzCourse===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  return `${screenHelp('pregunta')}<div class="grid">
    <div class="card"><h2>Arvis pregunta</h2>
      <p class="mute" style="margin-top:0">Sube las diapositivas de una clase y Arvis arma una trivia con preguntas de alternativas y tiempo límite. El archivo se lee en este dispositivo: no se sube a ningún servidor.</p>
      <div class="row form-stack" style="margin-top:10px">
        <span class="diff-field"><label for="qz-file">Presentación (.pptx o PDF)</label>
          <input id="qz-file" type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onchange="qzOnFile(this)" ${qzBusy?'disabled':''}></span>
        ${S.courses.length?`<span class="diff-field"><label for="qz-course">Ramo (opcional)</label>
          <select id="qz-course" onchange="qzCourse=this.value"><option value="">Sin ramo</option>${courses}</select></span>`:''}
        <span class="diff-field"><label for="qz-count">Preguntas</label>
          <select id="qz-count" onchange="qzCount=this.value">${['5','10','15','20'].map(n=>`<option ${qzCount===n?'selected':''}>${n}</option>`).join('')}</select></span>
      </div>
      ${qzFile?`<p class="mute">Archivo: <b>${esc(qzFile.name)}</b></p>`:''}
      <div class="row" style="margin-top:8px"><button class="btn" data-focus-id="qz-create" onclick="createQuiz()" ${qzBusy?'disabled':''}>${qzBusy?'Leyendo diapositivas…':'Crear trivia'}</button></div>
      ${qzMsg?`<p class="qz-feedback bad" role="alert">${esc(qzMsg)}</p>`:''}
      <p class="mute">Las preguntas se arman con reglas a partir del texto de las diapositivas: revisa que tengan sentido. Funciona mejor con títulos, viñetas y definiciones. Las diapositivas que son solo imágenes no se pueden leer.</p>
    </div>
    <div class="card"><h2>Tus trivias</h2>
      ${Q.sets.length?Q.sets.map(s=>`<div class="task"><span style="flex:1"><b>${esc(s.name)}</b>${s.courseId&&course(s.courseId)?` · ${esc(cname(s.courseId))}`:''}<br>
        <span class="mute">${s.questions.length} preguntas · ${s.tipo==='pdf'?'PDF':'PPTX'} · ${s.plays?`récord ${s.best} pts`:'sin jugar'}</span></span>
        <button class="btn" data-focus-id="qz-play-${s.id}" onclick="startQuiz('${s.id}')">Jugar</button>
        <button class="btn del" aria-label="Borrar trivia ${esc(s.name)}" onclick="delQuiz('${s.id}')">Borrar</button></div>`).join('')
        :'<p class="mute">Aún no tienes trivias. Sube las diapositivas de tu próxima clase o certamen.</p>'}
    </div>
  </div>`;
}
