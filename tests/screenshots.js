// Genera las capturas del README. Uso: npm run screenshots
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  p.on('dialog', d => d.accept());
  const onboard = async () => {
    if (await p.locator('#reg-name').count()) {
      await p.fill('#reg-name', 'Estudiante');
      await p.fill('#reg-career', 'Carrera');
      await p.locator('.hud-btn').click();
    }
    const choice = p.locator('[data-focus-id="account-personal"]');
    if (await choice.count()) await choice.click();
  };
  const open = async (sec, sub) => {
    await p.locator('.brand').click();
    if (sec !== 'Inicio') await p.locator('.home-card').filter({ hasText: sec }).click();
    if (sub) {
      const navBtn = p.locator('nav .subtabs').locator('button', { hasText: sub });
      const chipBtn = p.locator('.subchips').locator('button', { hasText: sub });
      if (await chipBtn.count()) await chipBtn.first().click();
      else await navBtn.first().click();
    }
  };
  await p.goto('file://' + file);
  await onboard();
  await p.click('text=Acepto y quiero usar el check-in');
  await open('Ajustes', 'Datos de ejemplo');
  await p.click('text=Cargar datos de ejemplo');
  await onboard();
  await open('Planificación', 'Hoy');
  // un día difícil: energía baja, ánimo normal, sueño regular
  await p.locator('.ci-row').nth(0).locator('.sc').nth(1).click();
  await p.locator('.ci-row').nth(1).locator('.sc').nth(2).click();
  await p.locator('.ci-row').nth(2).locator('.sc').nth(2).click();
  await p.click('text=Guardar y ajustar mi plan');
  await p.waitForTimeout(400);
  if (await p.locator('text=Ahora no').count()) await p.click('text=Ahora no');   // la demo usa datos al azar: evita una alerta casual
  await p.evaluate(() => document.getElementById('toast').classList.remove('on'));
  const shot = async (name, sec, sub, full = true) => {
    if (sec) await open(sec, sub);
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(out, name), fullPage: full });
  };
  await shot('01-hoy.png');
  await shot('02-semana.png', 'Planificación', 'Semana');
  await shot('03-bienestar.png', 'Bienestar', 'Check-in');
  await shot('04-apoyo.png', 'Bienestar', 'Apoyo');
  await p.setViewportSize({ width: 390, height: 800 });
  await shot('05-movil-hoy.png', 'Planificación', 'Hoy', false);
  await b.close();
  console.log('Capturas guardadas en', out);
})();
