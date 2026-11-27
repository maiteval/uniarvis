/* U.A.R.V.I.S. · Capacidad realista del día (clases + historial + check-in) */
/* ===================== Capacidad realista del día ===================== */
function sessMap(){if(C.sm)return C.sm;const m={};S.sessions.forEach(x=>m[x.date]=(m[x.date]||0)+x.minutes);return C.sm=m}
const doneOn=d=>sessMap()[d]||0;
const doneToday=()=>doneOn(today());
const classMinutes=date=>{const dow=(parse(date).getDay()+6)%7;return S.classes.filter(k=>k.day===dow).reduce((a,k)=>a+toMin(k.end)-toMin(k.start),0)};
const E=EVIDENCE.capacity;
function histPeak(date){                      // días de mayor estudio de las últimas 3 semanas
  const m=sessMap(),v=[];
  for(let i=1;i<=E.historyDays;i++){const x=m[addDays(date,-i)];if(x>0)v.push(x)}
  if(v.length<E.historyMinSamples)return null;
  v.sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.round(E.historyPercentile*(v.length-1)))];
}
const softOn=d=>!!S.soft&&d>=S.soft.from&&d<=S.soft.until;
function sleepDebtInfo(date){
  const entries=[];
  for(let d=addDays(date,-1);entries.length<E.debtWindow&&d>=addDays(date,-60);d=addDays(d,-1)){
    const c=ci(d);
    if(c&&c.sleep)entries.push(c);
  }
  if(!entries.length)return {hours:0,factor:1,n:0};
  const hours=entries.reduce((a,c)=>a+Math.max(0,E.targetSleep-E.sleepHours[c.sleep-1]),0);
  const steps=Math.floor(hours/E.debtStepHours);
  return {hours,factor:Math.max(1-E.debtMax,1-E.debtPenalty*steps),n:entries.length};
}
function plannedOn(date){
  const planned=S.tasks.filter(t=>t.date===date).reduce((a,t)=>a+t.minutes,0);
  const logged=S.sessions.filter(x=>x.date===date&&x.taskId).reduce((a,x)=>a+x.minutes,0);
  return Math.max(planned,logged);
}
function calibrationInfo(date){
  const planned=[0,0,0,0,0],done=[0,0,0,0,0],counts=[0,0,0,0,0];
  let days=0;
  for(let i=1;i<=60;i++){
    const d=addDays(date,-i),c=ci(d);
    if(!c||!plannedOn(d))continue;
    const k=c.energy-1;
    planned[k]+=plannedOn(d);done[k]+=doneOn(d);counts[k]++;days++;
  }
  if(days<E.calibrationMinDays)return {factor:1,days,weight:0};
  let f=1,w=0,n=0;
  counts.forEach((count,k)=>{
    if(!count)return;
    const ratio=clamp(done[k]/Math.max(1,planned[k]),0,1.5),weight=Math.min(E.calibrationMaxWeight,count/E.calibrationSampleCap);
    f+=weight*(ratio-1);w+=weight;n+=count;
  });
  return {factor:clamp(f,E.calibrationMinFactor,E.calibrationMaxFactor),days:n,weight:w/counts.filter(x=>x>0).length};
}
function factorFor(date){
  const c=ci(date);if(!c)return 1;
  const debt=sleepDebtInfo(date),cal=calibrationInfo(date);
  let f=E.energy[c.energy-1]*E.sleep[(c.sleep||3)-1]*debt.factor*cal.factor;
  if(c.mood<=2)f*=E.moodLow;
  return Math.max(E.floor,f);
}
function capInfo(date){
  const key='c'+date;if(C[key])return C[key];
  const cm=classMinutes(date),pm=typeof personalMinutesOn==='function'?personalMinutesOn(date):0;
  let base=clamp((E.dayMinutes-cm-pm-E.personalMinutes)*E.studyShare,E.minBase,E.maxBase);
  const hist=histPeak(date);
  if(hist)base=Math.max(E.minBase,Math.min(base*E.historyMaxGain,(1-E.historyMix)*base+E.historyMix*hist*E.historyBoost));
  const f=factorFor(date),debt=sleepDebtInfo(date),cal=calibrationInfo(date),sf=softOn(date)?E.soft:1;
  return C[key]={cm,pm,base:Math.round(base),hist,f,debt,cal,sf,val:Math.max(30,Math.round(base*f*sf/E.round)*E.round)};
}
const capFor=d=>capInfo(d).val;
function minFor(d){const m=Math.max(15,Math.round(S.settings.min*Math.min(1,factorFor(d))*(softOn(d)?E.soft:1)/E.round)*E.round);return Math.min(m,capFor(d))}
const lowMode=d=>{const c=ci(d);return !!c&&(c.energy<=2||factorFor(d)<0.65)};
const planCap=d=>(d===today()&&lowMode(d))?minFor(d):capFor(d);   // con energía baja, hoy solo el mínimo viable
function capExplain(i){
  const L=[];
  L.push(i.cm?`Clases hoy: ${(i.cm/60).toFixed(1)} h → base de estudio ≈ ${i.base} min.`:`Sin clases hoy → base de estudio ≈ ${i.base} min.`);
  if(i.pm)L.push(`Actividades personales hoy: ${(i.pm/60).toFixed(1)} h, descontadas de esa base.`);
  L.push(i.hist?`Tu ritmo reciente (tus días de más estudio ≈ ${Math.round(i.hist)} min) ajusta esa base.`:'Aún no hay suficiente historial (se usa tras ~5 días con estudio registrado).');
  L.push(ci(today())?`Tu check-in de hoy la deja en ${Math.round(i.f*100)}%.`:'Sin check-in hoy: uso la capacidad estándar.');
  if(i.debt&&i.debt.hours>0)L.push(`Deuda de sueño reciente (${i.debt.n} registros): −${Math.round((1-i.debt.factor)*100)}%. No se compensa con energía alta.`);
  if(i.cal&&i.cal.days>=E.calibrationMinDays)L.push(`Calibración con tus últimos ${i.cal.days} días con check-in y plan: ×${i.cal.factor.toFixed(2)}.`);
  if(i.sf<1)L.push('Modo suave activo: −25%.');
  return L;
}
function applySoft(){S.soft={from:today(),until:addDays(today(),2)};save();replanAll();toast('Modo suave por 3 días: bajé tu carga un 25% y reacomodé el plan.');render()}
function endSoft(){S.soft=null;save();replanAll();render()}
