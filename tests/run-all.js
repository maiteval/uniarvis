// Ejecuta todas las pruebas en un navegador real (Chromium vía Playwright).
// Uso: npm test   (la primera vez: npm install && npx playwright install chromium)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'out');
fs.mkdirSync(out, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'
};
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const run = (file, args) => new Promise(resolve => {
  console.log('\n=== ' + file + ' ===');
  const p = spawn('node', [path.join(__dirname, file), ...args], { stdio: 'inherit' });
  p.on('close', code => resolve(code));
});

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}/`;
  const codes = [
    await run('ui.test.js', [path.join(root, 'index.html'), path.join(out, 'ui')]),   // por file://
    await run('planificador.test.js', [path.join(root, 'index.html')]),                                  // sesiones largas y prioridad
    await run('evidencia.test.js', [path.join(root, 'index.html')]),                                     // base en evidencia
    await run('notas.test.js', [path.join(root, 'index.html')]),                                          // calculadora de notas
    await run('herramientas.test.js', [path.join(root, 'index.html')]),                                   // Pomodoro y flashcards
    await run('certamen.test.js', [path.join(root, 'index.html')]),                                       // modo certamen
    await run('arvis.test.js', [path.join(root, 'index.html')]),                                          // mascota Arvis
    await run('arvis-estudio.test.js', [path.join(root, 'index.html')]),                                  // Arvis acompaña el estudio
    await run('ics.test.js', [path.join(root, 'index.html'), path.join(out, 'ics')]),                    // parser .ics y confirmación
    await run('pwa.test.js', [base, path.join(out, 'pwa')]),                          // por http: PWA, respaldo, .ics, PDF
    await run('crypto.test.js', [base, path.join(out, 'crypto')]),                    // cifrado con contraseña
    await run('social.test.js', [base, path.join(out, 'social')]),                    // Amigos con backend simulado
    await run('metrics.test.js', [base, path.join(out, 'metrics')]),                  // Métricas anónimas y comentarios
    await run('demo.test.js', [base, path.join(out, 'demo')]),                       // modo demo sin red
    await run('institucional.test.js', [base, path.join(out, 'institucional')]),     // modo institucional (prototipo)
    await run('inst-auth.test.js', [base, path.join(out, 'inst-auth')]),             // verificación y contraseña institucional
    await run('entrada.test.js', [base, path.join(out, 'entrada')]),                 // elección de modo y migración de entrada
    await run('chatbot.test.js', [base, path.join(out, 'chatbot')]),                // chat con Arvis (prototipo)
    await run('ia-semana.test.js', [base, path.join(out, 'ia-semana')]),             // IA simulada y resumen semanal
    await run('ia-estudio.test.js', [base, path.join(out, 'ia-estudio')])
  ];
  server.close();
  const failed = codes.filter(c => c !== 0).length;
  console.log(failed ? `\n${failed} grupo(s) de pruebas con fallas` : '\nTodas las pruebas pasaron');
  process.exit(failed ? 1 : 0);
});
