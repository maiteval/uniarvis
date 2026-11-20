/* U.A.R.V.I.S. · Vistas (HTML de cada pestaña) */
/* ===================== Vistas ===================== */
const chronotypeOptions=(id,current)=>`<select id="${id}">${CHRONOTYPES.map(([v,l])=>`<option value="${v}" ${current===v?'selected':''}>${l}</option>`).join('')}</select>`;
function viewLanding(){
  const calma=(S.settings&&S.settings.style)==='calma';
  const uni='<option value="">Sin definir</option>'+UNIVERSITIES_CHILE.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')+
    `<option value="${esc(UNIVERSITY_OTHER)}">${esc(UNIVERSITY_OTHER)}</option><option value="${esc(UNIVERSITY_PREFERS_NOT)}">${esc(UNIVERSITY_PREFERS_NOT)}</option>`;
  const university=`<label>Universidad (opcional)<select id="reg-university">${uni}</select></label>`;
  const chrono=`<label>¿A qué hora del día te concentras mejor? (opcional)${chronotypeOptions('reg-chronotype',(S.settings&&S.settings.chronotype)||'no_se')}</label>`;
  const back='<button class="btn sec" data-focus-id="reg-back" onclick="choosePersonalBack()">Volver</button>';
  if(calma)return `<div class="landing landing-calma"><div class="landing-bg"></div><div class="landing-panel">
    <h1 class="landing-title">Bienvenido/a</h1>
    <p class="landing-sub">Crea tu perfil para organizar tu semestre a tu ritmo.</p>
    <div class="hud-form">
      <label>Nombre<input id="reg-name" type="text" maxlength="60" placeholder="Tu nombre"></label>
      <label>Carrera / Programa<input id="reg-career" type="text" maxlength="80" placeholder="Tu carrera"></label>
      ${university}
      ${chrono}
      <div class="row"><button class="btn hud-btn" onclick="registerProfile()">Empezar</button>${back}</div>
    </div>
    <p class="mute hud-note">Los datos se guardan solo en este navegador (localStorage).</p>
  </div></div>`;
  return `<div class="landing"><div class="landing-bg"></div><div class="landing-panel hud">
    <div class="hud-head"><span class="hud-mark">◈</span> U.A.R.V.I.S. · INTERFAZ ACADÉMICA</div>
    <h1 class="landing-title">U.A.R.V.I.S.</h1>
    <p class="landing-sub">Ingresa tu perfil para personalizar el panel HUD de tu semestre.</p>
    <div class="hud-form">
      <label>Identificación / Nombre<input id="reg-name" type="text" maxlength="60" placeholder="Tu nombre"></label>
      <label>Carrera / Programa<input id="reg-career" type="text" maxlength="80" placeholder="Tu carrera"></label>
      ${university}
      ${chrono}
      <div class="row"><button class="btn hud-btn" onclick="registerProfile()">INICIAR SISTEMA</button>${back}</div>
    </div>
    <p class="mute hud-note">Los datos se guardan solo en este navegador (localStorage).</p>
  </div></div>`;
}
function viewAccountChoice(){
  const calma=(S.settings&&S.settings.style)==='calma';
  return `<div class="landing account-landing ${calma?'landing-calma':''}"><div class="landing-bg"></div><div class="landing-panel account-panel">
    <h1 class="landing-title">¿Cómo quieres usar Uarvis?</h1>
    <p class="landing-sub">Puedes cambiar de modo cuando quieras en Ajustes → Cuenta. Tus datos no se borran.</p>
    <div class="account-choices">
      <button class="account-choice" data-focus-id="account-personal" onclick="choosePersonal()">
        <span class="account-icon" aria-hidden="true">◈</span><b>Personal</b>
        <span>Úsala por tu cuenta. Todo queda en tu dispositivo.</span><span class="home-arrow" aria-hidden="true">→</span></button>
      <button class="account-choice" data-focus-id="account-institucional" onclick="startInstitutionalFlow('selection')">
        <span class="account-icon" aria-hidden="true">▣</span><b>Institucional</b>
        <span>Tu universidad tiene Uarvis.</span><span class="home-arrow" aria-hidden="true">→</span></button>
    </div>
    <p class="mute hud-note">El check-in, la energía, el ánimo, el sueño, el diario, las notas personales y las calificaciones nunca salen del dispositivo.</p>
  </div></div>`;
}
function viewInstitutionalFlow(){
  const f=InstitutionalFlow.get();if(!f)return viewAccountChoice();
  const inst=INSTITUTIONS[0],proto='<span class="tag inst-example">Prototipo</span>';
  const back=`<button class="btn sec" data-focus-id="account-back" onclick="institutionalBack()">Volver</button>`;
  const idx={choose:0,login:1,code:2,password:3,profile:4,consent:5}[f.step]||0;
  const steps=`<div class="inst-steps" aria-label="Pasos del ingreso institucional">${INST_FLOW_STEPS.map((s,i)=>
    `<span class="${i<idx?'done':(i===idx?'on':'')}" ${i===idx?'aria-current="step"':''}>${i+1}. ${esc(s)}</span>`).join('')}</div>`;
  let body='';
  if(f.step==='choose'){
    body=`<h2>Elige tu universidad ${proto}</h2>
      ${INSTITUTIONS.map(i=>`<button class="inst-option" data-focus-id="inst-option-${i.id}" onclick="institutionalNext()">
        <span><b>${esc(i.name)}</b><br><span class="mute">${esc(i.short)} · ${esc(i.emailDomain)}</span></span><span class="home-arrow" aria-hidden="true">→</span></button>`).join('')}
      <div class="row" style="margin-top:14px">${back}</div>`;
  }else if(f.step==='login'){
    body=`<h2>${esc(inst.name)} ${proto}</h2><p>Escribe tu correo ${esc(inst.name)}. Te enviaremos un código de 6 dígitos para verificarlo.</p>
      <div class="hud-form"><label>Correo institucional<input id="inst-email" type="email" autocomplete="email" placeholder="nombre@${esc(inst.emailDomain)}" value="${esc(f.email)}" oninput="institutionalEmail(this.value)"></label>
      <button class="btn" data-focus-id="inst-login" onclick="institutionalSubmitEmail()">Enviar código de verificación</button></div>
      ${f.error?`<div class="banner go" role="alert">${esc(f.error)}</div>`:''}
      <p class="mute">Prototipo: no se envía ningún correo ni se hacen peticiones de red. Verás la bandeja simulada en el siguiente paso.</p>
      <div class="row">${back}</div>`;
  }else if(f.step==='code'){
    const wait=Math.max(0,Math.ceil((f.resendAt-Date.now())/1000));
    body=`<h2>Verifica tu correo ${proto}</h2>
      <p>Enviamos un código de 6 dígitos a <b>${esc(f.email)}</b>. <button type="button" class="lnk" data-focus-id="inst-change-email" onclick="institutionalChangeEmail()">Cambiar correo</button></p>
      ${f.verified?`<div class="banner info"><b>Código verificado.</b> Ya puedes crear tu contraseña.</div>
        <div class="row"><button class="btn" data-focus-id="inst-code-continue" onclick="institutionalCodeContinue()">Continuar</button>${back}</div>`
      :`<div class="hud-form"><label>Código de 6 dígitos<input id="inst-code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" value="${esc(f.codeInput||'')}" oninput="institutionalCode(this.value)"></label>
        <div class="row"><button class="btn" data-focus-id="inst-code-submit" onclick="institutionalSubmitCode()">Verificar código</button>
          <button class="btn sec" data-focus-id="inst-resend" onclick="institutionalResendCode()" ${wait?'disabled':''}>Reenviar código${wait?` (<span data-auth-countdown>${wait} s)</span>`:''}</button></div></div>
        <p class="mute" style="margin-bottom:4px">Intentos restantes: <b>${Math.max(0,INST_CODE_ATTEMPTS-f.attempts)}</b>. El código vence a los 10 minutos.</p>
        ${f.error?`<div class="banner go" role="alert">${esc(f.error)}</div>`:''}
        <div class="sim-inbox"><b>Bandeja de entrada simulada</b>
          <p class="mute">Simulación: en la versión real llegará a tu correo</p>
          <div class="sim-mail"><span>De: <b>Uarvis · UdeC</b></span><span>Asunto: <b>Tu código de verificación</b></span>
            <strong class="inst-code" aria-label="Código de verificación">${esc(f.code||'——————')}</strong></div></div>
        <div class="row">${back}</div>`}`;
  }else if(f.step==='password'){
    const rules=instPassRules($('#inst-pass1')?$('#inst-pass1').value:'');
    body=`<h2>Crea tu contraseña ${proto}</h2>
      <p class="mute">La usarás en los siguientes inicios de sesión. Nunca se guarda en texto: solo un hash en este dispositivo.</p>
      <div class="hud-form"><label>Contraseña<span class="pass-field"><input id="inst-pass1" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" oninput="instPasswordInput()"><button type="button" class="btn sec inst-pass-toggle" onclick="instTogglePass('inst-pass1',this)" aria-label="Mostrar contraseña">Ver</button></span></label>
      <label>Repite la contraseña<span class="pass-field"><input id="inst-pass2" type="password" autocomplete="new-password" placeholder="Repite tu contraseña" oninput="instPasswordInput()"><button type="button" class="btn sec inst-pass-toggle" onclick="instTogglePass('inst-pass2',this)" aria-label="Mostrar contraseña">Ver</button></span></label>
      <ul class="inst-rules" id="inst-pass-rules" aria-label="Requisitos de la contraseña">
        <li id="inst-rule-len" class="${rules.len?'ok':''}">${rules.len?'✓':'○'} Mínimo 8 caracteres</li>
        <li id="inst-rule-letter" class="${rules.letter?'ok':''}">${rules.letter?'✓':'○'} Al menos una letra</li>
        <li id="inst-rule-number" class="${rules.number?'ok':''}">${rules.number?'✓':'○'} Al menos un número</li>
        <li id="inst-rule-match" class="">○ Las contraseñas coinciden</li></ul>
      <p class="inst-strength">Fortaleza: <b id="inst-pass-strength">Débil</b></p>
      <button class="btn" data-focus-id="inst-pass-submit" onclick="institutionalSubmitPassword(event)">Continuar</button></div>
      ${f.error?`<div class="banner go" role="alert">${esc(f.error)}</div>`:''}
      <div class="row">${back}</div>`;
  }else if(f.step==='profile'){
    const p=f.profile||S.profile||{};
    body=`<h2>Tus datos ${proto}</h2><p class="mute">Tu universidad ya viene de tu cuenta y no se puede cambiar aquí.</p>
      <div class="hud-form"><label>Nombre<input id="inst-profile-name" type="text" maxlength="60" placeholder="Tu nombre" value="${esc(p.name||'')}"></label>
      <label>Carrera / Programa<input id="inst-profile-career" type="text" maxlength="80" placeholder="Tu carrera" value="${esc(p.career||'')}"></label>
      <label>Universidad<input id="inst-profile-university" type="text" value="${esc(inst.name)}" disabled aria-readonly="true"></label>
      <label>¿A qué hora del día te concentras mejor? (opcional)${chronotypeOptions('inst-profile-chronotype',(f.profile&&f.profile.chronotype)||(S.settings&&S.settings.chronotype)||'no_se')}</label>
      <button class="btn" data-focus-id="inst-profile-next" onclick="institutionalProfileNext()">Continuar</button></div>
      ${f.error?`<div class="banner go" role="alert">${esc(f.error)}</div>`:''}
      <div class="row">${back}</div>`;
  }else if(f.step==='consent'){
    body=`<h2>Consentimiento</h2><p class="mute">Único aviso antes de vincular tu cuenta ${esc(inst.short)}. ${proto}</p>
      <div class="grid2"><div class="card"><h3>Qué ve la universidad</h3>
        <ul><li>Estadísticas generales de uso y de carga académica.</li><li>Solo de grupos de 10 o más personas.</li><li>Nunca datos que permitan identificarte en esos informes.</li></ul></div>
      <div class="card"><h3>Qué no ve nunca</h3>
        <ul><li>Check-in, energía, ánimo y sueño.</li><li>Diario y notas personales.</li><li>Calificaciones.</li></ul></div></div>
      <div class="row"><button class="btn" data-focus-id="inst-consent-ok" onclick="institutionalAccept()">Entendido</button>${back}</div>`;
  }else if(f.step==='import'){
    body=institutionImportHtml();
  }else if(f.step==='preview'){
    body=institutionPreviewHtml();
  }
  return `<div class="landing account-landing"><div class="landing-bg"></div><div class="landing-panel account-panel inst-flow">
    ${steps}${body}</div></div>`;
}
function viewInstLogin(){
  if(typeof instLoginResetExpiredLock==='function')instLoginResetExpiredLock();
  const inst=currentInstitution()||INSTITUTIONS[0];
  const wait=Math.ceil(instLoginLockRemaining()/1000),locked=wait>0;
  return `<div class="landing account-landing"><div class="landing-bg"></div><div class="landing-panel account-panel inst-flow" id="inst-login-panel">
    <h2>Iniciar sesión · ${esc(inst.name)} <span class="tag inst-example">Prototipo</span></h2>
    <p class="mute">Tu cuenta institucional. La contraseña se pide solo en este dispositivo.</p>
    <div class="hud-form"><label>Correo institucional<input id="inst-login-email" type="email" value="${esc(S.account.email||'')}" readonly aria-readonly="true"></label>
      <form onsubmit="instLogin(event);return false"><label>Contraseña<input id="inst-login-pass" type="password" autocomplete="current-password" placeholder="Tu contraseña institucional" ${locked?'disabled':''}></label>
        <div class="row" style="margin-top:12px"><button class="btn" data-focus-id="inst-login-submit" type="submit" ${locked?'disabled':''}>Iniciar sesión</button>
        <button class="btn sec" type="button" data-focus-id="inst-forgot-pass" onclick="instForgotPassword()">¿Olvidaste tu contraseña?</button></div></form>
      ${locked?`<p class="mute" data-auth-countdown>Demasiados intentos. Espera ${wait} s antes de reintentar.</p>`:''}
      ${instLoginError?`<div class="banner go" role="alert">${esc(instLoginError)}</div>`:''}
    </div>
    <div class="row" style="margin-top:14px"><button class="btn sec" data-focus-id="inst-use-personal" onclick="instUsePersonal()">Usar sin mi cuenta universitaria</button>
      <button class="lnk" data-focus-id="inst-change-mode" onclick="showAccountChoice('inst-login')">Cambiar de modo</button></div>
  </div></div>`;
}
function institutionImportHtml(){
  const steps=INST_IMPORT_STEPS,current=instImport?instImport.step:0;
  const done=instImport&&instImport.data&&instImport.step===4;
  const icon=i=>done||i<current?'✓':(i===current?'…':'○');
  return `<div class="landing account-landing"><div class="landing-bg"></div><div class="landing-panel account-panel inst-flow" id="inst-import">
    <div class="inst-steps" aria-label="Pasos de la importación">${steps.map((s,i)=>`<span class="${done||i===current?'on':''}"><b aria-hidden="true">${icon(i)}</b> ${esc(s)}</span>`).join('')}</div>
    <h2>Importando tus datos desde la UdeC…</h2>
    <p class="mute">Estoy leyendo ramos inscritos, horario, fechas de evaluación y notas de este semestre. ${done?'Ya están listos para que los revises.':'Es solo un momento.'}</p>
    ${instImport&&instImport.error?`<div class="banner go" role="alert">${esc(instImport.error)}</div>`:''}
    <div class="banner info"><b>Datos de ejemplo</b><br>Esta importación es simulada: no hace peticiones de red ni lee tus datos de bienestar.</div>
    <div class="row"><button class="btn sec" data-focus-id="inst-import-skip" onclick="cancelInstitutionImport()">Ahora no</button></div>
  </div></div>`;
}
function institutionPreviewHtml(){
  const s=institutionImportSummary();
  const rows=instImport.courses.map((x,i)=>{
    const c=x.course,ks=instImport.data.classes.filter(k=>k.courseId===c.id),evs=instImport.data.events.filter(e=>e.courseId===c.id);
    const grade=gradeSummary(c.grades,c);
    return `<tr><td><input type="checkbox" aria-label="Incluir ${esc(c.name)}" data-focus-id="inst-preview-keep-${i}" ${x.keep?'checked':''} onchange="setInstitutionCourse(${i},this.checked)"></td>
      <td><b>${esc(c.name)}</b><br><span class="mute">${esc(c.code)} · Sección ${esc(c.section)}</span>${x.exists?'<br><span class="tag">Ya lo tienes</span>':''}</td>
      <td>${ks.map(k=>`${DAYS[k.day]} ${k.start}–${k.end} <span class="mute">(${k.kind})</span>`).join('<br>')||'—'}</td>
      <td>${evs.length} fecha(s)</td><td>${c.grades.length?gradeTxt(grade.avg)+' · nota necesaria '+gradeTxt(grade.need):'—'}</td></tr>`;
  }).join('');
  return `<div class="landing account-landing"><div class="landing-bg"></div><div class="landing-panel account-panel inst-flow" id="inst-preview">
    <h2>Revisa lo que traigo desde la UdeC</h2>
    <p class="mute">No guardé nada todavía. Marca los ramos que quieras agregar; los que ya tienes vienen sin marcar para no duplicarlos. <span class="tag inst-example">Datos de ejemplo</span></p>
    <div class="banner info"><b>Resumen:</b> ${s.courses} ramo(s), ${s.classes} bloque(s) de horario, ${s.events} fecha(s) y ${s.grades} nota(s).</div>
    <div style="overflow:auto"><table><tr><th></th><th>Ramo</th><th>Horario</th><th>Fechas</th><th>Notas</th></tr>${rows}</table></div>
    <div class="row" style="margin-top:12px"><button class="btn" data-focus-id="inst-import-confirm" onclick="confirmInstitutionImport()">Agregar a mi Uarvis</button>
      <button class="btn sec" data-focus-id="inst-import-later" onclick="cancelInstitutionImport()">Ahora no</button></div>
  </div></div>`;
}
function homeNotice(){
  const t0=today();
  const crit=criticalClusters().filter(g=>diffDays(t0,g.start)<=28)[0];
  if(crit){
    const real=crit.events.filter(e=>!e.institution),n=real.length;
    const detalle=!n?'Semana de certámenes de la UdeC.':`${n===1?'1 fecha importante':n+' fechas importantes'} juntas.`;
    return `<div class="banner go"><b>Semana exigente del ${dshort(crit.start)} al ${dshort(crit.end)}</b><br>${detalle} <button class="lnk" onclick="go('semana')">Ver planificación</button></div>`;
  }
  const w=earlyWarnings().filter(x=>S.dismissed[x.key]!==t0)[0];
  if(w)return `<div class="banner soft"><b>${w.title}</b> ${w.text} <button class="lnk" onclick="go('apoyo')">Ver apoyo</button></div>`;
  return '';
}
function icsPendingHtml(){
  const sueltos=icsEvaluations&&icsEvaluations.length?`<details><summary>Posibles evaluaciones (no se guardan)</summary><ul>${icsEvaluations.map(e=>
    `<li>${esc(e.date)} ${e.start?esc(e.start)+' ':''}${esc(e.title)}${e.location?' · '+esc(e.location):''}</li>`).join('')}</ul></details>`:'';
  if(!icsPending)return (icsNotice?`<div class="banner info">${esc(icsNotice)}</div>`:'')+sueltos;
  const courseOpts=sel=>S.courses.map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>${esc(c.name)}</option>`).join('')+`<option value="new" ${sel==='new'||!sel?'selected':''}>Crear ramo nuevo</option>`;
  return `<div class="card" id="ics-confirm"><h3>Horario detectado · revisa y confirma</h3>
    <p class="mute" style="margin-top:0">No guardé nada todavía. Marca los bloques que quieras agregar, revisa el nombre y asígnalos a un ramo.</p>
    <table><tr><th></th><th>Bloque</th><th>Nombre</th><th>Ramo</th></tr>
    ${icsPending.map((b,i)=>`<tr><td><input type="checkbox" aria-label="Importar ${esc(b.name)}" data-focus-id="ics-keep-${i}" ${b.keep?'checked':''} onchange="setICSBlock(${i},'keep',this.checked)"></td>
      <td>${DAYS[b.day]} ${b.start}–${b.end}<br><span class="mute">${b.count} semana(s)${b.location?' · '+esc(b.location):''}</span></td>
      <td><input id="ics-name-${i}" style="width:100%" maxlength="80" value="${esc(b.name)}" onchange="setICSBlock(${i},'name',this.value)"></td>
      <td><select data-focus-id="ics-course-${i}" onchange="setICSBlock(${i},'courseId',this.value)">${courseOpts(b.courseId)}</select></td></tr>`).join('')}</table>
    ${icsNotice?`<p class="mute">⚠ ${esc(icsNotice)}</p>`:''}
    ${sueltos}
    <div class="row" style="margin-top:8px"><button class="btn" onclick="confirmICS()">Confirmar y agregar al horario</button>
      <button class="btn sec" onclick="cancelICS()">Cancelar</button></div></div>`;
}
function institutionDoneNotice(){
  if(!instImportNotice||!S.courses.some(c=>importedCourse(c)&&!hasSyllabus(c.id)))return '';
  return `<div class="banner inst-done" id="inst-import-done"><b>Listo. Lo único que falta es el syllabus de cada ramo.</b><br>
    Sube los syllabus para afinar las fechas y el plan. <button class="lnk" onclick="go('syllabus')">Ir a Académico → Fechas</button>
    <button class="lnk" onclick="dismissInstitutionDone()">Entendido</button>
    <span class="tag inst-example">Datos de ejemplo</span></div>`;
}
const aiDemoTag=()=>`<span class="tag inst-example ai-demo-tag" title="Respuestas generadas en tu dispositivo, sin IA real" aria-label="Respuestas generadas en tu dispositivo, sin IA real">IA · demo</span>`;
const aiSyllabusOn=()=>typeof isInstitutional==='function'&&isInstitutional()&&typeof ArvisIA!=='undefined';
const iaConfianza=c=>`<span class="tag${c==='Revísalo'?' inst-example':''}">${esc(c||'Seguro')}</span>`;
function aiSyllabusHtml(){
  const r=sylAi;
  return `${arvisMomentoHtml('syllabus')}<div class="card" id="syl-ai"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
    <div><h2 style="margin:0">Lectura inteligente del syllabus</h2><span class="mute">Sugerencias generadas en tu dispositivo: nada se agrega sin tu confirmación.</span></div>
    <button class="btn sec" data-focus-id="syl-ai-analyze" onclick="analyzeWithArvis()" ${sylAiLoading?'disabled':''}>Analizar con Arvis ${aiDemoTag()}</button></div>
    ${sylAiLoading?'<div class="banner info" id="syl-ai-loading">Arvis está leyendo tu syllabus…</div>':''}
    ${r?sylAiPreviewHtml(r):''}
  </div>`;
}
function sylAiPreviewHtml(r){
  const fechas=r.fechas.map((p,i)=>`<tr><td><input type="checkbox" ${p.keep?'checked':''} aria-label="Incluir fecha ${i+1}" onchange="setSylAiField('fechas',${i},'keep',this.checked)"></td>
    <td><input type="date" value="${esc(p.date)}" aria-label="Fecha ${i+1}" onchange="setSylAiField('fechas',${i},'date',this.value)"></td>
    <td><select aria-label="Tipo de fecha ${i+1}" onchange="setSylAiField('fechas',${i},'type',this.value)">${Object.entries(TYPE_LABEL).map(([k,v])=>`<option value="${k}" ${k===p.type?'selected':''}>${v}</option>`).join('')}</select></td>
    <td><input style="width:100%" value="${esc(p.title)}" aria-label="Descripción de fecha ${i+1}" onchange="setSylAiField('fechas',${i},'title',this.value)">${p.note?`<div class="mute">⚠ ${esc(p.note)}</div>`:''}</td>
    <td>${iaConfianza(p.confianza)}</td></tr>`).join('');
  const pesos=r.ponderaciones.map((p,i)=>`<tr><td><input type="checkbox" ${p.keep?'checked':''} aria-label="Incluir ponderación ${i+1}" onchange="setSylAiField('ponderaciones',${i},'keep',this.checked)"></td>
    <td><input style="width:100%" value="${esc(p.nombre)}" aria-label="Evaluación ${i+1}" onchange="setSylAiField('ponderaciones',${i},'nombre',this.value)"></td>
    <td><input type="number" min="0" max="100" step="0.1" value="${esc(p.peso)}" aria-label="Peso ${i+1}" onchange="setSylAiField('ponderaciones',${i},'peso',this.value)"> %</td>
    <td>${iaConfianza(p.confianza)}${p.note?`<div class="mute">⚠ ${esc(p.note)}</div>`:''}</td></tr>`).join('');
  const reglas=r.reglas.map((p,i)=>`<tr><td><input type="checkbox" ${p.keep?'checked':''} aria-label="Incluir regla ${i+1}" onchange="setSylAiField('reglas',${i},'keep',this.checked)"></td>
    <td><input style="width:100%" value="${esc(p.texto)}" aria-label="Regla ${i+1}" onchange="setSylAiField('reglas',${i},'texto',this.value)"></td>
    <td>${p.campo?`<input type="number" min="1" max="7" step="0.1" value="${esc(p.valor)}" aria-label="Valor de regla ${i+1}" onchange="setSylAiField('reglas',${i},'valor',this.value)">`:'—'}</td>
    <td>${iaConfianza(p.confianza)}</td></tr>`).join('');
  const contenidos=r.contenidos.map((p,i)=>`<tr><td><input type="checkbox" ${p.keep?'checked':''} aria-label="Incluir contenido ${i+1}" onchange="setSylAiField('contenidos',${i},'keep',this.checked)"></td>
    <td><input style="width:100%" value="${esc(p.texto)}" aria-label="Contenido ${i+1}" onchange="setSylAiField('contenidos',${i},'texto',this.value)"></td>
    <td>${iaConfianza(p.confianza)}</td></tr>`).join('');
  return `<div id="syl-ai-preview" style="margin-top:12px">
    ${r.avisos.length?`<div class="banner go" id="syl-ai-avisos">${r.avisos.map(x=>`<div>⚠ ${esc(x)}</div>`).join('')}</div>`:''}
    <h3>Fechas</h3><table><tr><th></th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Confianza</th></tr>${fechas||'<tr><td colspan="5" class="mute">Sin fechas detectadas.</td></tr>'}</table>
    <h3>Ponderaciones</h3><table><tr><th></th><th>Evaluación</th><th>Peso</th><th>Confianza</th></tr>${pesos||'<tr><td colspan="4" class="mute">Sin ponderaciones detectadas.</td></tr>'}</table>
    <h3>Reglas del ramo</h3><table><tr><th></th><th>Regla</th><th>Valor</th><th>Confianza</th></tr>${reglas||'<tr><td colspan="4" class="mute">Sin reglas detectadas.</td></tr>'}</table>
    <h3>Contenidos</h3><table><tr><th></th><th>Tema o unidad</th><th>Confianza</th></tr>${contenidos||'<tr><td colspan="3" class="mute">Sin contenidos detectados.</td></tr>'}</table>
    <div class="row" style="margin-top:10px"><button class="btn" data-focus-id="syl-ai-add" onclick="addSyllabusAi()">Agregar lo seleccionado</button>
      <button class="btn sec" onclick="cancelSyllabusAi()">Cancelar</button></div>
  </div>`;
}
function weeklyResumen(){
  if(typeof isInstitutional!=='function'||!isInstitutional()||typeof ArvisIA==='undefined')return null;
  return ArvisIA.weeklySummarySync();
}
function weeklyText(res){
  if(!res)return '';
  return (res.parrafos||[]).map(p=>`<p>${esc(p)}</p>`).join('');
}
function weeklyLista(items){
  if(!items||!items.length)return '';
  return `<ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
}
function weeklyInicioHtml(){
  const res=weeklyResumen(),semana=mondayOf(today());
  if(!res||S.weeklySummary&&S.weeklySummary.dismissedWeek===semana)return '';
  return `<div class="card" id="weekly-inicio"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
    <div><h3 style="margin:0">${esc(res.titulo)}</h3><span class="mute">Un vistazo corto a los próximos 7 días</span></div>${aiDemoTag()}</div>
    <p>${esc(res.parrafos[0]||'')}</p>
    ${res.prioridades.length?`<p class="mute" style="margin:6px 0"><b>Prioridad:</b> ${esc(res.prioridades[0])}</p>`:''}
    <div class="row" style="margin-top:8px"><button class="btn sec" onclick="go('semana')">Ver resumen</button>
      <button class="lnk" onclick="dismissWeeklySummary()">Ahora no</button></div></div>`;
}
function weeklyCardHtml(){
  const res=weeklyResumen();if(!res)return '';
  const suave=res.modoSuave&&typeof softOn==='function'&&!softOn(today());
  return `<div class="card" id="weekly-card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
    <div><h2 style="margin:0">${esc(res.titulo)}</h2><span class="mute">Próximos 7 días · sin presión</span></div>
    <div class="row" style="gap:6px">${aiDemoTag()}<span class="tag">${esc(res.estado==='celebrando'?'Semana liviana':res.estado==='preocupado'?'Semana exigente':'Semana estable')}</span></div></div>
    ${weeklyText(res)}
    <div class="row" style="justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:240px"><b>Prioridades</b>${weeklyLista(res.prioridades.slice(0,3))}</div>
      <div style="flex:1;min-width:240px"><b>Alertas suaves</b>${res.alertas.length?weeklyLista(res.alertas):'<p class="mute" style="margin:4px 0">Sin choques por ahora.</p>'}</div></div>
    <div class="row" style="margin-top:10px"><button class="btn sec" onclick="chatAskWeek()">Pregúntale a Arvis sobre tu semana</button>
      ${suave?'<button class="btn" onclick="applySoft()">Activar modo suave</button>':''}
      <button class="lnk" onclick="go('semana')">Ver calendario</button></div></div>`;
}
function dismissWeeklySummary(){
  S.weeklySummary=S.weeklySummary&&typeof S.weeklySummary==='object'?S.weeklySummary:{dismissedWeek:null};
  S.weeklySummary.dismissedWeek=mondayOf(today());save();render();
}
function viewInicio(){
  const name=S.profile&&S.profile.name?esc(S.profile.name):'';
  const descs={planificacion:'Tu día y tu semana, sin sobrecargas.',academico:'Ramos, fechas, notas y carga.',bienestar:'Check-in, pausas y apoyo.',social:'Coordina sesiones con amigos.',ajustes:'Perfil, tema y privacidad.'};
  const icons=(typeof HOME_ICONS!=='undefined')?HOME_ICONS:[];
  const order=['bienestar','academico','planificacion','social','ajustes'];
  const cards=order.map(k=>SECTIONS.find(s=>s.key===k)).filter(Boolean).map(s=>{
    const i=SECTIONS.indexOf(s)-1;
    return `<button class="home-card" onclick="go('${s.tabs[0][0]}')">
    <span class="home-icon">${icons[i]||''}</span>
    <span class="home-copy"><b>${s.label}</b><span>${descs[s.key]||''}</span></span>
    <span class="home-arrow" aria-hidden="true">→</span></button>`}).join('');
  return `${screenHelp('inicio')}
  ${isInstitutional()?`<div class="inst-inicio"><span class="inst-identity"><b>${esc(currentInstitution().name)}</b></span><span class="tag inst-example">Prototipo</span></div>`:''}
  <div class="home-head"><div><h2>Hola, ${name}</h2><p class="mute" style="margin-bottom:0">Elige por dónde empezar hoy.</p></div></div>
  ${arvisInicioHtml()}
  ${weeklyInicioHtml()}
  ${institutionDoneNotice()}
  ${homeNotice()}
  ${arvisAlertaHtml()}
  <div class="home-menu">${cards}</div>`;
}
function viewPerfil(){
  const p=S.profile||{},inst=typeof isInstitutional==='function'&&isInstitutional()?currentInstitution():null;
  const u=inst?inst.name:(p.university||'');
  const universityField=inst
    ?`<label>Universidad<input id="pf-university" type="text" value="${esc(u)}" disabled aria-describedby="pf-university-help"></label>
      <p class="mute" id="pf-university-help" style="margin:0">En modo institucional la universidad la define tu cuenta (${esc(inst.name || u)}) y no se puede cambiar aquí.</p>`
    :`<label>Universidad<select id="pf-university" data-focus-id="pf-university">
        <option value="" ${!u?'selected':''}>Sin definir</option>
        ${UNIVERSITIES_CHILE.map(x=>`<option value="${esc(x)}" ${u===x?'selected':''}>${esc(x)}</option>`).join('')}
        <option value="${esc(UNIVERSITY_OTHER)}" ${u===UNIVERSITY_OTHER?'selected':''}>${esc(UNIVERSITY_OTHER)}</option>
        <option value="${esc(UNIVERSITY_PREFERS_NOT)}" ${u===UNIVERSITY_PREFERS_NOT?'selected':''}>${esc(UNIVERSITY_PREFERS_NOT)}</option>
      </select></label>
      <p class="mute" style="margin:0">Opcional. Solo se usa, si activas las estadísticas anónimas o envías un comentario, como dato general: nunca se liga a tu correo ni a tu cuenta de Amigos.</p>`;
  return `${screenHelp('perfil')}<div class="card"><h2>Perfil</h2>
    <p class="mute" style="margin-top:0">Tu nombre, tu carrera y tu universidad se guardan solo en este navegador y sirven para personalizar el saludo y el plan.</p>
    <div class="hud-form" style="max-width:520px">
      <label>Nombre<input id="pf-name" type="text" maxlength="60" value="${esc(p.name||'')}"></label>
      <label>Carrera / Programa<input id="pf-career" type="text" maxlength="80" value="${esc(p.career||'')}"></label>
      ${universityField}
      <label>¿A qué hora del día te concentras mejor?${chronotypeOptions('pf-chronotype',(S.settings&&S.settings.chronotype)||'no_se')}</label>
      <p class="mute" style="margin:0">Opcional. Solo etiquetamos tus tareas según tu franja; no asumimos horas exactas.</p>
      <button class="btn" data-focus-id="save-profile" onclick="saveProfile()">Guardar cambios</button>
    </div></div>`;
}
function viewCuenta(){
  const a=S.account||accountBlank(),i=typeof currentInstitution==='function'?currentInstitution():null;
  const modo=a.type==='institucional'?'Institucional':'Personal';
  return `${screenHelp('cuenta')}<div class="card"><h2>Cuenta</h2>
    <p class="mute" style="margin-top:0">Cambiar de modo no borra ningún dato: solo cambia la apariencia, los contactos precargados y el calendario institucional.</p>
    <div class="account-status"><span class="tag">Modo: <b>${modo}</b></span>
      ${i?`<span class="inst-identity"><b>${esc(i.name)}</b></span>`:'<span class="mute">Sin universidad vinculada</span>'}</div>
    ${i?`<p class="mute">Correo: ${esc(a.email||'—')} · Vinculada el ${a.linkedAt?dshort(a.linkedAt):'—'}</p>
      <p>${esc(i.name)} <span class="tag inst-example">Prototipo</span></p>`:''}
    <div class="row">
      ${i?'<button class="btn del" onclick="disconnectInstitution()">Desconectar de mi universidad</button>'
        :'<button class="btn" data-focus-id="connect-institution" onclick="startInstitutionalFlow(\'cuenta\')">Conectar con mi universidad</button>'}
    </div>
    ${i&&a.auth?`<div class="inst-session-actions"><h3>Sesión universitaria</h3>
      <div class="row"><button class="btn sec" data-focus-id="inst-logout" onclick="instLogout()">Cerrar sesión</button>
        <button class="btn sec" data-focus-id="inst-change-password" onclick="instStartChangePassword()">Cambiar contraseña</button></div>
      ${instPwMode==='change'?`<div class="hud-form inst-change-pass" style="margin-top:10px;max-width:520px">
        <label>Contraseña actual<span class="pass-field"><input id="inst-current-pass" type="password" autocomplete="current-password"><button type="button" class="btn sec inst-pass-toggle" onclick="instTogglePass('inst-current-pass',this)" aria-label="Mostrar contraseña">Ver</button></span></label>
        <label>Nueva contraseña<span class="pass-field"><input id="inst-new-pass" type="password" autocomplete="new-password"><button type="button" class="btn sec inst-pass-toggle" onclick="instTogglePass('inst-new-pass',this)" aria-label="Mostrar contraseña">Ver</button></span></label>
        <label>Repite la nueva contraseña<span class="pass-field"><input id="inst-new-pass2" type="password" autocomplete="new-password"><button type="button" class="btn sec inst-pass-toggle" onclick="instTogglePass('inst-new-pass2',this)" aria-label="Mostrar contraseña">Ver</button></span></label>
        <div class="row"><button class="btn" data-focus-id="inst-save-password" onclick="instSaveNewPassword()">Guardar contraseña</button>
          <button class="btn sec" onclick="instCancelChangePassword()">Cancelar</button></div></div>`:''}
      </div>`:''}
    ${i?`<div class="inst-account-data"><h3>Datos importados</h3>
      <p class="mute" style="margin-top:0">La importación desde la UdeC es simulada (Datos de ejemplo): ramos, horario, fechas y notas, sin red y sin tocar tus datos de bienestar.</p>
      <div class="row"><button class="btn sec" data-focus-id="reimport-institution" onclick="startInstitutionImport('cuenta')">Volver a importar desde la UdeC</button>
        <button class="btn del" data-focus-id="remove-institution-data" onclick="removeInstitutionData()">Quitar los datos importados</button></div>
      ${instImportNotice?`<p class="mute">${esc(instImportNotice)}</p>`:''}</div>`:''}
    </div>
    ${institutionDoneNotice()}`;
}
function consentCard(){
  return `<div class="card"><h3>Antes de empezar: tus datos de bienestar</h3>
    <p style="margin-top:0">El check-in y el diario guardan datos sensibles (energía, ánimo, sueño y notas). Así funcionan:</p>
    <ul style="margin:0 0 10px 18px;padding:0">
      <li>Se guardan <b>solo en este navegador</b>. Aunque actives Amigos, estos datos nunca se envían al servidor ni están cifrados: si compartes este equipo, quizá no convenga usarlo.</li>
      <li>Los usa la propia app para ajustar tu plan y mostrarte patrones. No hay diagnósticos, puntajes ni rachas.</li>
      <li>Puedes exportarlos, revocar el permiso o borrarlos cuando quieras (en <i>Ajustes → Privacidad</i>).</li>
    </ul>
    <div class="row"><button class="btn" onclick="setConsent(true)">Acepto y quiero usar el check-in</button>
    <button class="btn sec" onclick="setConsent(false)">Ahora no</button></div>
    <p class="mute" style="margin-bottom:0">Sin check-in la app igual funciona: calcula tu capacidad con tus clases y tu ritmo.</p></div>`;
}
function scaleRow(label,key,arr){
  return `<div class="ci-row"><b>${label}</b><div class="scale">${arr.map((x,i)=>`<button class="sc ${draft[key]===i+1?'on':''}" data-focus-id="ci-${key}-${i+1}" aria-pressed="${draft[key]===i+1}" onclick="setCi('${key}',${i+1})"><span>${x[0]}</span>${x[1]}</button>`).join('')}</div></div>`;
}
function checkinForm(full){
  if(!S.consent)return consentCard();
  if(!S.consent.health)return `<div class="card"><h3>Check-in diario</h3><p class="mute">Está desactivado: tu plan usa solo tus clases y tu ritmo.</p><button class="btn sec" onclick="resetConsent()">Ver cómo funciona y activarlo</button></div>`;
  if(!draft)loadDraft();
  const e=ci(today());
  if(e&&!ciEdit&&!full)return `<div class="card"><div class="row" style="justify-content:space-between"><span><b>Check-in de hoy</b> · Energía ${ENERGY[e.energy-1][1].toLowerCase()} · Ánimo ${MOODS[e.mood-1][1].toLowerCase()} · Sueño ${SLEEP[e.sleep-1][1]}</span><button class="btn sec" onclick="editCi()">Cambiar</button></div></div>`;
  return `<div class="card"><h3>Check-in de hoy <span class="mute">· 20 segundos</span></h3>
    ${scaleRow('¿Cuánta energía tienes?','energy',ENERGY)}${scaleRow('¿Cómo está tu ánimo?','mood',MOODS)}${scaleRow('¿Cuánto dormiste anoche?','sleep',SLEEP)}
    ${full?`<p class="mute" style="margin:10px 0 6px">¿Qué hay detrás? (opcional)</p>
      <div class="row" style="gap:6px">${FEEL_TAGS.map(t=>`<button class="tag sel ${draft.tags.includes(t)?'on':''}" data-focus-id="tag-${norm(t)}" aria-pressed="${draft.tags.includes(t)}" onclick="toggleTag('${t}')">${t}</button>`).join('')}</div>
      <textarea style="margin-top:10px" placeholder="Si quieres, escribe cómo estuvo tu día…" oninput="draft.note=this.value">${esc(draft.note)}</textarea>`:''}
    <div class="row" style="margin-top:8px"><button class="btn" onclick="saveCheckin()">${e?'Actualizar':'Guardar'} y ajustar mi plan</button>
      ${e&&ciEdit&&!full?'<button class="btn sec" onclick="ciEdit=false;render()">Cancelar</button>':''}</div>
    <p class="mute" style="margin-bottom:0">Con esto ajusto tu capacidad de hoy y reacomodo las tareas por ti.</p></div>`;
}
function energyBoxes(cap,min,done){
  const n=Math.ceil(cap/25),minIdx=Math.min(n-1,Math.ceil(min/25)-1),locked=done>=cap;
  let h='<div class="boxes">';
  for(let i=0;i<n;i++){
    const f=clamp((done-i*25)/25,0,1);
    h+=`<div class="box ${i===minIdx?'min':''} ${i===n-1?'last':''} ${locked?'lockd':''}" style="--f:${f*100}%"></div>`;
  }
  return h+'</div><div class="mute">Cada caja = 25 min. Borde ámbar = tu mínimo de hoy. Última caja = tu capacidad de hoy.</div>';
}
const evDate=t=>{const e=S.events.find(x=>x.id===t.eventId);return e?e.date:'9999'};
function taskRow(t,locked){
  const deck=t.kind==='recuperar'&&(S.tools&&S.tools.flashcards&&S.tools.flashcards.decks||[]).find(d=>d.courseId===t.courseId);
  const fcBtn=deck?`<button class="btn sec" data-focus-id="fc-task-${t.id}" onclick="openCourseFlashcards('${t.courseId}')">Repasar flashcards de este ramo</button>`:'';
  const kind=t.kind?`<span class="tag">${esc(KIND_LABEL[t.kind]||t.kind)}</span>`:'';
  const chrono=t.chrono?`<br><span class="mute">${esc(t.chrono)}</span>`:'';
  const hint=needsInterleave(t)?`<br><span class="mute">${esc(EVIDENCE.plan.interleaveHint)}</span>`:'';
  return `<div class="task ${t.done?'done':''}"><input type="checkbox" aria-label="${t.done?'Marcar como pendiente':'Marcar como hecha'}: ${esc(t.title)}" data-focus-id="task-${t.id}" ${t.done?'checked':''} ${locked&&!t.done?'disabled':''} onchange="toggleTask('${t.id}')">
    <span aria-hidden="true" class="dot" style="background:${ccolor(t.courseId)}"></span>
    <span class="t" style="flex:1">${esc(t.title)}<br><span class="mute">${esc(cname(t.courseId))}${chrono}${hint}</span></span>${kind}<span class="tag">${t.minutes} min</span>${fcBtn}</div>`;
}
function agendaItems(date){
  const items=[],wd=(parse(date).getDay()+6)%7;
  S.classes.filter(k=>k.day===wd).forEach(k=>items.push({time:k.start,order:0,
    html:`<b>${esc(cname(k.courseId))}</b><br><span class="mute">Clase ${k.start}–${k.end}</span>`}));
  S.events.filter(e=>e.date===date).forEach(e=>items.push({time:e.type==='evaluacion'?('9:00'):'',order:1,
    html:`<b>${TYPE_LABEL[e.type]} · ${esc(cname(e.courseId))}</b><br><span class="mute">${esc(e.title)}</span>`}));
  S.tasks.filter(t=>t.date===date).forEach(t=>items.push({time:'',order:2,done:t.done,
    html:`<b>${esc(t.title)}</b><br><span class="mute">${esc(cname(t.courseId))}${t.kind?` · ${esc(KIND_LABEL[t.kind]||t.kind)}`:''}${t.chrono?` · ${esc(t.chrono)}`:''} · ${t.minutes} min</span>`}));
  if(typeof socialAgendaItems==='function')socialAgendaItems(date).forEach(x=>items.push(x));
  return items.sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||a.order-b.order);
}
function agendaHtml(date,title){
  const items=agendaItems(date);
  return `<div class="card agenda-card"><h3>${esc(title)}</h3>${items.length?`<div class="agenda">${items.map(x=>
    `<div class="agenda-item ${x.done?'done':''}"><span class="agenda-time">${x.time?esc(x.time):'—'}</span><span>${x.html}</span></div>`).join('')}</div>`:'<div class="empty">Sin compromisos ni estudio planificado.</div>'}</div>`;
}
function certamenOffersHtml(){
  const cs=certCandidates();if(!cs.length)return '';
  return `<div class="card" id="certamen-offers"><h3>Preparar en modo certamen</h3>
    <p class="mute" style="margin-top:0">Faltan 7 días o menos. Puedes cambiar las micro-tareas por un plan por fases; no se activa solo.</p>
    ${cs.map(e=>`<div class="task"><span aria-hidden="true" class="dot" style="background:${ccolor(e.courseId)}"></span>
      <span style="flex:1"><b>${esc(e.title)}</b><br><span class="mute">${esc(cname(e.courseId))} · ${dshort(e.date)} · ${diffDays(today(),e.date)} día(s)</span></span>
      <button class="btn sec" data-focus-id="cert-open-${e.id}" onclick="openCertamen('${e.id}')">Preparar en modo certamen</button></div>`).join('')}</div>`;
}
function certamenDraftHtml(){
  if(!certDraft)return '';
  const ev=S.events.find(e=>e.id===certDraft.eventId);if(!ev)return '';
  return `<div class="card" id="certamen-draft"><h3>Preparar en modo certamen · ${esc(ev.title)}</h3>
    <p class="mute" style="margin-top:0">Escribe los temas que entran. Marca <b>Me cuesta</b> para priorizarlos en ejercicios y repaso.</p>
    ${certDraft.topics.map(t=>`<div class="task" style="flex-wrap:wrap">
      <input aria-label="Tema que entra en la evaluación" style="flex:1;min-width:160px" maxlength="80" value="${esc(t.name)}" onchange="certSetTopic('${t.id}','name',this.value)">
      <label class="mute"><input type="checkbox" ${t.hard?'checked':''} onchange="certSetTopic('${t.id}','hard',this.checked)"> Me cuesta</label>
      <button class="btn del" data-focus-id="cert-del-${t.id}" onclick="certRemoveTopic('${t.id}')">Quitar</button></div>`).join('')}
    <div class="row" style="margin-top:8px"><button class="btn sec" data-focus-id="cert-add-topic" onclick="certAddTopic()">Agregar tema</button></div>
    <div class="row" style="margin-top:8px"><label class="mute">Ensayo cronometrado <input id="cert-mock" type="number" min="30" max="240" step="15" style="width:90px" value="${certDraft.mockMin}" onchange="certSetMock(this.value)"> min</label></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-focus-id="cert-activate" onclick="activateCertamen()">Activar modo certamen</button>
      <button class="btn sec" onclick="certCancelDraft()">Cancelar</button></div></div>`;
}
function certamenActiveHtml(){
  const planes=certPlans().filter(p=>S.events.some(e=>e.id===p.eventId&&e.date>=today()));
  if(!planes.length)return '';
  return planes.map(p=>{
    const ev=S.events.find(e=>e.id===p.eventId);
    const tasks=S.tasks.filter(t=>t.certamen&&t.eventId===p.eventId);
    const rows=p.topics.map(t=>{
      const cell=phase=>{
        const task=tasks.find(x=>x.topicId===t.id&&x.phase===phase),label=CERT_PHASES[phase].toLowerCase();
        if(!task)return `<span class="mute">${label}: sin bloque</span>`;
        const kind=task.kind?` · ${esc(KIND_LABEL[task.kind]||task.kind)}`:'';
        return `<label class="mute"><input type="checkbox" aria-label="${esc(t.name)}: ${label}" data-focus-id="cert-${t.id}-${phase}" ${task.done?'checked':''} onchange="toggleTask('${task.id}')"> ${label}${kind}</label>`;
      };
      return `<div class="task" style="flex-wrap:wrap"><b style="flex:1;min-width:140px">${esc(t.name)}${t.hard?' <span class="tag">me cuesta</span>':''}</b>
        <span class="row" style="gap:10px">${cell('teoria')}${cell('ejercicios')}${cell('repaso')}</span></div>`;
    }).join('');
    const hint=tasks.some(t=>needsInterleave(t))?`<p class="mute">${esc(EVIDENCE.plan.interleaveHint)}</p>`:'';
    const mock=tasks.find(x=>x.phase==='ensayo'),next=tasks.find(x=>!x.done&&x.date>=today());
    const decks=(S.tools&&S.tools.flashcards&&S.tools.flashcards.decks||[]).filter(d=>d.courseId===p.courseId);
    const deckBtn=decks.length?`<button class="btn sec" data-focus-id="cert-flashcards-${p.eventId}" onclick="openCourseFlashcards('${p.courseId}')">Repasar flashcards de este ramo</button>`:'';
    const pomBtn=next?`<button class="btn sec" data-focus-id="cert-pomodoro-${p.eventId}" onclick="startCertPomodoro('${p.eventId}','${next.id}')">Empezar con Pomodoro</button>`:'';
    const left=p.leftOut&&p.leftOut.length?`<div class="banner info">Quedó fuera de este repaso: ${p.leftOut.map(x=>`${esc(x.label)} (${x.minutes} min)`).join(', ')}. Prioricé el ensayo y los temas difíciles; no hay nada que compensar.</div>`:'';
    return `<div class="card" id="certamen-plan-${p.eventId}"><div class="row" style="justify-content:space-between">
      <h3 style="margin:0">Modo certamen · ${esc(p.title)}</h3>
      <button class="btn sec" data-focus-id="cert-exit-${p.eventId}" onclick="exitCertamen('${p.eventId}')">Salir del modo certamen</button></div>
      <p class="mute">${dshort(ev.date)} · ${diffDays(today(),ev.date)} día(s) · ensayo de ${p.mockMin} min${mock?` (${dshort(mock.date)})`:''}</p>
      <p class="mute">Recordar sin mirar: escribe lo que sabes y luego revisa. Repetir en días distintos ayuda a retener.</p>
      ${rows}
      ${hint}
      <div class="row" style="margin-top:10px">${deckBtn}${pomBtn}<button class="btn sec" onclick="goBreath('s478')">Pausa nocturna 4-7-8 (opcional)</button></div>
      ${left}
      <p class="mute" style="margin-bottom:0">La noche anterior solo hay repaso ligero y la pausa que ya está en Pausas: nada de contenido nuevo.</p>
    </div>`;
  }).join('');
}
function viewHoy(){
  const t0=today(),info=capInfo(t0),cap=info.val,min=minFor(t0),done=doneToday(),locked=done>=cap,met=done>=min,low=lowMode(t0);
  const todays=S.tasks.filter(t=>t.date===t0).sort((a,b)=>a.done-b.done||evDate(a).localeCompare(evDate(b)));
  const pend=todays.filter(t=>!t.done);
  const nxt=S.tasks.filter(t=>!t.done&&t.date>t0).sort((a,b)=>a.date.localeCompare(b.date))[0];
  let banner;
  if(locked)banner=`<div class="banner lock"><b>Cuota completada.</b> Hoy no se asigna materia nueva. Descansar ya es parte del plan: no hay nada que compensar ni de qué sentirse culpable.</div>`;
  else if(met)banner=`<div class="banner min"><b>Lo esencial de hoy está hecho.</b> Puedes seguir hasta ${cap-done} min más o cerrar el día con tranquilidad.</div>`;
  else if(low)banner=`<div class="banner soft">Hoy es un día de energía baja: <b>solo lo esencial</b>. Te faltan ${min-done} min; con eso el día cuenta.</div>`;
  else banner=`<div class="banner go">Te faltan <b>${min-done} min</b> para tu mínimo de hoy. Con una micro-tarea corta ya avanzas.</div>`;
  const notes=[];
  if(S.adapt&&S.adapt.date===t0){
    if(S.adapt.low)notes.push(`Según tu check-in, hoy dejé solo lo esencial (${min} min)${S.adapt.n?` y moví ${S.adapt.n} micro-tarea(s) a otros días`:''}. No tienes que reorganizar nada.`);
    else if(S.adapt.n)notes.push(`Ajusté tu plan según tu check-in: moví ${S.adapt.n} micro-tarea(s) para cuidar tu energía.`);
  }
  if(S.moved&&S.moved.date===t0)notes.push(`Reacomodé ${S.moved.n} micro-tarea(s) que quedaron de días anteriores. Ya están repartidas en los próximos días; no se acumula nada.`);
  let rows='',acc=0;
  todays.forEach((t,i)=>{
    rows+=taskRow(t,locked);
    if(!t.done){acc+=t.minutes;if(acc>=50&&todays.slice(i+1).some(x=>!x.done)){rows+=`<div class="pause">🌿 <span style="flex:1">Pausa de 5 min: estírate o haz 1 minuto de respiración.</span><button class="btn sec" onclick="goBreath('larga')">Respirar</button></div>`;acc=0}}
  });
  const opts=S.courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  return `${screenHelp('hoy')}
  ${arvisMomentoHtml()}${arvisEstudiandoHtml()}${arvisAlertaHtml()}
  ${!S.courses.length?arvisVacioHtml('ramos'):''}
  ${!S.courses.length?'<div class="card empty">Aún no tienes ramos. Agrégalos en "Ramos" o <button class="btn" onclick="go(\'ejemplos\')">carga datos de ejemplo</button></div>':''}
  ${warnHtml()}${criticalHtml()}
  ${certamenOffersHtml()}${certamenDraftHtml()}${certamenActiveHtml()}
  ${S.soft&&softOn(t0)?`<div class="banner soft">Modo suave activo hasta el ${dshort(S.soft.until)}: tu carga está al 75%. <button class="lnk" onclick="endSoft()">Desactivar</button></div>`:''}
  ${notes.map(n=>`<div class="banner info">${n}</div>`).join('')}
  ${socialTodayHtml()}
  ${backupHtml()}
  ${agendaHtml(t0,'Agenda de hoy')}
  <div class="card"><h2>Hoy</h2>
    <div class="stats">
      <div class="stat"><b>${done}'</b><span class="mute">estudiados hoy</span></div>
      <div class="stat"><b>${min}'</b><span class="mute">mínimo de hoy</span></div>
      <div class="stat"><b>${cap}'</b><span class="mute">capacidad de hoy</span></div>
    </div>
    ${banner}${energyBoxes(cap,min,done)}
    <details><summary>¿Cómo se calculó mi capacidad de hoy?</summary><ul>${capExplain(info).map(x=>`<li>${x}</li>`).join('')}</ul></details>
  </div>
  <div class="grid2">
    <div class="card"><h3>Plan de hoy</h3>
      ${rows||`${arvisVacioHtml('tareas')}<div class="empty">No hay micro-tareas para hoy. Agrega ramos y fechas en <b>Académico &gt; Fechas</b> para generar tu plan, o registra estudio libre.</div>`}
      ${locked?'<p class="mute">No se adelanta ni se asigna más materia hoy.</p>':
        (low?'<p class="mute">Hoy no hace falta adelantar nada.</p>':(!pend.length&&nxt?`<button class="btn sec" onclick="pullNext()">Adelantar la siguiente micro-tarea (${nxt.minutes} min)</button>`:''))}
    </div>
    <div>
      ${pauseCard()}
      <div class="card"><h3>Registrar estudio libre</h3>
        <div class="row"><select id="fc">${opts}</select><input id="fm" type="number" min="5" step="5" value="25" style="width:80px"> min
        <button class="btn" ${locked||!S.courses.length?'disabled':''} onclick="logFree()">Registrar</button></div>
      </div>
      <div class="card"><h3>Mi mínimo viable (día normal)</h3>
        <div class="row"><input id="smin" type="number" value="${S.settings.min}" style="width:80px"> min
        <button class="btn sec" data-focus-id="set-min" onclick="setMin()">Guardar</button></div>
        <p class="mute" style="margin-bottom:0">La capacidad máxima ya no es un número fijo: se calcula cada día.</p>
      </div>
    </div>
  </div>`;
}
function viewSemana(){
  const days=[...Array(7)].map((_,i)=>addDays(weekStart,i)),t0=today(),H0=7,H1=22,HH=44;
  const crit=criticalClusters(),isCrit=d=>crit.some(g=>d>=g.start&&d<=g.end);
  let h=`${screenHelp('semana')}${weeklyCardHtml()}<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:10px">
    <h2 style="margin:0">Semana ${dshort(days[0])} – ${dshort(days[6])}</h2>
    <div class="row"><button class="btn sec" aria-label="Semana anterior" onclick="weekStart=addDays(weekStart,-7);render()">←</button>
    <button class="btn sec" onclick="weekStart=mondayOf(today());render()">Hoy</button>
    <button class="btn sec" aria-label="Semana siguiente" onclick="weekStart=addDays(weekStart,7);render()">→</button></div></div>
    <div class="mute" style="margin-bottom:8px">Subrayado ámbar = tramo exigente (3 fechas importantes en 5 días).</div>
    <div class="calwrap"><div class="cal">`;
  h+='<div class="hd"></div>'+days.map((d,i)=>{const im=institutionDayMark(d);return `<div class="hd ${d===t0?'today':''} ${isCrit(d)?'crit':''} ${im?'inst-day '+im.cls:''}" ${im?'title="'+esc(im.mark+' '+im.cls)+'"':''}>${DAYS[i]} ${parse(d).getDate()}${im?' '+im.mark:''}</div>`}).join('');
  h+='<div class="lbl">Fechas</div>'+days.map(d=>`<div>${S.events.filter(e=>e.date===d).map(e=>
    `<div class="chip" style="border-color:${ccolor(e.courseId)}" title="${esc(e.title)}"><b>${TYPE_LABEL[e.type]}</b> ${esc(cname(e.courseId))}<br>${esc(e.title)}</div>`).join('')}</div>`).join('');
  h+='<div class="lbl">Plan</div>'+days.map(d=>`<div>${S.tasks.filter(t=>t.date===d).map(t=>
    `<div class="chip ${t.done?'done':''}" style="border-color:${ccolor(t.courseId)}">${t.minutes}' ${esc(cname(t.courseId))}</div>`).join('')}<div class="mute">${dayLoad(d)||capFor(d)?dayLoad(d)+' / '+capFor(d)+' min':''}</div></div>`).join('');
  h+=`<div class="lbl" style="padding:0;position:relative;height:${(H1-H0)*HH}px">${[...Array(H1-H0)].map((_,i)=>`<div style="position:absolute;top:${i*HH}px;font-size:12px;padding-left:4px">${pad(H0+i)}:00</div>`).join('')}</div>`;
  h+=days.map((d,i)=>`<div class="col ${d===t0?'today':''}" style="height:${(H1-H0)*HH}px">${S.classes.filter(k=>k.day===i).map(k=>{
    const top=(toMin(k.start)-H0*60)/60*HH,ht=(toMin(k.end)-toMin(k.start))/60*HH;
    return `<div class="blk" style="top:${top}px;height:${ht}px;background:${ccolor(k.courseId)}">${esc(cname(k.courseId))}<br>${k.start}–${k.end}</div>`}).join('')}${socialWeekBlocks(d,i)}</div>`).join('');
  h+='</div></div></div>';
  h+='<div class="agenda-movil">'+days.map((d,i)=>agendaHtml(d,`${DAYS[i]} ${parse(d).getDate()}${d===t0?' · hoy':''}`)).join('')+'</div>';
  return h+institutionCalendarHtml(days)+criticalHtml();
}
const gradeTxt=v=>Number(v).toFixed(1).replace('.',',');
const roundedAvg=(v,on)=>v==null||!isFinite(v)?null:(on?Math.round((v+1e-9)*10)/10:Math.round(v*100)/100);
function nextCourseEvent(cid){
  return S.events.filter(e=>e.courseId===cid&&e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title))[0]||null;
}
function gradeSummary(grades,c){
  const gs=grades||[];let wsum=0,ws=0;gs.forEach(g=>{const w=+g.weight||0,s=+g.score||0;if(w>0){wsum+=w;ws+=s*w}});
  const avg=wsum?ws/wsum:null,pass=c&&Number.isFinite(c.passGrade)?c.passGrade:4,round=!c||c.roundFinal!==false;
  const rem=100-wsum;
  return {avg,wsum:Math.round(wsum*100)/100,rem:Math.round(rem*100)/100,pass,round,shown:roundedAvg(avg,round),need:rem>0?(pass*100-ws)/rem:null};
}
function gradesCard(c){
  const gs=c.grades||[],sum=gradeSummary(gs,c);
  const rows=gs.map(g=>`<tr><td><input data-focus-id="grade-${c.id}-${g.id}-name" value="${esc(g.name)}" onchange="setGrade('${c.id}','${g.id}','name',this.value)"></td>
    <td><input data-focus-id="grade-${c.id}-${g.id}-score" type="text" inputmode="decimal" style="width:90px" value="${comma(g.score)}" onchange="setGrade('${c.id}','${g.id}','score',this.value)"></td>
    <td><input data-focus-id="grade-${c.id}-${g.id}-weight" type="text" inputmode="decimal" style="width:80px" value="${comma(g.weight)}" onchange="setGrade('${c.id}','${g.id}','weight',this.value)">%</td>
    <td><button class="btn del" data-focus-id="del-grade-${g.id}" onclick="delGrade('${c.id}','${g.id}')">Quitar</button></td></tr>`).join('');
  const weightNote=Math.abs(sum.rem)>0.001?`<div class="banner info" style="margin:10px 0 0">${sum.rem>0
    ?`Faltan ${comma(String(sum.rem))} % de ponderación por registrar. Puedes completarlo cuando tengas las notas.`
    :`La ponderación registrada supera el 100 % en ${comma(String(Math.abs(sum.rem)))} %. Vale la pena revisarla, sin apuro.`}</div>`:'';
  let needMsg='';
  if(!gs.length)needMsg='<div class="mute" style="margin-top:6px">Registra una nota para ver cuánto necesitas en lo que queda.</div>';
  else if(sum.need==null)needMsg=sum.avg!=null&&sum.avg>=sum.pass
    ?'<div class="banner lock" style="margin:6px 0 0">Ya tienes el ramo aprobado con lo rendido.</div>'
    :'<div class="banner go" style="margin:6px 0 0">Con la ponderación registrada aún no alcanza la nota de aprobación. Si hay examen de repetición, puede ayudar revisarlo.</div>';
  else if(sum.need<=1)needMsg='<div class="banner lock" style="margin:6px 0 0">Ya tienes el ramo aprobado con lo rendido.</div>';
  else if(sum.need>7)needMsg=`<div class="banner soft" style="margin:6px 0 0">Necesitarías <b>${gradeTxt(sum.need)}</b> en lo que queda. Es una meta alta; quizá sirva revisar si hay examen de repetición o conversar con el docente.</div>`;
  else needMsg=`<div class="banner min" style="margin:6px 0 0">Nota necesaria en lo que queda: <b>${gradeTxt(sum.need)}</b> (misma nota en todas las evaluaciones pendientes).</div>`;
  const next=nextCourseEvent(c.id),needShown=sum.need==null||sum.need<=1?'1,0 como mínimo':gradeTxt(sum.need);
  const nextTxt=gs.length?`<div class="mute" style="margin-top:6px">${next
    ?`Próxima evaluación por fecha: <b>${esc(next.title)}</b> (${dshort(next.date)} · ${TYPE_LABEL[next.type]}) — nota necesaria en ella: <b>${needShown}</b>.`
    :'Aún no registraste una fecha próxima para este ramo; la misma nota aplica a lo que falte.'}</div>`:'';
  return `<div class="card grades-card"><div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><h3 style="margin:0"><span aria-hidden="true" class="dot" style="background:${c.color};display:inline-block;margin-right:6px"></span>${esc(c.name)}</h3>
      ${importedCourse(c)&&!hasSyllabus(c.id)?'<div class="course-tags"><span class="tag inst-pending">Syllabus pendiente</span></div>':''}
      <div class="mute">Promedio actual (ponderado): <b class="hud-num">${sum.shown!=null?comma(sum.shown.toFixed(sum.round?1:2)):'—'}</b> · Ponderado: ${comma(String(sum.wsum))}% · Restante: ${comma(String(Math.max(0,sum.rem)))}%</div>
      <div class="row" style="margin-top:8px"><label class="mute">Nota de aprobación <input id="gp-${c.id}" type="text" inputmode="decimal" style="width:70px" value="${gradeTxt(sum.pass)}" onchange="setGradeOption('${c.id}','passGrade',this.value)"></label>
        <label class="mute"><input type="checkbox" ${sum.round?'checked':''} onchange="setGradeOption('${c.id}','roundFinal',this.checked)"> Redondear promedio a 1 decimal</label></div></div></div>
      ${weightNote}
      <div style="margin-top:12px"><b>Nota necesaria para aprobar</b>${needMsg}${nextTxt}</div>
    ${gs.length?`<table class="grades-tbl"><tr><th>Evaluación</th><th>Nota</th><th>Pond.</th><th></th></tr>${rows}</table>`:'<div class="empty" style="margin-top:8px">Aún no hay evaluaciones. Completa los campos y toca <b>Agregar nota</b>.</div>'}
    <div class="row" style="margin-top:10px">
      <input id="gn-${c.id}" placeholder="Evaluación (ej. Certamen 1)">
      <input id="gs-${c.id}" type="text" inputmode="decimal" placeholder="Nota" style="width:90px">
      <input id="gw-${c.id}" type="text" inputmode="decimal" placeholder="%" style="width:80px">
      <button class="btn sec" data-focus-id="add-grade-${c.id}" onclick="addGrade('${c.id}')">Agregar nota</button></div></div>`;
}
function demoCardHtml(){
  return `<div class="card"><h3>Datos de ejemplo</h3>
    <div class="row"><button class="btn sec" data-focus-id="load-demo" onclick="loadDemo()">Cargar datos de ejemplo</button>
      <span class="mute">Reemplaza tus datos actuales. También está en Ajustes → Datos de ejemplo.</span></div></div>`;
}
const DIFFICULTY_HINTS={1:'Muy fácil',2:'Fácil',3:'Media',4:'Difícil',5:'Muy difícil'};
const difficultyOptions=selected=>[1,2,3,4,5].map(n=>`<option value="${n}" ${n===selected?'selected':''}>${n} · ${DIFFICULTY_HINTS[n]}</option>`).join('');
function viewRamos(){
  return `${screenHelp('ramos')}
  <div class="grid2">
    <div class="card"><h2>Ramos</h2>
      ${S.courses.map(c=>`<div class="task course-row"><span aria-hidden="true" class="dot" style="background:${c.color}"></span>
        <div class="course-main"><b class="course-name">${esc(c.name)}</b>
        ${importedCourse(c)&&!hasSyllabus(c.id)?'<div class="course-tags"><span class="tag inst-pending">Syllabus pendiente</span></div>':''}</div>
        <span class="diff-field"><label class="mute" for="diff-${c.id}">Dificultad percibida</label>
        <select id="diff-${c.id}" data-focus-id="diff-${c.id}" aria-label="Dificultad de ${esc(c.name)}" onchange="setDiff('${c.id}',this.value)">${difficultyOptions(c.difficulty)}</select></span>
        <button class="btn del" onclick="delCourse('${c.id}')">Eliminar</button></div>`).join('')||`${arvisVacioHtml('ramos')}<div class="empty">Aún no tienes ramos. Escribe el nombre y toca <b>Agregar</b> para crear tu primer ramo.</div>`}
      <div class="row form-stack" style="margin-top:10px"><input id="cn" placeholder="Nombre del ramo">
        <span class="diff-field"><label for="cd">Dificultad percibida</label>
          <select id="cd" title="Dificultad percibida">${difficultyOptions(3)}</select></span>
        <button class="btn" data-focus-id="add-course" onclick="addCourse()">Agregar</button></div>
      <p class="mute">La dificultad percibida es qué tan pesado sientes el ramo, de 1 a 5. Más dificultad = más minutos de preparación, más días de margen y micro-tareas más cortas.</p>
    </div>
    <div class="card"><h2>Horario de clases</h2>
      <div class="row"><select id="kc">${S.courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
        <select id="kd">${DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select>
        <input id="ka" type="time" value="08:10"><input id="kb" type="time" value="09:40">
        <button class="btn" data-focus-id="add-class" onclick="addClass()">Agregar</button></div>
      <div class="row" style="margin-top:8px"><label class="btn sec" style="cursor:pointer">Importar desde calendario (.ics)<input type="file" accept=".ics,text/calendar" style="display:none" onchange="onICSFile(this)"></label></div>
      ${icsPendingHtml()}
      <div style="margin-top:8px">${S.classes.map(k=>`<div class="task"><span aria-hidden="true" class="dot" style="background:${ccolor(k.courseId)}"></span>
        <span style="flex:1">${esc(cname(k.courseId))} · ${DAYS[k.day]} ${k.start}–${k.end}</span><button class="btn del" onclick="delClass('${k.id}')">Quitar</button></div>`).join('')}</div>
      <p class="mute">Tus horas de clase definen cuánto puedes estudiar cada día.</p>
    </div>
  </div>
  ${demoCardHtml()}`;
}
function viewSyllabus(){
  const opts=S.courses.map(c=>`<option value="${c.id}" ${c.id===sylCourse?'selected':''}>${esc(c.name)}</option>`).join('');
  const sorted=[...S.events].sort((a,b)=>a.date.localeCompare(b.date));
  return `${screenHelp('syllabus')}
  ${S.courses.filter(c=>importedCourse(c)&&!hasSyllabus(c.id)).length?`<div class="banner info inst-syllabus-pending"><b>Syllabus pendiente</b><br>
    ${S.courses.filter(c=>importedCourse(c)&&!hasSyllabus(c.id)).map(c=>esc(c.name)).join(', ')}. Sube el syllabus de cada ramo para afinar las fechas. <span class="tag inst-example">Datos de ejemplo</span></div>`:''}
  ${certamenOffersHtml()}${certamenDraftHtml()}${certamenActiveHtml()}
  ${aiSyllabusOn()?aiSyllabusHtml():''}
  <div class="card"><h2>Subir syllabus</h2>
    <div class="row form-stack" style="margin-bottom:8px"><select onchange="sylCourse=this.value"><option value="">Ramo…</option>${opts}</select>
      <div class="file-pick"><label class="btn sec" for="syl-file">Elegir archivo (PDF o texto)</label>
        <input id="syl-file" class="file-input" type="file" accept=".pdf,.txt,.md,.csv" onchange="showFileLabel(this);onFile(this)">
        <span class="file-name mute">Ningún archivo</span></div></div>
    <textarea placeholder="…o pega aquí el texto del syllabus (calendario de evaluaciones)" oninput="sylText=this.value">${esc(sylText)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn" onclick="analyze()">Analizar syllabus</button>
      <span class="mute">La lectura automática puede equivocarse: siempre te pido confirmar antes de agregar.</span></div>
    ${pending.length?`<h3 style="margin-top:14px">Fechas detectadas · revisa y corrige antes de agregar</h3>
      <table><tr><th></th><th>Fecha</th><th>Tipo</th><th>Descripción</th></tr>
      ${pending.map((p,i)=>`<tr><td><input type="checkbox" ${p.keep?'checked':''} onchange="setPending(${i},'keep',this.checked)"></td>
        <td><input type="date" value="${p.date}" onchange="setPending(${i},'date',this.value)"></td>
        <td><select onchange="setPending(${i},'type',this.value)">${Object.entries(TYPE_LABEL).map(([k,v])=>`<option value="${k}" ${k===p.type?'selected':''}>${v}</option>`).join('')}</select></td>
        <td><input style="width:100%" value="${esc(p.title)}" onchange="setPending(${i},'title',this.value)">${p.note?`<div class="mute">⚠ ${esc(p.note)}</div>`:''}</td></tr>`).join('')}</table>
      <button class="btn" style="margin-top:8px" onclick="addPending()">Confirmar y agregar al calendario</button>`:''}
  </div>
  <div class="card"><h2>Fechas</h2>
    <div class="row form-stack" style="margin-bottom:8px"><select id="ec"><option value="">Ramo…</option>${S.courses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <input id="et" placeholder="Título"><input id="ed" type="date">
      <select id="ey">${Object.entries(TYPE_LABEL).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>
      <button class="btn" data-focus-id="add-event" onclick="addEvent()">Agregar manualmente</button>
      <button class="btn sec" onclick="exportICS()" ${S.events.length?'':'disabled'}>Exportar a calendario (.ics)</button></div>
    ${sorted.map(e=>`<div class="task"><span aria-hidden="true" class="dot" style="background:${ccolor(e.courseId)}"></span>
      <span style="flex:1">${dshort(e.date)} · <b>${TYPE_LABEL[e.type]}</b> · ${esc(cname(e.courseId))} — ${esc(e.title)}${e.early?' <span class="tag">margen extra</span>':''}</span>
      <button class="btn del" onclick="delEvent('${e.id}')">Quitar</button></div>`).join('')||'<div class="empty">Aún no hay fechas registradas. Analiza un syllabus o usa el formulario y toca <b>Agregar manualmente</b>.</div>'}
   </div>
   ${demoCardHtml()}`;
}
function viewNotas(){
  return `${screenHelp('notas')}<div class="card"><h2>Notas</h2>
    <p class="mute" style="margin-top:0">Registra evaluaciones por ramo con su nota y ponderación (%). Puedes escribir 5,5 o 5.5: siempre mostramos coma decimal. Por ramo puedes ajustar la nota de aprobación (4,0 por defecto) y el redondeo del promedio a un decimal.</p>
    ${S.courses.length?S.courses.map(gradesCard).join(''):'<div class="empty">Aún no tienes ramos. Ve a <b>Académico &gt; Ramos</b> y toca <b>Agregar</b> para crear uno.</div>'}
  </div>`;
}
function viewDatosEjemplo(){
  return `${screenHelp('ejemplos')}<div class="card"><h2>Datos de ejemplo</h2>
    <p class="mute" style="margin-top:0">Carga ramos, clases, fechas, sesiones pasadas y registros de bienestar falsos para recorrer la app sin datos personales. Reemplaza tus datos actuales.</p>
    <div class="row"><button class="btn sec" onclick="loadDemo()">Cargar datos de ejemplo</button>
    <span class="mute">Las demás opciones de datos están en Ajustes → Privacidad, donde también puedes descargar un respaldo antes.</span></div></div>`;
}
function trend(key,label,color){
  const dates=[...Array(14)].map((_,i)=>addDays(today(),i-13));
  return `<div class="mute">${label}</div><div class="trend">${dates.map(d=>{const e=ci(d);const v=e?e[key]:0;
    return `<i title="${dshort(d)}${v?': '+v+' de 5':': sin registro'}" style="height:${v?v*20:5}%;background:${v?color:'var(--line)'}"></i>`}).join('')}</div>`;
}
function evidenceHtml(){
  const s=EVIDENCE.sources;
  return `<div class="card"><h3>¿En qué se basa?</h3>
    <p class="mute" style="margin-top:0">Esta app no es tratamiento ni diagnóstico. Reúne hallazgos generales y los convierte en reglas simples que se adaptan con tus propios datos.</p>
    <ul>
      <li><b>Sueño y capacidad:</b> ${s.sleepDebt} ${s.individualSleep}</li>
      <li><b>Práctica distribuida y recuperación:</b> ${s.spacing} ${s.retrieval}</li>
      <li><b>Intercalar ejercicios:</b> ${s.interleaving}</li>
      <li><b>Pausas y respiración:</b> ${s.microbreaks} ${s.breathing}</li>
      <li><b>Hora del día:</b> ${s.chronotype}</li>
    </ul>
    <p class="mute" style="margin-bottom:0"><b>Estimaciones de diseño:</b> la base de 14 h / 6 h / 60 %, los multiplicadores de energía, las horas aproximadas del sueño y los topes de deuda o calibración son decisiones de esta app, no umbrales clínicos. Las mostramos para que sepas qué se está ajustando.</p>
  </div>`;
}
function viewCheckin(){
  if(!draft)loadDraft();
  const ok=S.consent&&S.consent.health,pt=ok?patterns():null;
  const recent=[...S.wellbeing.diary].sort((a,b)=>b.date.localeCompare(a.date));
  return `${screenHelp('checkin')}
  <div class="card"><h2>Check-in, diario y patrones</h2>
    <div class="mute">Guía de autocuidado: no es un diagnóstico ni un tratamiento. Tus registros se guardan solo en este navegador.</div></div>
  ${warnHtml()}
  ${checkinForm(true)}
  ${ok?`<div class="card"><h3>Patrones: cómo se cruza tu bienestar con tu carga</h3>
    ${pt.need?`<div class="empty">Aún faltan datos (${pt.n} de 7 check-ins). Con unos 7–10 registros empiezo a mostrar patrones.</div>`:
      (pt.items.length?pt.items.map(x=>`<div class="insight">${x}</div>`).join('')+'<p class="mute" style="margin-bottom:0">Son coincidencias en tus propios datos, no causas ni diagnósticos.</p>':'<div class="empty">Por ahora no veo diferencias claras. Con más registros aparecerán.</div>')}
    ${trend('mood','Ánimo, últimos 14 días','#58bd8a')}${trend('energy','Energía, últimos 14 días','#3b6df0')}${trend('sleep','Sueño, últimos 14 días','#8d73f2')}
  </div>`:''}
  ${ok?`<div class="card"><h3>Historial</h3>
    ${recent.slice(0,10).map(e=>`<div class="task"><span style="font-size:22px">${MOODS[e.mood-1][0]}</span>
      <span style="flex:1"><b>${dshort(e.date)}</b> · Ánimo ${MOODS[e.mood-1][1].toLowerCase()}${e.energy!=null?` · Energía ${ENERGY[e.energy-1][1].toLowerCase()} · Sueño ${SLEEP[e.sleep-1][1]}`:''}
      ${(e.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join(' ')}${e.note?`<br><span class="mute">${esc(e.note)}</span>`:''}</span>
      <button class="btn del" onclick="delDiary('${e.date}')">Borrar</button></div>`).join('')||'<div class="empty">Aún no hay registros. Guarda tu check-in de hoy para comenzar tu historial.</div>'}</div>`:''}
  ${evidenceHtml()}`;
}
function viewBienestar(){return viewCheckin()}
function viewRespiracion(){
  const T=TECH[bsel];
  const other=Object.entries(TECH).filter(([k])=>k!=='suspiro');
  return `${screenHelp('respiracion')}
  <div class="card"><h2>Respiración</h2>
    <div class="mute">Herramientas breves para bajar la activación. No son un tratamiento: solo te ayudan a hacer una pausa consciente.</div></div>
  <div class="grid2">
    <div class="card"><h3>Respiración guiada</h3>
      <p class="mute"><b>${T.name}</b> · ${T.desc}</p>
      <div class="bwrap"><div id="bcircle"></div></div>
      <div class="bnum"><div id="blabel">${bt?'':'Listo cuando quieras'}</div><div id="bcount" class="mute"></div><div id="bcycles" class="mute"></div></div>
      <div class="row" style="justify-content:center;margin-top:8px">
        ${bt?'<button class="btn" onclick="stopBreath()">Detener</button>':'<button class="btn" onclick="startBreath()">Comenzar</button>'}</div>
    </div>
    <div class="card"><details><summary>Más opciones</summary>
      <p class="mute">Otras respiraciones y meditaciones breves.</p>
      <div class="row">${other.map(([k,v])=>`<button class="btn sec" onclick="goBreath('${k}')">${v.name}</button>`).join('')}</div>
      <h3>Meditaciones breves</h3>
      ${mt?`<div class="banner lock row" style="justify-content:space-between"><span>En curso: <b>${esc(mt.name)}</b> — <b id="mtime">${mfmt(mt.left)}</b></span><button class="btn" onclick="stopMed()">Detener</button></div>`:''}
      ${MEDS.map(m=>`<details><summary>${m.name} · ${m.min} min</summary>
        <p class="mute">${m.desc}</p><ol>${m.steps.map(s=>`<li>${s}</li>`).join('')}</ol>
        <button class="btn sec" ${mt||bt?'disabled':''} onclick="startMed('${m.id}')">Iniciar temporizador (${m.min} min)</button></details>`).join('')}
    </details></div>
  </div>`;
}
function viewPausas(){
  return `${screenHelp('pausas')}
  <div class="card"><h2>Pausas rápidas</h2>
    <div class="pgrid">
      <div class="pcard"><b>Muévete 5 minutos</b><br>Camina o estira cuello, hombros y espalda tras cada bloque de estudio.</div>
      <div class="pcard"><b>Agua y luz natural</b><br>Toma agua y mira por la ventana unos minutos, lejos de las pantallas.</div>
      <div class="pcard"><b>Mira lejos 20 segundos</b><br>Cada 20 minutos de pantalla, enfoca algo lejano para descansar la vista.</div>
      <div class="pcard"><b>Cuida el sueño</b><br>Dormir bien rinde más que una hora extra de estudio a medianoche.</div>
      <div class="pcard"><b>Habla con alguien</b><br>Un mensaje a un compañero o amigo también es una pausa válida.</div>
    </div></div>
  ${pauseCard()}`;
}
function viewApoyo(){
  const sp=S.support;
  return `${screenHelp('apoyo')}
  <div class="card"><h2>Apoyo</h2>
    <p style="margin-top:0">Esta app te ayuda a organizarte y a cuidarte, pero <b>no reemplaza a un profesional de la salud</b>. Si algo de lo que sientes te pesa o dura varios días, hablarlo con alguien es una buena decisión, no una señal de debilidad.</p>
    <p class="mute" style="margin-bottom:0">Conviene buscar apoyo si hace semanas te cuesta dormir, comer o concentrarte, si te sientes sin ganas de nada o sobrepasado/a, o si estudiar se volvió fuente constante de angustia.</p></div>
  <div class="grid2">
    <div class="card"><h3>Apoyo en tu universidad</h3>
      <p class="mute">Muchas universidades tienen atención psicológica o de bienestar estudiantil gratuita para sus alumnos. Revisa el contacto vigente en el sitio oficial de la tuya y guárdalo aquí para tenerlo a mano.</p>
      ${isInstitutional()?institutionSupportHtml():''}
      <div class="row" style="flex-direction:column;align-items:stretch">
        <input id="sn" placeholder="Nombre del servicio (ej. Bienestar estudiantil)" value="${esc(sp.name)}">
        <input id="sc" placeholder="Teléfono, correo o enlace" value="${esc(sp.contact)}">
        <button class="btn" data-focus-id="save-support" onclick="saveSupport()">Guardar</button></div>
      ${isInstitutional()?`<div class="inst-contact"><p class="mute">Si quieres que te contacten, se avisará al servicio de apoyo de ${esc(currentInstitution().short)}. El correo se prepara solo con tu nombre y tu correo institucional: <b>no se incluye ningún dato de bienestar</b> y no se hace ninguna petición de red.</p>
        <a class="btn" id="inst-contact-mailto" data-focus-id="inst-contact" href="${esc(institutionContactHref())}">Quiero que me contacten</a></div>`:''}
      ${sp.name||sp.contact?'':`<div class="banner info" style="margin:10px 0 0">¿Estudias en la Universidad de Concepción? La DISE (Dirección de Servicios Estudiantiles) publica su contacto de Bienestar Estudiantil en bienestar@udec.cl y dise.udec.cl; pregunta ahí por apoyo en salud mental. <button class="lnk" onclick="fillUdeC()">Guardar estos datos</button></div>`}
      ${sp.name||sp.contact?`<div class="banner lock" style="margin:10px 0 0"><b>${esc(sp.name||'Mi servicio de apoyo')}</b><br>${esc(sp.contact)}</div>`:''}
    </div>
    <div class="card"><h3>Líneas de ayuda en Chile</h3>
      <div class="task"><span style="flex:1"><b>Línea de Prevención del Suicidio</b><br><span class="mute">Marca *4141 desde un celular. Gratuita y de atención permanente.</span></span></div>
      <div class="task"><span style="flex:1"><b>Salud Responde</b><br><span class="mute">600 360 7777. Orientación en salud, incluida salud mental.</span></span></div>
      <div class="task"><span style="flex:1"><b>Emergencia inmediata</b><br><span class="mute">131 (ambulancia) o 133 (Carabineros) si hay peligro ahora.</span></span></div>
      <p class="mute" style="margin-bottom:0">Si no estás en Chile, busca la línea de crisis de tu país. Verifica los números en fuentes oficiales: pueden cambiar.</p>
    </div>
  </div>`;
}
function viewPrivacidad(){
  const ok=S.consent&&S.consent.health;
  return `${screenHelp('privacidad')}<div class="card"><h2>Privacidad y mis datos</h2>
    <ul style="margin:0 0 10px 18px;padding:0">
      <li>Por defecto todo se guarda <b>solo en este navegador</b> y la app no hace peticiones externas. Puedes usarla siempre sin cuenta.</li>
      <li>Si activas la sección <i>Amigos</i> e inicias sesión, al servidor van <b>solo</b> tu nombre visible, tu código de amigo, tus relaciones de amistad, las fechas de los ramos que marques explícitamente como compartidos y tus sesiones de estudio.</li>
      <li>Los datos de bienestar (check-in, energía, ánimo, sueño, diario, notas personales y calificaciones) <b>nunca salen de este dispositivo</b>: no hay ninguna tabla para ellos en el servidor.</li>
      <li>${KEYOBJ?'Tus datos locales están cifrados con tu contraseña.':'Por defecto los datos locales no están cifrados: si compartes este equipo, activa el cifrado con contraseña (más abajo) o borra tus datos de bienestar.'}</li>
      <li>El lector de PDF viene incluido: tu archivo <b>no se sube</b>, se lee dentro de tu navegador. Los horarios .ics también se leen solo en tu navegador.</li>
      <li>Para borrar lo que sí se guarda en el servidor, ve a <i>Amigos → Eliminar mi cuenta y mis datos del servidor</i>. Eso no borra tus datos locales.</li>
      <li>Las estadísticas de uso y los comentarios son <b>opcionales</b> y están apagados por defecto. Si los activas, puedes desactivarlos aquí mismo.</li>
    </ul>
    <p class="mute">Estado: ${!S.consent?'aún no decidiste si activar el check-in':(S.consent.health?'check-in activado':'check-in desactivado')}. Último respaldo: ${S.lastBackup?dshort(S.lastBackup):'nunca'}.</p>
    <div class="row">
      ${ok?'<button class="btn sec" onclick="setConsent(false)">Revocar consentimiento</button>':'<button class="btn sec" onclick="resetConsent()">Revisar y activar check-in</button>'}
      <button class="btn sec" onclick="exportData()">Descargar respaldo (JSON)</button>
      <label class="btn sec" style="cursor:pointer">Restaurar respaldo<input type="file" accept=".json" style="display:none" onchange="importData(this)"></label>
      <button class="btn del" onclick="deleteHealth()">Borrar mis datos de bienestar</button>
      <button class="btn del" onclick="wipe()">Borrar todo</button></div>
    ${encryptionHtml()}
    <p class="mute" style="margin-bottom:0">La Ley 21.719 de protección de datos personales de Chile (vigente desde el 1 de diciembre de 2026) aplica a lo que se guarda en el servidor si usas Amigos, las estadísticas o los comentarios. Lo que queda solo en tu navegador no sale de él. Esto no es asesoría legal.</p>
  </div>
  <div class="card"><h3>Estadísticas de uso anónimas</h3>
    <label class="soc-switch"><input type="checkbox" id="metrics-toggle" data-focus-id="metrics-toggle" ${METRICS.enabled?'checked':''} onchange="setMetrics(this.checked)"> Compartir estadísticas de uso anónimas para mejorar Uarvis</label>
    <p style="margin:8px 0">Si lo activas, se crea un <b>ID aleatorio</b> que no se liga a tu cuenta de Amigos, a tu correo ni a tu correo institucional. Cada día se envía un solo lote con: el nombre del evento (por ejemplo, «app_abierta» o «seccion_vista»), el nombre de la sección cuando aplica, el <b>día sin hora</b>, tu universidad y carrera solo si las completaste, y la versión de la app.</p>
    <p class="mute" style="margin:0 0 8px">Se envían solo los eventos permitidos: app_abierta, seccion_vista, pomodoro_completado, flashcards_repasadas, certamen_activado, ics_importado, syllabus_importado, notas_calculadas, amigo_agregado y modo_elegido. <b>Nunca</b> se envían check-in, energía, ánimo, sueño, diario, notas personales, calificaciones, mazos de flashcards ni el contenido de tus ramos.</p>
    <p class="mute" style="margin:0">Está desactivado por defecto. Al desactivarlo se borran el ID anónimo y la cola pendiente. Sin Supabase configurado o sin red no se envía nada y no se muestra ningún error.</p>
  </div>
  <div class="card"><h3>Enviar comentarios</h3>
    <p class="mute" style="margin-top:0">Opcional. Si tienes Supabase configurado, tu mensaje se guarda en la tabla <code>feedback</code> con el día, el tipo, la versión y tu universidad y carrera si las completaste. Si no, puedes copiarlo y enviarlo por otro medio.</p>
    <div class="hud-form" style="max-width:520px">
      <label>Tipo<select id="fb-type" data-focus-id="fb-type">
        <option value="idea">Idea</option><option value="problema">Problema</option><option value="otro">Otro</option>
      </select></label>
      <label>Comentario<textarea id="fb-text" data-focus-id="fb-text" maxlength="1000" rows="4" placeholder="Cuéntanos qué podríamos mejorar (máximo 1000 caracteres)"></textarea></label>
      <div class="row"><button class="btn" data-focus-id="feedback-send" onclick="feedbackSend()">Enviar comentarios</button>
        <button class="btn sec" data-focus-id="feedback-copy" onclick="feedbackCopy()">Copiar comentario</button></div>
    </div>
    <p class="mute" style="margin-bottom:0">No incluyas datos de bienestar ni información personal en el mensaje: el comentario no se liga a tu cuenta.</p>
  </div>`;
}
function viewSalud(){
  if(!S.courses.length)return screenHelp('salud')+'<div class="card empty">Aún no tienes ramos. Ve a <b>Académico &gt; Ramos</b> y toca <b>Agregar</b> para ver tu carga por semana.</div>';
  const t0=today(),N=14,sumD=S.courses.reduce((a,c)=>a+c.difficulty,0);
  const dates=[...Array(N)].map((_,i)=>addDays(t0,i-N+1));
  const rows=S.courses.map(c=>{
    const tg=d=>Math.max(1,capFor(d)*0.7*c.difficulty/sumD);          // cuota recomendada del ramo ese día
    const vals=dates.map(d=>S.sessions.filter(s=>s.date===d&&s.courseId===c.id).reduce((a,s)=>a+s.minutes,0)/tg(d));
    const a7=avg(vals.slice(-7));
    const nextEv=S.events.filter(e=>e.courseId===c.id&&e.type!=='control'&&e.date>=t0).sort((a,b)=>a.date.localeCompare(b.date))[0];
    const days2=nextEv?diffDays(t0,nextEv.date):null;
    let status='En equilibrio',col='var(--ok)';
    if(a7<0.5){status='Poca atención';col='var(--warn)'}
    else if(a7<0.85){status='Atención algo baja';col='var(--warn)'}
    else if(a7>1.3){status='Mucha atención';col='var(--soft)'}
    return {c,target:tg(t0),vals,a7,status,col,nextEv,days2,risk:nextEv&&days2<=10&&a7<0.6};
  });
  const cls=v=>v===0?'h0':v<0.5?'h1':v<0.9?'h2':v<=1.3?'h3':'h4';
  const alerts=rows.filter(r=>r.risk);
  return `${screenHelp('salud')}
  <div class="card"><h2>Carga por semana</h2>
    ${alerts.length?alerts.map(r=>`<div class="banner go"><b>${esc(r.c.name)}</b>: tienes "${esc(r.nextEv.title)}" en ${r.days2} día(s) y esta semana le diste poca atención (${Math.round(r.a7*100)}% de lo recomendado). Quizá convenga reequilibrar un poco.</div>`).join('')
      :'<div class="banner min">Sin desequilibrios importantes frente a tus próximas evaluaciones.</div>'}
    <div class="legend mute">Atención vs. cuota recomendada del ramo (según dificultad y tu capacidad de cada día):
      <span class="h0"></span>sin estudio<span class="h1"></span>&lt;50%<span class="h2"></span>50–90%<span class="h3"></span>90–130%<span class="h4"></span>&gt;130%</div>
    <div style="margin-top:12px;overflow-x:auto">
    ${rows.map(r=>`<div style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between"><span><span aria-hidden="true" class="dot" style="background:${r.c.color};display:inline-block"></span> <b>${esc(r.c.name)}</b>
        <span class="mute"> · cuota hoy ~${Math.round(r.target)} min</span></span>
        <span style="color:${r.col};font-weight:600">${r.status}</span></div>
      <div class="heat" style="grid-template-columns:repeat(${N},1fr);margin-top:4px;min-width:420px">
        ${r.vals.map((v,i)=>`<div class="cell ${cls(v)}" title="${dshort(dates[i])}: ${Math.round(v*Math.max(1,capFor(dates[i])*0.7*r.c.difficulty/sumD))} min"></div>`).join('')}</div>
      <div class="mute" style="margin-top:2px">${r.nextEv?`Próxima fecha: ${dshort(r.nextEv.date)} (${esc(r.nextEv.title)})`:'Sin evaluaciones próximas'}</div></div>`).join('')}
    </div>
    <div class="mute">Cada columna es un día (hoy a la derecha).</div>
  </div>`;
}
function viewTema(){
  const th=themeOk(S.settings&&S.settings.theme)?S.settings.theme:'cian';
  const md=modeOk(S.settings&&S.settings.mode)?S.settings.mode:'light';
  const st=styleOk(S.settings&&S.settings.style)?S.settings.style:'calma';
  const themes=THEMES.filter(([k])=>k!=='udec'||isInstitutional());
  const sdescs={calma:'Sin brillo ni mayúsculas forzadas, con textos cálidos.',hud:'Interfaz futurista con brillo y estilo tecnológico.'};
  return `${screenHelp('tema')}
  <div class="card"><h2>Apariencia</h2>
    <p style="margin-top:0">Escoge el estilo visual, el color y el modo de luz. La elección se guarda solo en este navegador.</p>
    <h3>Estilo visual</h3>
    <div class="modes">${STYLES.map(([k,label])=>`<button type="button" class="mode-btn ${k===st?'on':''}" aria-pressed="${k===st}" onclick="setStyle('${k}')"><span>${label}</span></button>`).join('')}</div>
    <p class="mute" style="margin-bottom:0">${sdescs[st]||''}</p>
    <h3 style="margin-top:20px">Color de la aplicación</h3>
    <div class="swatches">${themes.map(([k,label,hex])=>`<button type="button" class="swatch ${k===th?'on':''}" style="--sw:${hex}" aria-pressed="${k===th}" onclick="setTheme('${k}')"><span class="swatch-dot"></span><span>${label}</span></button>`).join('')}</div>
    <h3 style="margin-top:20px">Modo</h3>
    <div class="modes">${MODES.map(([k,label])=>`<button type="button" class="mode-btn ${k===md?'on':''}" aria-pressed="${k===md}" onclick="setMode('${k}')"><span class="mode-preview ${k}"></span><span>${label}</span></button>`).join('')}</div>
    <p class="mute" style="margin-bottom:0">El modo claro suaviza los fondos y mantiene el contraste para leer; el oscuro cuida la vista con poca luz.</p>
  </div>
  <div class="card"><h3>Arvis</h3>
    <label class="mute"><input type="checkbox" ${S.settings.arvis!==false?'checked':''} onchange="setArvis(this.checked)"> Mostrar a Arvis</label>
    <p class="mute" style="margin:6px 0 0">Aparece en el inicio y en algunos momentos clave. Si lo apagas, la app sigue igual que antes.</p>
  </div>
  <div class="card"><h3>Vista previa</h3>
    <div class="preview">
      <div class="preview-head"><span aria-hidden="true" class="dot" style="background:var(--accent)"></span><b>U.A.R.V.I.S.</b></div>
      <div class="preview-body">
        <div class="row"><span class="tag">Etiqueta</span><span class="tag sel on" style="cursor:default">Seleccionado</span></div>
        <div class="row" style="margin-top:12px"><button class="btn" style="cursor:default">Botón principal</button><button class="btn sec" style="cursor:default">Secundario</button></div>
        <div class="preview-line"></div>
      </div>
    </div>
  </div>
  <div class="card"><h3>Tutorial</h3><p class="mute" style="margin-top:0">Puedes volver a ver la guía de bienvenida con los pasos de cada sección.</p>
    <div class="row"><button class="btn sec" onclick="startTour(true)">Ver tutorial de nuevo</button></div></div>`;
}
function viewAmigos(){
  if(!socialConfigured())return `${screenHelp('amigos')}<div class="card"><h2>Amigos <span class="tag inst-example">Prototipo</span></h2>
    <button class="btn" onclick="socialStartDemo()">Probar con datos de ejemplo</button></div>`;
  if(!socialAuth())return `${screenHelp('amigos')}<div class="card"><h2>Amigos</h2>
    ${socialDemoBanner()}
    <p style="margin-top:0">${socialDemoActive()?'Coordina sesiones de estudio y comparte fechas con amigos de ejemplo. El acceso es simulado: cualquier correo y cualquier código de 6 dígitos funcionan.':'Coordina sesiones de estudio y comparte fechas con amigos. El acceso es con un código de 6 dígitos que llega a tu correo (sin enlaces ni redirecciones).'}</p>
    ${SOC.step==='code'?`<div class="soc-flow">
      <p>Enviamos un código a <b>${esc(SOC.email)}</b>. Revísalo también en tu carpeta de spam.</p>
      <div class="row"><input id="soc-code-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="width:150px;letter-spacing:.3em;text-align:center">
      <button class="btn" ${SOC.busy?'disabled':''} onclick="socialSubmitCode()">Ingresar código</button>
      <button class="btn sec" onclick="SOC.step='email';SOC.msg='';render()">Cambiar correo</button></div></div>`
    :`<div class="soc-flow"><div class="row"><input id="soc-email" type="email" placeholder="tu@correo.cl" value="${esc(SOC.email)}" style="flex:1;min-width:220px">
      <button class="btn" ${SOC.busy?'disabled':''} onclick="socialSubmitEmail()">Enviar código</button></div>
      <p class="mute">Sin iniciar sesión la app sigue siendo 100 % local: tus datos de bienestar nunca salen de este dispositivo.</p></div>`}
    ${SOC.msg?`<div class="banner info">${esc(SOC.msg)}</div>`:''}
  </div>`;
  if(SOC.step==='name')return `${screenHelp('amigos')}<div class="card"><h2>Tu nombre visible</h2>
    ${socialDemoBanner()}
    <p style="margin-top:0">¿Cómo quieres que te vean tus amigos? ${socialDemoActive()?'Este nombre se guarda solo en el ejemplo.':'Solo se guarda este nombre en el servidor.'} No enviamos tu carrera, tus notas ni ningún dato de bienestar.</p>
    <div class="row"><input id="soc-name" maxlength="60" placeholder="Tu nombre" value="${esc(S.profile&&S.profile.name||'')}">
    <button class="btn" ${SOC.busy?'disabled':''} onclick="socialSubmitName()">Crear mi perfil</button></div>
    ${SOC.msg?`<div class="banner info">${esc(SOC.msg)}</div>`:''}
    <p class="mute" style="margin-bottom:0">${socialDemoActive()?'Podrás cambiarlo si sales y vuelves a entrar al modo demo.':'Podrás cambiarlo más adelante desde tu perfil del servidor.'}</p></div>`;
  if(!SOC.ready||!SOC.profile)return `${screenHelp('amigos')}<div class="card"><h2>Amigos</h2>
    ${socialDemoBanner()}
    ${SOC.error?`<div class="banner go"><b>No se pudo conectar.</b> ${esc(SOC.error)} El resto de la app sigue funcionando con tus datos locales.
      <div class="row" style="margin-top:8px"><button class="btn sec" onclick="socialOpenTab()">Reintentar</button></div></div>`
    :'<div class="empty">Cargando tus amigos…</div>'}</div>`;
  const me=socialAuth().user_id,p=SOC.profile;
  const statusLabel=s=>({invited:'Invitado',accepted:'Aceptó',declined:'No puede'}[s]||s);
  const sessions=socialSessionFields();
  const organized=sessions.filter(s=>s.host===me),invited=sessions.filter(s=>s.mine&&s.mine!=='host');
  const sessionRow=s=>{
    const c=socialSessionCourse(s),who=s.host===me?'Tú':socialName(s.host);
    const state=s.mine==='accepted'?'<span class="tag soc-ok">Aceptada</span>':(s.mine==='invited'?'<span class="tag soc-wait">Pendiente</span>':(s.mine==='declined'?'<span class="tag">Rechazada</span>':''));
    return `<div class="task"><span aria-hidden="true" class="dot" style="background:${c?c.color:'var(--accent)'}"></span>
      <span style="flex:1"><b>${dshort(s.date)} · ${esc(s.start_time)}–${esc(s.end_time)}</b> · ${esc(s.title)}<br>
      <span class="mute">${esc(s.course_name)} · ${esc(who)}${s.place?' · '+esc(s.place):''}</span>${s.note?`<br><span class="mute">${esc(s.note)}</span>`:''}</span>
      ${state}
      ${s.host===me?`<button class="btn del" onclick="socialCancelSession('${esc(s.id)}')">Cancelar</button>`
        :(s.mine==='invited'?`<button class="btn sec" onclick="socialRespondSession('${esc(s.id)}','accepted')">Aceptar</button>
          <button class="btn del" onclick="socialRespondSession('${esc(s.id)}','declined')">Rechazar</button>`:'')}</div>`;
  };
  const guestTags=s=>s.invites.map(i=>`<span class="tag ${i.status==='accepted'?'soc-ok':(i.status==='declined'?'':'soc-wait')}">${esc(socialName(i.user_id))}: ${esc(statusLabel(i.status))}</span>`).join(' ');
  const shared=socialFriendsShared(),groups={};
  shared.forEach(e=>{(groups[e.owner]=groups[e.owner]||[]).push(e)});
  const imported=S.events.filter(e=>e.src).sort((a,b)=>a.date.localeCompare(b.date));
  return `${screenHelp('amigos')}
  ${arvisMomentoHtml()}
  <div class="card hud-welcome">${socialDemoBanner()}
  ${SOC.msg?`<div class="banner info">${esc(SOC.msg)}</div>`:''}
  <div class="row" style="justify-content:space-between;align-items:flex-start">
    <div><h2 style="margin:0">Hola, ${esc(p.display_name)}</h2>
      <p class="mute" style="margin:4px 0 0">Tu código de amigo: <b class="hud-num soc-code">${esc(p.friend_code)}</b></p></div>
    <div class="row"><button class="btn sec" onclick="socialCopyCode()">Copiar mi código</button>
      <button class="btn sec" onclick="socialOpenTab()">Actualizar</button></div>
  </div>
  <p class="mute">${socialDemoActive()?'Estos amigos, sesiones y fechas viven solo en memoria mientras estés en el modo demo. Al importar una fecha de un amigo, sí se agrega a tus fechas reales de este navegador.':'Al servidor solo van tu nombre visible, tu código, tus amistades, las fechas de los ramos que marques como compartidos y tus sesiones de estudio.'} El check-in, la energía, el ánimo, el sueño, el diario, las notas y las calificaciones <b>nunca salen de este navegador</b>.</p>
  ${SOC.error?`<div class="banner info">No se pudo actualizar: ${esc(SOC.error)}. Estás viendo la información guardada en memoria.</div>`:''}
  <div class="row"><button class="lnk" onclick="socialLogout()">Cerrar sesión</button>
    <button class="lnk soc-danger" onclick="socialDeleteAccount()">Eliminar mi cuenta y mis datos del servidor</button></div>
  </div>
  <div class="grid2">
    <div class="card"><h3>Agregar un amigo</h3>
      <div class="row"><input id="soc-add-code" maxlength="8" placeholder="Código de 8 letras" style="flex:1;min-width:180px;text-transform:uppercase">
      <button class="btn" ${SOC.busy?'disabled':''} onclick="socialSendRequest()">Enviar solicitud</button></div>
      <p class="mute">Si la otra persona te agregó primero, al enviar el código se vuelven amigos automáticamente.</p>
      <h4>Solicitudes recibidas</h4>
      ${SOC.incoming.map(x=>`<div class="task"><span style="flex:1">${esc(x.person.display_name)}</span>
        <button class="btn sec" onclick="socialRespondFriend('${esc(x.id)}',true)">Aceptar</button>
        <button class="btn del" onclick="socialRespondFriend('${esc(x.id)}',false)">Rechazar</button></div>`).join('')||'<div class="empty">No hay solicitudes recibidas. Cuando alguien te agregue, aparecerá aquí.</div>'}
      <h4>Solicitudes enviadas</h4>
      ${SOC.outgoing.map(x=>`<div class="task"><span style="flex:1">${esc(x.person.display_name)}</span><span class="tag soc-wait">Esperando respuesta</span></div>`).join('')||'<div class="empty">No hay solicitudes enviadas. Ingresa un código arriba para invitar a alguien.</div>'}
    </div>
    <div class="card"><h3>Mis amigos</h3>
      ${SOC.friends.map(p=>`<div class="task"><span aria-hidden="true" class="dot" style="background:var(--accent)"></span>
        <span style="flex:1">${esc(p.display_name)}</span><button class="btn del" onclick="socialRemoveFriend('${esc(p.id)}')">Quitar</button></div>`).join('')||`${arvisVacioHtml('amigos')}<div class="empty">Aún no tienes amigos. Comparte tu código o ingresa el de otra persona y toca <b>Enviar solicitud</b>.</div>`}
      <p class="mute" style="margin-bottom:0">No hay rachas, puntos ni comparaciones de tiempo: esto es solo para organizarse juntos.</p>
    </div>
  </div>
  <div class="card"><h3>Sesiones de estudio</h3>
    <div class="row"><input id="ss-title" placeholder="Título (ej. Repasar certamen)" style="flex:2;min-width:200px">
      <input id="ss-course" list="ss-courses" placeholder="Ramo" style="flex:1;min-width:160px">
      <datalist id="ss-courses">${S.courses.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist></div>
    <div class="row" style="margin-top:8px"><input id="ss-date" type="date" value="${today()}">
      <input id="ss-start" type="time" value="18:00"><input id="ss-end" type="time" value="19:30">
      <input id="ss-place" placeholder="Lugar o enlace" style="flex:1;min-width:180px"></div>
    <textarea id="ss-note" placeholder="Nota para quienes vayan (opcional)" style="margin-top:8px"></textarea>
    <p class="mute" style="margin:10px 0 6px">Invitar a:</p>
    <div class="soc-checks">${SOC.friends.map(p=>`<label class="soc-check"><input type="checkbox" name="ss-guest" value="${esc(p.id)}"> ${esc(p.display_name)}</label>`).join('')||'<span class="mute">Aún no tienes amigos. Agrega amigos para poder invitarlos a una sesión.</span>'}</div>
    <div class="row" style="margin-top:10px"><button class="btn" ${SOC.busy||!SOC.friends.length?'disabled':''} onclick="socialCreateSession()">Crear sesión</button></div>
    <h4>Próximas sesiones que organizo</h4>
    ${organized.map(s=>`${sessionRow(s)}<div class="soc-guests">${guestTags(s)||'<span class="mute">Sin invitados</span>'}</div>`).join('')||'<div class="empty">No tienes sesiones organizadas. Completa el formulario y toca <b>Crear sesión</b>.</div>'}
    <h4>Sesiones a las que me invitaron</h4>
    ${invited.map(sessionRow).join('')||'<div class="empty">No te han invitado a ninguna sesión. Cuando te inviten, aparecerá aquí.</div>'}
  </div>
  <div class="card"><h3>Fechas compartidas</h3>
    <p class="mute" style="margin-top:0">Escoge tus ramos. Solo se envían el nombre del ramo, el título, el tipo y la fecha de cada evaluación, entrega o control.</p>
    ${S.courses.map(c=>`<div class="share-row"><span aria-hidden="true" class="dot" style="background:${c.color}"></span><b style="flex:1">${esc(c.name)}</b>
      <label class="soc-switch"><input type="checkbox" ${c.share?'checked':''} onchange="setShare('${esc(c.id)}',this.checked)"> Compartir las fechas de este ramo con mis amigos</label></div>`).join('')||'<div class="empty">Aún no tienes ramos. Agrega ramos en <b>Académico</b> para poder compartir sus fechas.</div>'}
    <h4>Fechas que comparten mis amigos</h4>
    ${Object.keys(groups).map(o=>`<div class="soc-friend-group"><h4>${esc(socialName(o))}</h4>
      ${groups[o].sort((a,b)=>a.date.localeCompare(b.date)).map((e,i)=>{
        const match=S.courses.find(c=>norm(c.name)===norm(e.course_name));
        return `<div class="task"><span style="flex:1"><b>${dshort(e.date)}</b> · ${esc(TYPE_LABEL[e.type]||e.type)} · ${esc(e.course_name)} — ${esc(e.title)}</span>
          <select id="soc-imp-${o.slice(0,6)}-${i}" aria-label="Ramo destino">${S.courses.map(c=>`<option value="${esc(c.id)}" ${match&&c.id===match.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
          <button class="btn sec" ${S.courses.length?'':'disabled'} onclick="socialImportEvent('${esc(e.owner)}','${esc(e.id)}',document.getElementById('soc-imp-${o.slice(0,6)}-${i}').value)">Agregar a mis fechas</button></div>`;
      }).join('')}</div>`).join('')||'<div class="empty">Por ahora nadie ha compartido fechas contigo. Pide a tus amigos que compartan fechas de sus ramos.</div>'}
    ${imported.length?`<h4>Fechas que ya importé</h4>${imported.map(e=>`<div class="task"><span style="flex:1">${dshort(e.date)} · ${esc(TYPE_LABEL[e.type]||e.type)} · ${esc(cname(e.courseId))} — ${esc(e.title)}</span><span class="tag soc-ok">Ya en tus fechas</span></div>`).join('')}`:''}
  </div>`;
}
