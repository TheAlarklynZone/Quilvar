// Builds the silent, subtitled tutorial video from the real UI.
//   npm run build && node tutorial/build.cjs
// Needs: playwright-core, Chromium (PLAYWRIGHT_BROWSERS_PATH or CHROMIUM_PATH), and ffmpeg (FFMPEG).
// Frames are the built app (dist/) running against a mocked electronAPI, so no Electron is needed.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const WORK = process.env.TUTORIAL_WORK || path.join(require('os').tmpdir(), 'quilvar-tutorial');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = path.join(__dirname, 'quilvar-tutorial');
const W = 1920, H = 1080, FPS = 30, FADE = 0.5;

fs.mkdirSync(WORK, { recursive: true });

const MOCK = `
const now = Date.now(), min = 60000;
function shot() {
  const c = document.createElement('canvas'); c.width = 260; c.height = 160;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 260, 160); g.addColorStop(0, '#2b3a67'); g.addColorStop(1, '#c5964a');
  x.fillStyle = g; x.fillRect(0, 0, 260, 160);
  x.fillStyle = 'rgba(15,14,13,.88)'; x.fillRect(14, 14, 232, 132);
  x.fillStyle = '#c5964a'; x.fillRect(26, 28, 90, 8);
  x.fillStyle = '#5d5a56';
  for (let i = 0; i < 5; i++) x.fillRect(26, 50 + i * 16, 150 + (i * 37) % 60, 6);
  return c.toDataURL('image/png');
}
const T = (id, content, ago, extra) => Object.assign({ id, content, timestamp: now - ago * min, pinned: false,
  charCount: content.length, wordCount: content.trim().split(/\\s+/).length, type: 'text' }, extra || {});
const clips = [
  T('c1', "Thanks for the update! I'll send the invoice over by Friday.", 0.5),
  T('c2', 'Image 1280×800', 3, { type: 'image', charCount: 0, wordCount: 0, width: 1280, height: 800, thumbnail: shot() }),
  T('c3', 'https://github.com/TheAlarklynZone/Quilvar/releases', 8),
  T('c4', '{"name":"quilvar","version":"0.2.0","private":true,"scripts":{"build":"vite build","dist":"electron-builder"}}', 14),
  T('c5', 'npm run build && npm run dist', 26),
  T('c6', 'Invoice #1042 — $1,280.00 due 2026-11-01', 55, { pinned: true }),
  T('c7', 'SELECT * FROM clips WHERE pinned = 1 ORDER BY timestamp DESC;', 90, { pinned: true }),
  T('c8', 'hello@alarkiusej.com', 130, { pinned: true }),
  T('c9', 'Best regards,\\nAlarkius', 170, { pinned: true }),
];
const quivers = [
  { id: 'q1', name: 'Work snippets', clipIds: ['c6', 'c7'], createdAt: now },
  { id: 'q2', name: 'Email', clipIds: ['c8', 'c9'], createdAt: now },
];
const L = {};
window.electronAPI = {
  getClips: async () => clips, onNewClip() {}, onQuickDrawOpen(cb) { L.open = cb; }, removeAllListeners() {},
  getVersion: async () => '0.2.0', getStoragePath: async () => 'C:\\\\Users\\\\you\\\\AppData\\\\Roaming\\\\Quilvar',
  vaultStatus: async () => ({ hasPin: true, unlocked: false }),
  getSettings: async () => ({ hotkey: 'Shift+Alt+V', defaultHotkey: 'Shift+Alt+V', launchSupported: true, launchAtStartup: true }),
  suspendHotkey: async () => true, resumeHotkey: async () => true, setHotkey: async (a) => ({ ok: true, hotkey: a }),
  getQuivers: async () => quivers.map((q) => ({ ...q })), copyClip: async () => true, copyClipById: async () => true,
  quickDrawSelect: async () => true, quickDrawClose: async () => {},
};
`;

const BRAND = 'Quilvar';
const TAGLINE = 'Store your clips. Paste with precision.';

// kind: 'app' = real UI via steps(page); 'card' = html card; 'desk' = overlay-on-desktop mock
const SCENES = [
  { kind: 'card', dur: 4.5, html: 'title', caption: 'A quick tour of Quilvar — your clipboard history, with precision.' },
  { kind: 'app', dur: 5.5, caption: 'Everything you copy is saved automatically — text <b>and</b> images.',
    steps: async () => {} },
  { kind: 'app', dur: 5.5, caption: 'Search your history, then click any clip to copy it again.',
    steps: async (p) => { await p.fill('.clip-search-input', 'invoice'); } },
  { kind: 'app', dur: 5.5, caption: 'Pin the clips you reuse. Pinned clips survive Clear All.',
    steps: async (p) => { await p.locator('.sidebar-nav-item', { hasText: 'Pinned' }).click(); } },
  { kind: 'app', dur: 6, caption: 'Group pinned clips into Quivers — folders for the snippets you reach for most.',
    steps: async (p) => { await p.locator('.sidebar-nav-item', { hasText: 'Quivers' }).click(); await p.getByText('Work snippets').first().click(); } },
  { kind: 'app', dur: 6, caption: 'Quilvert cleans up text: trim, collapse whitespace, prettify or minify JSON.',
    steps: async (p) => {
      await p.locator('.clip-card').nth(3).hover();
      await p.locator('.clip-card').nth(3).locator('[title^="Quilvert"]').click();
      await p.getByText('Prettify JSON').click();
    } },
  { kind: 'app', dur: 6, caption: 'Quilvault keeps sensitive clips behind a PIN, encrypted on your device.',
    steps: async (p) => { await p.locator('.sidebar-nav-item', { hasText: 'Quilvault' }).click(); await p.waitForSelector('input[type=password]'); await p.fill('input[type=password]', '1234'); } },
  { kind: 'desk', dur: 6, overlay: true, caption: 'Press <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>V</kbd> anywhere to open Quick Draw.' },
  { kind: 'desk', dur: 6, overlay: false, caption: 'Pick a clip with <kbd>↑</kbd> <kbd>↓</kbd> and hit <kbd>Enter</kbd> — it pastes straight into the app you were in.' },
  { kind: 'app', dur: 6, caption: 'In Settings: change the shortcut, launch at startup, and check for updates.',
    steps: async (p) => { await p.locator('.sidebar-nav-item', { hasText: 'Settings' }).click(); } },
  { kind: 'card', dur: 5, html: 'outro', caption: 'Everything stays on your device. Nothing is ever sent to a server.' },
];

function serve() {
  return http.createServer((q, r) => {
    const u = q.url.split('?')[0];
    const f = path.join(DIST, u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      const t = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html';
      r.writeHead(200, { 'content-type': t }); r.end(d);
    });
  }).listen(0);
}

const FONT = "'Satoshi','Inter','Liberation Sans','Helvetica Neue',sans-serif";
const iconB64 = fs.readFileSync(path.join(ROOT, 'build', 'icon.png')).toString('base64');

function frameHtml({ appPng, card, caption }) {
  const body = appPng
    ? `<div class="win"><img src="data:image/png;base64,${appPng}"></div>`
    : card;
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${W}px;height:${H}px;background:radial-gradient(120% 90% at 50% 0%,#211e1a 0%,#0f0e0d 70%);font-family:${FONT};color:#e8e6e3;overflow:hidden;position:relative}
  .win{position:absolute;left:210px;top:36px;width:1500px;height:844px;border-radius:18px;overflow:hidden;border:1px solid #2e2c2a;box-shadow:0 40px 100px rgba(0,0,0,.6)}
  .win img{width:100%;height:100%;display:block}
  .cap{position:absolute;left:0;right:0;top:900px;height:150px;display:flex;align-items:center;justify-content:center;padding:0 160px}
  .cap span{font-size:42px;line-height:1.3;text-align:center;background:rgba(0,0,0,.72);padding:14px 34px;border-radius:14px;color:#fff;letter-spacing:.1px;max-width:1500px;text-wrap:balance}
  .cap b{color:#e2b25a}
  kbd{font-family:inherit;font-size:.8em;font-weight:700;background:#2a2724;border:1px solid #4a4642;border-bottom-width:3px;border-radius:8px;padding:1px 10px;margin:0 2px;color:#fff}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding-bottom:140px}
  .card img{width:150px;height:150px;border-radius:32px}
  .card h1{font-size:104px;letter-spacing:-2px}
  .card p{font-size:40px;color:#e2b25a}
  .card small{font-size:30px;color:#8b8782}
  </style>${body}<div class="cap"><span>${caption}</span></div>`;
}

const TITLE = `<div class="card"><img src="data:image/png;base64,${iconB64}"><h1>${BRAND}</h1><p>${TAGLINE}</p></div>`;
const OUTRO = `<div class="card"><img src="data:image/png;base64,${iconB64}"><h1>${BRAND}</h1><p>${TAGLINE}</p><small>quilvar.alarkiusej.com</small></div>`;

function deskHtml(pasted, overlayPng) {
  const line = "Thanks for the update! I'll send the invoice over by Friday.";
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:1000px;height:562px;background:#e9e4dc;font-family:${FONT};position:relative;overflow:hidden}
  .bar{height:38px;background:#f6f3ee;border-bottom:1px solid #d8d2c8;display:flex;align-items:center;padding:0 14px;gap:8px;color:#6b665f;font-size:13px}
  .dot{width:11px;height:11px;border-radius:50%;background:#d8d2c8}
  .doc{padding:34px 60px;color:#2b2926;font-size:17px;line-height:1.7;max-width:760px}
  .doc h2{font-size:24px;margin-bottom:14px}
  .caret{display:inline-block;width:2px;height:20px;background:#2b2926;vertical-align:middle}
  .dim{position:absolute;inset:0;background:rgba(0,0,0,.28)}
  .ov{position:absolute;left:232px;top:78px;width:536px;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.55);overflow:hidden}
  .ov img{width:536px;display:block}
  </style>
  <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span style="margin-left:10px">Notes — Reply to Sam</span></div>
  <div class="doc"><h2>Reply to Sam</h2>
  <p>Hi Sam,</p><p>${pasted ? line : ''}<span class="caret"></span></p></div>
  ${overlayPng ? `<div class="dim"></div><div class="ov"><img src="data:image/png;base64,${overlayPng}"></div>` : ''}`;
}

(async () => {
  const srv = serve();
  const port = srv.address().port;
  const base = `http://localhost:${port}/`;
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 562 }, deviceScaleFactor: 1.5 });
  await ctx.addInitScript(MOCK);
  const compose = await browser.newPage({ viewport: { width: W, height: H } });

  const frames = [];
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    let appPng = null, card = null;
    if (s.kind === 'app') {
      const p = await ctx.newPage();
      await p.goto(base);
      await p.waitForSelector('.clip-card, .sidebar, nav');
      await p.waitForTimeout(250);
      await s.steps(p);
      await p.waitForTimeout(400);
      appPng = (await p.screenshot()).toString('base64');
      await p.close();
    } else if (s.kind === 'desk') {
      let overlayPng = null;
      if (s.overlay) {
        const o = await ctx.newPage();
        await o.setViewportSize({ width: 560, height: 440 });
        await o.goto(base + '#quickdraw');
        await o.waitForSelector('.quick-draw-item');
        await o.keyboard.press('ArrowDown'); await o.keyboard.press('ArrowUp');
        await o.waitForTimeout(250);
        overlayPng = (await o.locator('.quick-draw-panel').screenshot({ omitBackground: true })).toString('base64');
        await o.close();
      }
      const d = await ctx.newPage();
      await d.setContent(deskHtml(!s.overlay, overlayPng));
      appPng = (await d.screenshot()).toString('base64');
      await d.close();
    } else {
      card = s.html === 'title' ? TITLE : OUTRO;
    }
    await compose.setContent(frameHtml({ appPng, card, caption: s.caption }));
    const f = path.join(WORK, `scene-${String(i).padStart(2, '0')}.png`);
    await compose.screenshot({ path: f });
    frames.push(f);
  }
  await browser.close(); srv.close();

  // ── stitch with crossfades ──
  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  frames.forEach((f, i) => args.push('-loop', '1', '-framerate', String(FPS), '-t', String(SCENES[i].dur + FADE), '-i', f));
  let chain = '', prev = '0:v', t = 0;
  const parts = [];
  for (let i = 1; i < frames.length; i++) {
    t += SCENES[i - 1].dur;
    const out = i === frames.length - 1 ? 'vout' : `x${i}`;
    parts.push(`[${prev}][${i}:v]xfade=transition=fade:duration=${FADE}:offset=${t.toFixed(2)}[${out}]`);
    prev = out;
  }
  args.push('-filter_complex', parts.join(';'), '-map', '[vout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT + '.mp4');
  execFileSync(FFMPEG, args, { stdio: 'inherit' });

  // ── sidecar subtitles (same text as the burned-in captions) ──
  const ts = (sec) => { const ms = Math.round(sec * 1000); const p = (n, l = 2) => String(n).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  let start = 0, srt = '';
  SCENES.forEach((s, i) => {
    srt += `${i + 1}\n${ts(start)} --> ${ts(start + s.dur)}\n${s.caption.replace(/<[^>]+>/g, '')}\n\n`;
    start += s.dur;
  });
  fs.writeFileSync(OUT + '.srt', srt);
  console.log('wrote', OUT + '.mp4', 'duration ~', start, 's');
})();
