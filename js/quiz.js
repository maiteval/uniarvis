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
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,rows=[],total=Math.min(pdf.numPages,QZ_MAX_SLIDES);
  for(let p=1;p<=total;p++){
    const tc=await (await pdf.getPage(p)).getTextContent(),pr=[];
    for(const it of tc.items){
      if(!it.str||!it.str.trim())continue;
      const y=Math.round(it.transform[5]),h=Math.abs(it.transform[3])||Math.abs(it.height)||0;
      let r=pr.find(r=>Math.abs(r.y-y)<=3);
      if(!r){r={y,h:0,parts:[]};pr.push(r)}
      r.parts.push({x:it.transform[4],s:it.str});r.h=Math.max(r.h,h);
    }
    pr.sort((a,b)=>b.y-a.y).forEach(r=>{const t=qzClean(r.parts.sort((a,b)=>a.x-b.x).map(x=>x.s).join(' '));if(t)rows.push({page:p,h:Math.round(r.h*10)/10,t})});
  }
  // Tamaño de letra del cuerpo: el más frecuente entre líneas con texto real.
  const cnt={};rows.filter(r=>r.t.length>25).forEach(r=>{cnt[r.h]=(cnt[r.h]||0)+1});
  const body=+Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||0;
  // Encabezados o pies que se repiten en varias páginas.
  const pagesBy={};rows.forEach(r=>{const k=qzNorm(r.t);(pagesBy[k]=pagesBy[k]||new Set()).add(r.page)});
  const repetida=r=>total>=3&&pagesBy[qzNorm(r.t)].size>=Math.max(3,Math.ceil(total*0.3));
  const sizes=[...new Set(rows.filter(r=>body&&r.h>=body+0.8).map(r=>r.h))].sort((a,b)=>b-a);
  const hayPartes=rows.some(r=>r.h>=body+0.8&&/^parte\b/i.test(r.t));
  const sections=[];let cur=null,modo=hayPartes?'portada':'teoria',padre='',padreH=0;
  rows.forEach(r=>{
    if(repetida(r)||/^\d{1,3}$/.test(r.t)||/(\.\s?){4,}/.test(r.t))return;
    const esTitulo=body&&r.h>=body+0.8&&r.t.length<=100&&/[A-Za-zÁÉÍÓÚáéíóúÑñ]{3}/.test(r.t)&&!/[,;]$/.test(r.t);
    if(esTitulo){
      const titulo=r.t.replace(/^(\d+(\.\d+)*\.?|[IVX]+[.)])\s+/,'').trim();
      if(/^parte\b/i.test(r.t)){modo=/ejercicio|problema|aplicaci|pr[aá]ctica|resuelto/i.test(r.t)?'ejercicios':'teoria';padre='';padreH=0}
      else if(!padreH||r.h>=padreH){padre=titulo;padreH=r.h}
      cur={n:r.page,title:titulo,parent:padre!==titulo?padre:'',lines:[],ejercicio:modo!=='teoria'};
      sections.push(cur);return;
    }
    if(!cur){cur={n:r.page,title:'',lines:[],ejercicio:modo!=='teoria'};sections.push(cur)}
    cur.lines.push(r.t);
  });
  return sections.filter(s=>s.lines.length||s.title);
}

/* ---------- Generador local de preguntas (centrado en conceptos y teoría) ---------- */
const QZ_STOP=new Set('para como entre sobre desde hasta donde cuando porque aunque mientras tambien puede pueden deben debe tiene tienen hacer cada todos todas otros otras otro otra este esta estos estas ellos ellas mucho muchos mayor menor segun durante traves mediante partir siempre nunca entonces luego ademas solo cual cuales parte forma tipo tipos ejemplo ejemplos general importante slide diapositiva pagina valor valores caso casos'.split(' '));
const QZ_EXERCISE_TITLE=/^(ejercicios?|ejemplos?|problemas?|soluci[oó]n(es)?|desarrollo|resoluci[oó]n|actividad(es)?|taller|ayudant[ií]a|preguntas?|control|pauta|aplicaci[oó]n(es)?|casos?|ejercitaci[oó]n|pr[aá]ctica|tarea|gu[ií]a|resumen de ejercicios)\b/i;
const QZ_GENERIC_TITLE=/^(introducci[oó]n|resumen|contenidos?|objetivos?|agenda|temario|bibliograf[ií]a|referencias|preguntas|dudas|gracias|fin|índice|indice|clase \d+|semana \d+|unidad \d+|gu[ií]a r[aá]pida.*|formulario.*|resumen de f[oó]rmulas.*|tabla de f[oó]rmulas.*|errores? (t[ií]picos?|comunes|frecuentes).*)$/i;
const QZ_EXERCISE_LINE=/\b(ejercicios?|ejemplos?|problemas?|calcul[ae]|calcular|determin[ae]|encuentr[ae]|resuelv[ae]|obteng[ae]|consider[ae]|supong[ae]|se toma|se tiene|se tienen|se sabe que|se registr|datos?\s*:|soluci[oó]n|respuesta|pregunta|ppt|diapositiva|slide|l[aá]mina|figura|gr[aá]fico|tabla|anterior|siguiente|a continuaci[oó]n|como se ve|en la imagen|desarrolle|demuestre|justifique|complete|listado|ej\.|certamen|evaluaci[oó]n|profesor|ayudante|te preguntan|te piden|enunciado|caso \([a-z]\)|\([a-d]\))/i;
const QZ_IMPERATIVE=/^(usa|use|ajusta|ajuste|f[ií]jate|recuerda|aplica|revisa|calcula|toma|elige|anota|escribe|considera|mira|redondea|verifica|compara|plantea|define|decide|interpreta|busca|identifica)\b/i;
const QZ_PRONOUN_START=/^(esto|esta|este|estos|estas|eso|esa|ese|ello|lo|le|les|se|no|y|o|pero|entonces|luego|así|asi|por eso|por lo tanto|además|ademas)\b/i;
const QZ_BAD_TERM_START=/^(si|cada|todo|toda|todos|todas|nunca|siempre|también|tambien|solo|sólo|casi|primero|luego|después|despues|para|con|sin|en|de|del|al|por|cuando|donde|aunque)\b/i;
const QZ_WARNING=/^(errores?\s+(t[ií]picos?|comunes|frecuentes)|ojo|cuidado|no hacer|qu[eé] no hacer|trampas?)\b/i;
const qzNorm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
const qzCap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const QZ_SHORT_OK=new Set('a y o e u de la el en un se es no lo al si su ni le me te mi tu ya ha he va da'.split(' '));
const QZ_GENERIC_TERM=/^(etapa|paso|fase|caso|parte|regla|nota|excepci[oó]n|notaci[oó]n|atajo|ojo|error com[uú]n|errores comunes|cuidado|tip|truco|resumen|idea|intuici[oó]n|recordatorio|importante|clave|f[oó]rmula|ejemplo|observaci[oó]n|interpretaci[oó]n|conclusi[oó]n|respuesta|dato|datos|paso a paso|procedimiento|m[eé]todo|objetivo|hip[oó]tesis|resultado|soluci[oó]n|pregunta|tabla|figura|elementos|supuestos|definiciones|conceptos|propiedades|caracter[ií]sticas|ventajas|desventajas|repaso|gu[ií]a r[aá]pida|universidad.*|facultad.*|departamento.*|evaluaci[oó]n|certamen|control|listado|clase|una poblaci[oó]n|dos poblaciones)(\s+\d+|\s+[ivx]+)?$/i;
// Une subíndices separados por el PDF («H 0» → «H0») y ordena espacios alrededor de signos.
const qzTidy=s=>String(s).replace(/([a-záéíóúñ])-\s+([a-záéíóúñ])/g,'$1$2').replace(/\b([A-Za-z])\s(\d)\b/g,'$1$2').replace(/\s+([,.;:)\]])/g,'$1').replace(/([(\[¿¡])\s+/g,'$1').replace(/\s+/g,' ').trim();
// Detecta fórmulas o restos de ellas (muchos símbolos o «palabras» de 1–2 letras).
function qzMathy(l){
  const tok=l.split(' ').filter(Boolean);if(!tok.length)return true;
  const corto=tok.filter(w=>{const c=w.replace(/[^\wáéíóúñ]/gi,'');return c.length<=2&&!/^[A-Z]{2}$/.test(c)&&!/^[A-Z]\d$/.test(c)&&!QZ_SHORT_OK.has(c.toLowerCase())}).length/tok.length;
  const sym=(l.match(/[±×÷√∑∏∼≤≥≈≠σμαβθχλνπρτφψωΣΔ∈∉ˆ¯̸∞∫|=<>^_]/g)||[]).length;
  return corto>=0.25||sym>=3||(sym>=1&&corto>0.15)||/\s\/|\/\s|\/,/.test(l);
}
const qzDigits=s=>(String(s).match(/\d/g)||[]).length/Math.max(1,String(s).length);
function qzShuffle(a,rnd=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function qzPickOthers(pool,exclude,n,rnd){
  const seen=new Set(exclude.map(qzNorm)),out=[];
  for(const x of qzShuffle(pool,rnd)){const k=qzNorm(x);if(!k||seen.has(k)||[...seen].some(s=>s&&(s.includes(k)||k.includes(s))&&Math.min(s.length,k.length)>12))continue;seen.add(k);out.push(x);if(out.length>=n)break}
  return out;
}
function qzMake(q,correct,others,slide,kind,rnd){
  const opts=qzShuffle([correct,...others],rnd).map(o=>String(o).slice(0,300));
  return {q:String(q).slice(0,300),opts,ok:opts.indexOf(String(correct).slice(0,300)),slide,kind};
}
// Une líneas cortadas (típico en PDF): si la línea siguiente empieza en minúscula, es continuación.
function qzMergeLines(lines){
  const out=[];
  lines.forEach(l=>{
    const prev=out[out.length-1];
    if(prev&&/^[a-záéíóúñü(,;]/.test(l)&&!/[.:;!?]$/.test(prev))out[out.length-1]=prev+' '+l;
    else out.push(l);
  });
  return out;
}
const qzIsExerciseLine=l=>qzMathy(l)||QZ_EXERCISE_LINE.test(l)||/\?\s*$|^¿/.test(l)||/^[a-h][).]\s/i.test(l)||qzDigits(l)>0.08||/=\s*\d|\d\s*=/.test(l)||/^\(?\d+[).]\s/.test(l);
const qzTermOk=t=>{
  const w=t.split(/\s+/);
  return t.length>=3&&t.length<=60&&w.length<=6&&/^[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(t)&&!/["“”«»'‘’¿?]/.test(t)&&!QZ_GENERIC_TERM.test(t)&&!QZ_BAD_TERM_START.test(t)&&!(t.match(/[±×√∑∼≤≥≈≠σμαβθχλνπ=<>^]/g)||[]).length&&!QZ_EXERCISE_LINE.test(t)&&!QZ_PRONOUN_START.test(t)&&qzDigits(t)<0.15&&!/^(nota|obs|observaci[oó]n|importante|recuerda|ojo|def|definici[oó]n)$/i.test(t);
};
const qzStripArticle=t=>t.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i,'').trim();
// Reconoce definiciones con varias redacciones habituales.
function qzDefinition(l){
  let m;
  const clean=(term,def,verbo)=>{
    term=qzStripArticle(term.replace(/^(definici[oó]n( de)?|def\.?)\s*/i,'').trim());def=def.trim().replace(/\.$/,'');
    if(!qzTermOk(term)||def.split(/\s+/).length<4||def.length>260||qzIsExerciseLine(def)||/[;,:]$/.test(def)||(def.match(/\b[A-Z]{2,}\b/g)||[]).length>=3)return null;
    return {term:qzCap(term),def:qzCap(def),verbo};
  };
  if((m=l.match(/^(?:se\s+(?:llama|denomina|define(?:\s+como)?|conoce\s+como)|llamamos|denominamos|definimos)\s+(.{2,60}?)\s+(?:a|al)\s+(.{12,})$/i)))return clean(m[1],m[2],'es');
  if((m=l.match(/^(.{2,60}?)\s+(?:se\s+define\s+como|se\s+denomina|se\s+conoce\s+como|se\s+refiere\s+a|corresponde\s+a|consiste\s+en)\s+(.{12,})$/i)))return clean(m[1],m[2],'es');
  if((m=l.match(/^(.{2,60}?)\s+(establece|indica|afirma|plantea)\s+que\s+(.{12,})$/i))){const d=clean(m[1],m[3],m[2].toLowerCase());if(d)d.def=qzCap(d.def);return d}
  if((m=l.match(/^([^:]{2,60}?)\s*[:–—]\s+(.{12,})$/)))return clean(m[1],m[2],'es');
  if((m=l.match(/^(.{2,55}?)\s+(es|son)\s+((?:un|una|el|la|los|las|aquel|aquella|aquello|lo que|cada)\s+.{8,})$/i))&&/^(el|la|los|las|un|una|[A-ZÁÉÍÓÚÑ])/.test(m[1]))return clean(m[1],m[3],m[2].toLowerCase());
  return null;
}
// «Término: definición» suena natural sin tener que adivinar artículos.
const qzSentence=(term,verbo,def)=>verbo==='es'||verbo==='son'?`${term}: ${def.replace(/^./,c=>c.toLowerCase())}`:`${term} ${verbo} que ${def.replace(/^./,c=>c.toLowerCase())}`;
function qzListNoun(l){
  const m=l.match(/^(?:las|los|hay|existen|tipos de|clases de)?\s*(?:\w+\s+)?([a-záéíóúñ]{5,})(?:\s|$)/i);
  const w=(l.match(/\b(?:las|los)\s+(?:tres|dos|cuatro|cinco|distintas|distintos|diferentes)?\s*([a-záéíóúñ]{5,}s)\b/i)||[])[1];
  if(!w)return '';
  const sing=w.toLowerCase().replace(/ciones$/,'ción').replace(/siones$/,'sión').replace(/([^aeiou])es$/,'$1').replace(/s$/,'');
  return QZ_STOP.has(qzNorm(sing))?'':sing;
}
function qzQuestionFor(d){
  if(d.verbo==='establece'||d.verbo==='indica'||d.verbo==='afirma'||d.verbo==='plantea')return `¿Qué ${d.verbo} «${d.term}»?`;
  return `¿Qué ${d.verbo} «${d.term}»?`;
}
function quizFromSlides(slides,cantidad=10,rnd=Math.random){
  // 1) Normalizar diapositivas y separar teoría de ejercicios
  const S2=(slides||[]).map(s=>{
    let title=qzTidy(qzClean(s.title)),lines=qzMergeLines((s.lines||[]).map(l=>qzTidy(qzClean(l))).filter(l=>l.length>=3&&!/(\.\s?){4,}/.test(l))).map(qzTidy)
      .flatMap(l=>l.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿])/)).map(l=>l.trim()).filter(l=>l.length>=3&&l.length<=400);
    if(!title&&lines.length&&lines[0].length<=80){title=lines[0];lines=lines.slice(1)}
    const exLines=lines.filter(l=>QZ_EXERCISE_LINE.test(l)||/\?\s*$|^¿/.test(l)||/^[a-h][).]\s/i.test(l)).length;
    const ejercicio=!!s.ejercicio||QZ_EXERCISE_TITLE.test(title)||/^parte\b.*(ejercicio|resuelto|problema)/i.test(title)||QZ_GENERIC_TITLE.test(title)||(lines.length>=2&&exLines/lines.length>=0.6);
    const sinNum=t=>qzTidy(String(t||'')).replace(/^(\d+(\.\d+)*\.?|[IVX]+[.)])\s+/,'').replace(/\s*\([^)]*\)/g,'').replace(/[:\s]+$/,'').trim();
    return {n:s.n,title:sinNum(title).slice(0,120),tema:sinNum(s.parent)||sinNum(title),lines,ejercicio};
  }).filter(s=>s.title||s.lines.length);
  const teoria=S2.filter(s=>!s.ejercicio);
  // 2) Extraer definiciones y afirmaciones de teoría
  const defs=[],stmts=[];
  teoria.forEach(s=>{let ctx='',aviso=false;s.lines.forEach(l=>{
    if(QZ_WARNING.test(l)){aviso=true;return}
    if(aviso)return;
    if(/:$/.test(l)){ctx=qzListNoun(l);return}
    if(!/^[^:]{2,40}:\s/.test(l))ctx='';
    if(qzIsExerciseLine(l))return;
    const d=qzDefinition(l);
    if(d&&ctx&&d.term.split(' ').length<=2&&!qzNorm(d.term).includes(qzNorm(ctx)))d.term=qzCap(ctx)+(/^[A-ZÁÉÍÓÚÑ]/.test(d.term)&&/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(d.term)&&!/^(constante|proporcional|simple|[oó]ptima|igual)$/i.test(d.term)?' de ':' ')+(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(d.term)&&/^(constante|proporcional|simple|[oó]ptima|igual)$/i.test(d.term)?d.term.toLowerCase():d.term);
    if(d&&!defs.some(x=>qzNorm(x.term)===qzNorm(d.term))){d.slide=s.n;defs.push(d);return}
    const words=l.split(/\s+/);
    if(words.length>=8&&l.length>=30&&l.length<=220&&!/\b(la|lo|los|las)\s+(hay|es|son)\b/i.test(l)&&/^[A-ZÁÉÍÓÚÑ]/.test(l)&&!/[:;,]$/.test(l)&&!QZ_PRONOUN_START.test(l)&&!QZ_IMPERATIVE.test(l))stmts.push({t:l.replace(/\.$/,''),slide:s.n,title:s.tema});
  })});
  const titles=[...new Map(teoria.filter(s=>s.tema&&s.tema.length<=70&&!QZ_GENERIC_TITLE.test(s.tema)&&!QZ_GENERIC_TERM.test(s.tema)&&!qzIsExerciseLine(s.tema)).map(s=>[qzNorm(s.tema),s.tema])).values()];
  const concepts=[...new Map(defs.map(d=>d.term).concat(titles.filter(t=>!/\s(y|e|vs\.?|versus|o)\s|[,/&]/i.test(t)).map(t=>qzCap(qzStripArticle(t)))).map(c=>[qzNorm(c),c])).values()];
  const defTexts=defs.map(d=>d.def);
  const byType={definicion:[],concepto:[],completar:[],vf:[],tema:[]};
  // 3) Preguntas sobre definiciones
  defs.forEach((d,i)=>{
    const oth=qzPickOthers(defTexts.filter((_,j)=>j!==i),[d.def],3,rnd);
    if(oth.length<3)oth.push(...qzPickOthers(stmts.filter(s=>s.slide!==d.slide).map(s=>s.t),[d.def,...oth],3-oth.length,rnd));
    if(oth.length===3)byType.definicion.push(qzMake(qzQuestionFor(d),d.def,oth,d.slide,'definicion',rnd));
    const ot=qzPickOthers(concepts.filter(c=>qzNorm(c)!==qzNorm(d.term)&&!qzNorm(d.def).includes(qzNorm(c))),[d.term],3,rnd);
    if(ot.length===3)byType.concepto.push(qzMake(`¿Qué concepto se describe? «${d.def}»`,d.term,ot,d.slide,'concepto',rnd));
    if(defs.length>=3){
      const falso=rnd()<0.5,otros=defs.filter((_,j)=>j!==i),otro=otros[Math.floor(rnd()*otros.length)];
      const enunciado=qzSentence(d.term,d.verbo,falso?otro.def:d.def);
      byType.vf.push({q:`¿Verdadero o falso? «${enunciado}»`.slice(0,300),opts:['Verdadero','Falso'],ok:falso?1:0,slide:d.slide,kind:'vf'});
    }
  });
  // 4) Completar: se oculta un concepto (nunca una palabra cualquiera)
  const sources=stmts.map(s=>({t:s.t,slide:s.slide})).concat(defs.map(d=>({t:qzSentence(d.term,d.verbo,d.def),slide:d.slide,own:d.term})));
  sources.forEach(s=>{
    const nt=' '+qzNorm(s.t)+' ';
    const hit=concepts.filter(c=>qzNorm(c).length>=5&&nt.includes(' '+qzNorm(c)+' ')&&qzNorm(c)!==qzNorm(s.own||'')).sort((a,b)=>b.length-a.length)[0]
      ||(s.own&&qzNorm(s.own).length>=5?s.own:null);
    if(!hit)return;
    const rx=new RegExp(hit.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),m=s.t.match(rx);if(!m)return;
    const oth=qzPickOthers(concepts.filter(c=>!nt.includes(' '+qzNorm(c)+' ')),[hit],3,rnd);
    if(oth.length===3)byType.completar.push(qzMake(`Completa la idea: «${s.t.replace(rx,'_____')}»`,qzCap(m[0])===m[0]?m[0]:qzCap(hit),oth.map(qzCap),s.slide,'completar',rnd));
  });
  // 5) Tema: solo afirmaciones de teoría, sin regalar la respuesta
  if(titles.length>=4)stmts.forEach(s=>{
    if(!s.title||titles.every(t=>qzNorm(t)!==qzNorm(s.title)))return;
    const nt=qzNorm(s.t);if(titles.some(t=>nt.includes(qzNorm(t))))return;
    const oth=qzPickOthers(titles,[s.title],3,rnd);
    if(oth.length===3)byType.tema.push(qzMake(`¿De qué tema habla esta idea? «${s.t}»`,s.title,oth,s.slide,'tema',rnd));
  });
  // 6) Mezclar dando prioridad a definiciones y conceptos, sin repetir
  const seen=new Set(),out=[],usados={};
  const colas=['definicion','concepto','completar','vf','tema'].map(k=>qzShuffle(byType[k],rnd)).filter(c=>c.length);
  const want=clamp(Math.round(+cantidad)||10,1,30);
  while(out.length<want&&colas.some(c=>c.length)){
    for(const c of colas){
      if(out.length>=want)break;
      while(c.length){
        const q=c.shift(),k=qzNorm(q.q),ans=qzNorm(q.opts[q.ok])+'|'+q.kind,clave=q.kind==='vf'?qzNorm(q.q).slice(0,40):qzNorm(q.opts[q.ok]);
        if(seen.has(k)||q.ok<0||usados[ans]||(usados[clave]||0)>=2)continue;
        seen.add(k);usados[ans]=1;usados[clave]=(usados[clave]||0)+1;out.push(q);break;
      }
    }
  }
  return {preguntas:qzShuffle(out,rnd),diapositivas:S2.length,conTexto:S2.filter(s=>s.lines.length).length,
    teoria:teoria.length,ejercicios:S2.length-teoria.length,definiciones:defs.length};
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
      qzMsg=r.conTexto&&r.ejercicios>r.teoria?'Esta presentación parece ser casi solo de ejercicios. Arvis pregunta arma preguntas de conceptos y teoría: prueba con las diapositivas de la clase teórica.'
        :r.conTexto?'Encontré muy poco texto para armar preguntas. Funciona mejor con diapositivas que tengan títulos, viñetas y definiciones (por ejemplo «Concepto: explicación»).'
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

/* ---------- Juego (estilo trivia con ruleta) ---------- */
const QZ_CATS={
  definicion:{label:'Definición',color:'#3b82f6',dark:'#1e40af',icon:'📘'},
  concepto:{label:'Concepto',color:'#8b5cf6',dark:'#5b21b6',icon:'💡'},
  completar:{label:'Completar',color:'#10b981',dark:'#047857',icon:'✏️'},
  vf:{label:'Verdadero o falso',color:'#ec4899',dark:'#9d174d',icon:'⚖️'},
  tema:{label:'Tema',color:'#f59e0b',dark:'#b45309',icon:'🧭'}
};
const QZ_ORDER=['definicion','concepto','completar','vf','tema'];
const QZ_SAY={
  spin:['¡Gira la ruleta!','¿Qué categoría saldrá?','¡Vamos por otra!'],
  play:['Tú puedes.','Piensa en la definición.','Lee con calma.','Esta la vimos en clases.'],
  ok:['¡Correcto!','¡Bien ahí!','¡Eso es!','¡Vas con todo!'],
  bad:['Casi… repásala después.','Ups, esa no era.','No pasa nada, sigamos.']
};
const qzWhere=(s,n)=>`${s&&s.tipo==='pdf'?'página':'diapositiva'} ${n}`;
const qzPick=a=>a[Math.floor(Math.random()*a.length)];
const qzReduced=()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const qzSpinMs=()=>qzReduced()?0:1700;
const qzArvis=(mood,size,cls)=>typeof arvisOn==='function'&&arvisOn()?arvisFigura(mood,size,cls||''):'';
function qzStopTimer(){if(qzTimer){clearInterval(qzTimer);qzTimer=null}}
function startQuiz(id){
  const s=qzCfg().sets.find(x=>x.id===id);if(!s)return;
  qzStopTimer();
  qzGame={id,order:qzShuffle(s.questions.map((_,i)=>i)),i:0,score:0,streak:0,bestStreak:0,answers:[],picked:null,
    phase:'spin',deadline:0,rot:0,say:qzPick(QZ_SAY.spin)};
  render();
}
function qzLimit(q){return (q.kind==='vf'?QZ_TIME.vf:QZ_TIME.opcion)*1000}
function qzCurrent(){const s=qzGame&&qzCfg().sets.find(x=>x.id===qzGame.id);return s?s.questions[qzGame.order[qzGame.i]]:null}
function qzSpin(){
  if(!qzGame||qzGame.phase!=='spin')return;
  const q=qzCurrent();if(!q)return;
  const idx=Math.max(0,QZ_ORDER.indexOf(q.kind)),ms=qzSpinMs();
  const target=(360-(idx*72+36))%360,cur=((qzGame.rot%360)+360)%360;
  const to=qzGame.rot+(ms?360*4:0)+((target-cur+360)%360);
  qzGame.phase='spinning';render();
  const el=$('#qz-wheel');
  const done=()=>{if(!qzGame||qzGame.phase!=='spinning')return;qzGame.rot=to;qzReveal()};
  if(!ms||!el)return done();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transform=`rotate(${to}deg)`}));
  setTimeout(done,ms+250);
}
function qzReveal(){
  qzGame.phase='play';qzGame.picked=null;qzGame.say=qzPick(QZ_SAY.play);
  qzGame.deadline=Date.now()+qzLimit(qzCurrent());
  render();
  qzStopTimer();qzTimer=setInterval(qzTick,250);
}
function qzNext(){
  if(!qzGame)return;
  qzGame.i++;qzStopTimer();
  if(qzGame.i>=qzGame.order.length)return qzFinish();
  qzGame.phase='spin';qzGame.picked=null;qzGame.say=qzPick(QZ_SAY.spin);
  render();
  const b=$('#qz-spin');if(b)b.focus();
}
function qzTick(){
  if(!qzGame||qzGame.phase!=='play')return qzStopTimer();
  const left=qzGame.deadline-Date.now(),q=qzCurrent();
  const ring=$('#qz-ring'),txt=$('#qz-secs');
  if(ring&&q){ring.style.setProperty('--p',Math.max(0,left/qzLimit(q)*100).toFixed(1));ring.classList.toggle('qz-hurry',left<=5000)}
  if(txt)txt.textContent=Math.max(0,Math.ceil(left/1000));
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
  qzGame.say=ok?(qzGame.streak>=3?`¡Racha de ${qzGame.streak}! +${pts}`:`${qzPick(QZ_SAY.ok)} +${pts}`):idx<0?'¡Se acabó el tiempo!':qzPick(QZ_SAY.bad);
  qzGame.answers.push({qi:qzGame.order[qzGame.i],ok,pts,timeout:idx<0,kind:q.kind});
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
    const front=q.q.slice(0,1000),back=(q.opts[q.ok]+` (${qzWhere(s,q.slide)})`).slice(0,1000);
    if(deck.cards.some(c=>c.front===front))return;
    deck.cards.push({id:uid(),front,back,box:1,due:today()});n++;
  });
  F.activeDeckId=deck.id;save();
  toast(n?`${n} pregunta(s) pasadas al mazo "${deck.name}".`:'Esas preguntas ya estaban en tus flashcards.');
  render();
}

/* ---------- Vistas ---------- */
const qzKindLabel=Object.fromEntries(Object.entries(QZ_CATS).map(([k,v])=>[k,v.label]));
function qzWheelHtml(rot){
  const grad=QZ_ORDER.map((k,i)=>`${QZ_CATS[k].color} ${i*72}deg ${(i+1)*72}deg`).join(',');
  const icons=QZ_ORDER.map((k,i)=>`<span class="qz-wheel-ic" style="--a:${i*72+36}deg" title="${QZ_CATS[k].label}">${QZ_CATS[k].icon}</span>`).join('');
  return `<div class="qz-wheel-wrap"><span class="qz-pointer" aria-hidden="true"></span>
    <div class="qz-wheel" id="qz-wheel" aria-hidden="true" style="transform:rotate(${rot}deg);background:conic-gradient(${grad})">${icons}</div>
    <button class="qz-hub" id="qz-spin" data-focus-id="qz-spin" onclick="qzSpin()" ${qzGame.phase==='spinning'?'disabled':''}>${qzGame.phase==='spinning'?'…':'¡Girar!'}</button></div>
    <ul class="qz-legend">${QZ_ORDER.map(k=>`<li style="--c:${QZ_CATS[k].color}">${QZ_CATS[k].icon} ${QZ_CATS[k].label}</li>`).join('')}</ul>`;
}
function qzDotsHtml(){
  return `<div class="qz-dots" aria-label="Pregunta ${qzGame.i+1} de ${qzGame.order.length}">${qzGame.order.map((_,i)=>{
    const a=qzGame.answers[i];return `<span class="${a?(a.ok?'ok':'bad'):i===qzGame.i?'now':''}"></span>`}).join('')}</div>`;
}
function qzBubble(mood,text,size){
  const fig=qzArvis(mood,size||76,'qz-arvis-fig');
  return `<div class="qz-arvis-row${fig?'':' sin-arvis'}">${fig}<div class="qz-bubble" role="status">${esc(text)}</div></div>`;
}
function qzPlayHtml(){
  const s=qzCfg().sets.find(x=>x.id===qzGame.id),q=qzCurrent();
  if(!s||!q){qzGame=null;return ''}
  const total=qzGame.order.length,cat=QZ_CATS[q.kind]||QZ_CATS.definicion;
  const hud=`<div class="qz-hud"><button class="qz-x" aria-label="Salir de la trivia" onclick="quitQuiz()">✕</button>${qzDotsHtml()}
    <span class="qz-pts" aria-label="Puntaje">★ ${qzGame.score}</span></div>`;
  if(qzGame.phase==='spin'||qzGame.phase==='spinning'){
    return `<div class="qz-stage qz-stage-spin">${hud}
      <p class="qz-count">Pregunta ${qzGame.i+1} de ${total}</p>
      ${qzBubble('energia',qzGame.say,70)}
      ${qzWheelHtml(qzGame.rot)}</div>`;
  }
  const fb=qzGame.phase==='feedback',last=qzGame.answers[qzGame.answers.length-1];
  const left=Math.max(0,qzGame.deadline-Date.now());
  const opts=q.opts.map((o,i)=>{
    let cls='qz-opt';
    if(fb){if(i===q.ok)cls+=' qz-ok';else if(i===qzGame.picked)cls+=' qz-bad';else cls+=' qz-dim'}
    return `<button class="${cls}" ${fb?'disabled':''} data-focus-id="qz-opt-${i}" onclick="qzAnswer(${i})"><span class="qz-letter" aria-hidden="true">${'ABCD'[i]}</span><span class="qz-opt-t">${esc(o)}</span></button>`;
  }).join('');
  const mood=fb?(last.ok?'celebrando':'preocupado'):'estudiando';
  return `<div class="qz-stage" style="--cat:${cat.color};--cat-dark:${cat.dark}">${hud}
    <div class="qz-catbar"><span class="qz-cat-ic" aria-hidden="true">${cat.icon}</span>
      <span><b>${cat.label}</b><br><small>Pregunta ${qzGame.i+1} de ${total} · ${qzWhere(s,q.slide)}</small></span>
      ${fb?'':`<span class="qz-ring" id="qz-ring" style="--p:${(left/qzLimit(q)*100).toFixed(1)}" aria-hidden="true"><span id="qz-secs">${Math.ceil(left/1000)}</span></span>`}</div>
    ${qzBubble(mood,qzGame.say)}
    <div class="qz-qcard"><h2 class="qz-q">${esc(q.q)}</h2></div>
    <div class="qz-opts${q.opts.length===2?' qz-two':''}">${opts}</div>
    ${fb?`<div class="qz-feedback ${last.ok?'ok':'bad'}" role="status">${last.ok?`¡Correcto! +${last.pts} pts`:last.timeout?'Se acabó el tiempo.':'Incorrecto.'}${last.ok?'':` La respuesta era: <b>${esc(q.opts[q.ok])}</b> (${qzWhere(s,q.slide)}).`}</div>
      <button class="qz-next" id="qz-next" data-focus-id="qz-next" onclick="qzNext()">${qzGame.i+1<total?'Siguiente ➜':'Ver resultado ➜'}</button>`:''}
  </div>`;
}
function qzEndHtml(){
  const s=qzCfg().sets.find(x=>x.id===qzGame.id);if(!s){qzGame=null;return ''}
  const ok=qzGame.answers.filter(a=>a.ok).length,total=qzGame.answers.length,pct=total?Math.round(ok/total*100):0;
  const wrong=qzGame.answers.filter(a=>!a.ok).map(a=>s.questions[a.qi]);
  const msg=pct>=80?'¡Dominas esta presentación!':pct>=50?'Vas bien. Repasa las que fallaste y vuelve a jugar.':'Buen comienzo: repasa esas diapositivas y vuelve a intentarlo.';
  const porCat=QZ_ORDER.map(k=>{const a=qzGame.answers.filter(x=>x.kind===k);return a.length?`<li style="--c:${QZ_CATS[k].color}">${QZ_CATS[k].icon} ${QZ_CATS[k].label} <b>${a.filter(x=>x.ok).length}/${a.length}</b></li>`:''}).join('');
  const confeti=pct>=50&&!qzReduced()?`<div class="qz-confetti" aria-hidden="true">${Array.from({length:24},(_,i)=>`<i style="--x:${(i*37)%100}%;--d:${(i%6)*0.15}s;--c:${QZ_CATS[QZ_ORDER[i%5]].color}"></i>`).join('')}</div>`:'';
  return `<div class="qz-stage qz-stage-end">${confeti}
    <h2 class="qz-end-title">Resultado</h2>
    ${qzBubble(pct>=80?'celebrando':pct>=50?'normal':'estudiando',msg,96)}
    <div class="qz-bigscore"><span>${qzGame.score}</span><small>puntos</small></div>
    <p class="qz-final">${ok} de ${total} correctas (${pct} %) · mejor racha ${qzGame.bestStreak}</p>
    ${qzGame.record&&s.plays>1?'<p class="qz-record">🏆 ¡Nuevo récord en esta trivia!</p>':''}
    <ul class="qz-legend qz-catscore">${porCat}</ul>
    ${wrong.length?`<div class="qz-qcard qz-review"><h3>Para repasar</h3><ul class="qz-wrong">${wrong.map(q=>`<li>${esc(q.q)}<br><span class="mute">Respuesta: <b>${esc(q.opts[q.ok])}</b> · ${qzWhere(s,q.slide)}</span></li>`).join('')}</ul></div>`:''}
    <div class="qz-endbtns">
      <button class="qz-next" data-focus-id="qz-again" onclick="startQuiz('${s.id}')">Jugar de nuevo</button>
      ${wrong.length?`<button class="qz-ghost" data-focus-id="qz-to-fc" onclick="qzWrongToFlashcards()">Pasar falladas a flashcards</button>`:''}
      <button class="qz-ghost" onclick="quitQuiz()">Volver</button>
    </div></div>`;
}
function viewPregunta(){
  if(qzGame&&qzGame.phase!=='end'&&!qzCurrent())qzGame=null;
  if(qzGame)return `${screenHelp('pregunta')}${qzGame.phase==='end'?qzEndHtml():qzPlayHtml()}`;
  qzStopTimer();
  const Q=qzCfg();
  const courses=S.courses.map(c=>`<option value="${c.id}" ${qzCourse===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  const tiles=Q.sets.map((s,i)=>{const c=QZ_CATS[QZ_ORDER[i%5]];return `<div class="qz-tile" style="--cat:${c.color};--cat-dark:${c.dark}">
      <span class="qz-tile-ic" aria-hidden="true">${s.tipo==='pdf'?'📄':'📊'}</span>
      <span class="qz-tile-t"><b>${esc(s.name)}</b><small>${s.questions.length} preguntas${s.courseId&&course(s.courseId)?` · ${esc(cname(s.courseId))}`:''} · ${s.plays?`récord ${s.best} pts`:'sin jugar'}</small></span>
      <button class="qz-play" data-focus-id="qz-play-${s.id}" onclick="startQuiz('${s.id}')">Jugar ▶</button>
      <button class="btn del qz-del" aria-label="Borrar trivia ${esc(s.name)}" onclick="delQuiz('${s.id}')">Borrar</button></div>`}).join('');
  return `${screenHelp('pregunta')}<div class="qz-hero">
      ${qzArvis('energia',104,'qz-hero-arvis')}
      <div><h2>Arvis pregunta</h2><p>Sube las diapositivas de una clase y juega una trivia de conceptos, definiciones y teoría.</p></div>
    </div>
    <div class="grid">
    <div class="card"><h2>Nueva trivia</h2>
      <label class="qz-drop${qzFile?' has-file':''}" for="qz-file">
        <input id="qz-file" type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onchange="qzOnFile(this)" ${qzBusy?'disabled':''}>
        <span class="qz-drop-ic" aria-hidden="true">${qzFile?'✅':'📥'}</span>
        <span>${qzFile?`<b>${esc(qzFile.name)}</b><br><small>Toca para cambiar el archivo</small>`:'<b>Elige tu presentación</b><br><small>.pptx o PDF · se lee en este dispositivo</small>'}</span>
      </label>
      <div class="row form-stack" style="margin-top:12px">
        ${S.courses.length?`<span class="diff-field"><label for="qz-course">Ramo (opcional)</label>
          <select id="qz-course" onchange="qzCourse=this.value"><option value="">Sin ramo</option>${courses}</select></span>`:''}
        <span class="diff-field"><label for="qz-count">Preguntas</label>
          <select id="qz-count" onchange="qzCount=this.value">${['5','10','15','20'].map(n=>`<option ${qzCount===n?'selected':''}>${n}</option>`).join('')}</select></span>
      </div>
      <button class="qz-next qz-create" data-focus-id="qz-create" onclick="createQuiz()" ${qzBusy?'disabled':''}>${qzBusy?'Leyendo diapositivas…':'Crear trivia ✨'}</button>
      ${qzMsg?`<p class="qz-feedback bad" role="alert">${esc(qzMsg)}</p>`:''}
      <p class="mute">Arvis se enfoca en conceptos, definiciones y teoría, y deja fuera los ejercicios y ejemplos numéricos. Funciona mejor con títulos y viñetas del tipo «Concepto: explicación». No lee texto dentro de imágenes.</p>
    </div>
    <div class="card"><h2>Tus trivias</h2>
      ${tiles||'<p class="mute">Aún no tienes trivias. Sube las diapositivas de tu próxima clase o certamen.</p>'}
    </div>
  </div>`;
}
