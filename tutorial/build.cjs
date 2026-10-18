// Builds the silent, subtitled tutorial video by driving the real UI.
//   npm run build && node tutorial/build.cjs
// Needs: playwright-core, Chromium (CHROMIUM_PATH), ffmpeg (FFMPEG).
// The built app (dist/) runs in an iframe against a mocked electronAPI while a scripted cursor
// hovers, clicks and types. Time is virtual: every frame is rendered on demand at exactly 1/30s
// steps, so the result is smooth no matter how slow the machine is.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const OUT = path.join(__dirname, 'quilvar-tutorial');
const W = 1920, H = 1080, FPS = 30, SCALE = 1.5, WIN_X = 210, WIN_Y = 36;
const REPO_URL = 'https://github.com/TheAlarklynZone/Quilvar';
const iconB64 = fs.readFileSync(path.join(ROOT, 'build', 'icon.png')).toString('base64');
const FONT = "'Satoshi','Inter','Liberation Sans','Helvetica Neue',sans-serif";

// ── mocked electronAPI (injected into every frame) ──────────────────────────
const MOCK = `
(() => {
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
const vault = [T('v1', 'AWS recovery code: 4821-9937-1156', 300), T('v2', 'Wi-Fi password: correct-horse-battery', 420)];
const quivers = [
  { id: 'q1', name: 'Work snippets', clipIds: ['c6', 'c7'], createdAt: now },
  { id: 'q2', name: 'Email', clipIds: ['c8', 'c9'], createdAt: now },
];
let unlocked = false, launch = false, newClipCb = null;
window.__push = (clip) => newClipCb && newClipCb(Object.assign({ id: 'n' + Math.random(), timestamp: Date.now(), pinned: false,
  charCount: (clip.content || '').length, wordCount: 3, type: 'text' }, clip, clip.type === 'image' ? { thumbnail: shot() } : {}));
window.electronAPI = {
  getClips: async () => clips.map((c) => ({ ...c })), onNewClip(cb) { newClipCb = cb; }, onQuickDrawOpen() {}, removeAllListeners() {},
  togglePin: async (id) => { const c = clips.find((x) => x.id === id); c.pinned = !c.pinned; return { ...c }; },
  getVersion: async () => '0.2.0', getStoragePath: async () => 'C:\\\\Users\\\\you\\\\AppData\\\\Roaming\\\\Quilvar',
  vaultStatus: async () => ({ hasPin: true, unlocked }), vaultUnlock: async () => { unlocked = true; return true; },
  vaultLock: async () => { unlocked = false; }, getVaultClips: async () => vault.map((c) => ({ ...c })),
  getSettings: async () => ({ hotkey: 'Shift+Alt+V', defaultHotkey: 'Shift+Alt+V', launchSupported: true, launchAtStartup: launch }),
  setLaunchAtStartup: async (e) => { launch = e; return e; },
  suspendHotkey: async () => true, resumeHotkey: async () => true, setHotkey: async (a) => ({ ok: true, hotkey: a }),
  getQuivers: async () => quivers.map((q) => ({ ...q, clipIds: [...q.clipIds] })),
  addClipToQuiver: async (q, c) => { const z = quivers.find((x) => x.id === q); if (!z.clipIds.includes(c)) z.clipIds.push(c); return z; },
  removeClipFromQuiver: async () => ({}), copyClip: async () => true, copyClipById: async () => true,
  quickDrawSelect: async () => true, quickDrawClose: async () => {},
};
})();
`;

// ── stage: 1080p canvas holding the app window, cursor, cards and captions ──
const STAGE = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;pointer-events:none}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(120% 90% at 50% 0%,#211e1a 0%,#0f0e0d 70%);font-family:${FONT};color:#e8e6e3}
#wrap{position:absolute;left:${WIN_X}px;top:${WIN_Y}px;width:1500px;height:844px;border-radius:18px;overflow:hidden;border:1px solid #2e2c2a;box-shadow:0 40px 100px rgba(0,0,0,.6);opacity:0}
#win{position:absolute;left:0;top:0;width:1000px;height:562px;transform:scale(${SCALE});transform-origin:0 0;background:#0f0e0d}
iframe{width:1000px;height:562px;border:0;display:block;pointer-events:auto}
#card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding-bottom:150px;opacity:0}
#card img{width:150px;height:150px;border-radius:32px}
#card h1{font-size:104px;letter-spacing:-2px}
#card .tag{font-size:40px;color:#e2b25a}
#card .url{font-size:36px;color:#fff;background:#1c1a18;border:1px solid #3a3733;border-radius:999px;padding:14px 40px;margin-top:6px;display:none}
#cap{position:absolute;left:0;right:0;top:900px;height:150px;display:flex;align-items:center;justify-content:center;padding:0 160px;opacity:0}
#cap span{font-size:42px;line-height:1.3;text-align:center;background:rgba(0,0,0,.72);padding:14px 34px;border-radius:14px;color:#fff;max-width:1500px;text-wrap:balance}
#cap b{color:#e2b25a}
kbd{display:inline-block;font-family:inherit;font-size:.8em;font-weight:700;background:#2a2724;border:1px solid #4a4642;border-bottom-width:3px;border-radius:8px;padding:1px 10px;margin:0 2px;color:#fff;transition:none}
#cap.press kbd{transform:translateY(3px);border-bottom-width:1px;background:#c5964a;color:#14110d;border-color:#e2b25a}
#cursor{position:absolute;left:0;top:0;width:34px;height:34px;opacity:0;filter:drop-shadow(0 3px 5px rgba(0,0,0,.55))}
#ripple{position:absolute;left:0;top:0;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:3px solid #e2b25a;opacity:0}
</style>
<div id="wrap"><div id="win"><iframe id="app" name="app"></iframe></div></div>
<div id="card"><img id="c0" src="data:image/png;base64,${iconB64}"><h1 id="c1">Quilvar</h1><p class="tag" id="c2">Store your clips. Paste with precision.</p><p class="url" id="c3">${REPO_URL}</p></div>
<div id="cap"><span></span></div>
<div id="ripple"></div>
<svg id="cursor" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.7-7.8L21 10.5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>
<script>
const $ = (id) => document.getElementById(id);
const clamp = (v) => Math.max(0, Math.min(1, v));
window.S = {
  set(s) {
    $('wrap').style.opacity = s.wrapO; $('wrap').style.transform = 'scale(' + s.wrapS + ')';
    $('card').style.opacity = s.cardO;
    [0, 1, 2, 3].forEach((i) => { const e = $('c' + i), p = clamp(s.cardP * 3.2 - i * 0.55);
      e.style.opacity = p; e.style.transform = 'translateY(' + (1 - p) * 28 + 'px) scale(' + (0.96 + 0.04 * p) + ')'; });
    const cap = $('cap'); cap.style.opacity = s.capO; cap.style.transform = 'translateY(' + (1 - s.capO) * 16 + 'px)';
    cap.classList.toggle('press', !!s.press);
    const c = $('cursor'); c.style.opacity = s.curO;
    c.style.transform = 'translate(' + (s.cx - 6) + 'px,' + (s.cy - 4) + 'px) scale(' + (1 - 0.14 * s.curPress) + ')';
    const r = $('ripple'); r.style.opacity = s.rip > 0 && s.rip < 1 ? 0.8 * (1 - s.rip) : 0;
    r.style.transform = 'translate(' + s.cx + 'px,' + s.cy + 'px) scale(' + (0.3 + 1.1 * s.rip) + ')';
  },
  caption(html) { $('cap').firstChild.innerHTML = html; },
  load(url) { return new Promise((res) => { const f = $('app'); f.onload = () => res(); f.src = url; }); },
  showUrl() { $('c3').style.display = 'block'; },
};
</script>`;

const DESK = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1000px;height:562px;background:#e9e4dc;font-family:${FONT};position:relative;overflow:hidden}
.bar{height:38px;background:#f6f3ee;border-bottom:1px solid #d8d2c8;display:flex;align-items:center;padding:0 14px;gap:8px;color:#6b665f;font-size:13px}
.dot{width:11px;height:11px;border-radius:50%;background:#d8d2c8}
.doc{padding:34px 60px;color:#2b2926;font-size:17px;line-height:1.7;max-width:760px}
.doc h2{font-size:24px;margin-bottom:14px}
.caret{display:inline-block;width:2px;height:20px;background:#2b2926;vertical-align:middle}
#dim{position:absolute;inset:0;background:rgba(0,0,0,.3);opacity:0}
#ovw{position:absolute;left:220px;top:66px;width:560px;height:440px;opacity:0;filter:drop-shadow(0 28px 36px rgba(0,0,0,.5))}
#ov{width:560px;height:440px;border:0;background:transparent;clip-path:inset(12px round 16px)}
</style>
<div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span style="margin-left:10px">Notes — Reply to Sam</span></div>
<div class="doc"><h2>Reply to Sam</h2><p>Hi Sam,</p><p><span id="t"></span><span class="caret"></span></p></div>
<div id="dim"></div><div id="ovw"><iframe id="ov" name="ov" src="/#quickdraw"></iframe></div>
<script>
window.D = {
  show(p) { document.getElementById('dim').style.opacity = p;
    const o = document.getElementById('ovw'); o.style.opacity = Math.min(1, p * 1.6); o.style.transform = 'translateY(' + (1 - p) * 14 + 'px) scale(' + (0.96 + 0.04 * p) + ')'; },
  text(s) { document.getElementById('t').textContent = s; },
};
</script>`;

function serve() {
  return http.createServer((q, r) => {
    const u = q.url.split('?')[0];
    if (u === '/__stage') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(STAGE); }
    if (u === '/__desk') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(DESK); }
    const f = path.join(DIST, u === '/' ? 'index.html' : u);
    fs.readFile(f, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
      r.end(d);
    });
  }).listen(0);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

(async () => {
  const srv = serve();
  const base = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(MOCK);
  const page = await ctx.newPage();
  await page.goto(base + '/__stage');
  const app = () => page.frame({ name: 'app' });

  const ff = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT + '.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res) => ff.on('close', res));

  // ── virtual-time engine ──
  const st = { wrapO: 0, wrapS: 0.96, cardO: 0, cardP: 0, capO: 0, press: false, curO: 0, cx: 960, cy: 540, curPress: 0, rip: 1 };
  let frames = 0, mouse = { x: -1, y: -1 };
  const caps = [];                      // { start, end, text } for the .srt
  const now = () => frames / FPS;
  async function tick() {
    await page.evaluate((s) => window.S.set(s), st);
    if (st.curO > 0 && (st.cx !== mouse.x || st.cy !== mouse.y)) { mouse = { x: st.cx, y: st.cy }; await page.mouse.move(st.cx, st.cy); }
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    frames++;
  }
  async function anim(sec, fn) {
    const n = Math.max(1, Math.round(sec * FPS));
    for (let i = 1; i <= n; i++) { fn(i / n); await tick(); }
  }
  const wait = (sec) => anim(sec, () => {});

  // captions
  async function cap(html, { fade = 0.35 } = {}) {
    if (caps.length && caps[caps.length - 1].end == null) caps[caps.length - 1].end = now();
    if (st.capO > 0) await anim(0.18, (p) => { st.capO = 1 - p; });
    await page.evaluate((h) => window.S.caption(h), html);
    caps.push({ start: now(), end: null, text: html.replace(/<[^>]+>/g, '') });
    await anim(fade, (p) => { st.capO = easeOut(p); });
  }

  // cursor
  async function toPoint(sel, opts = {}) {
    const fr = opts.frame || app();
    const loc = fr.locator(sel).nth(opts.nth || 0);
    await loc.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(60);
    const r = await loc.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    return { x: WIN_X + r.x * SCALE + (opts.dx || 0), y: WIN_Y + r.y * SCALE + (opts.dy || 0) };
  }
  async function moveTo(pt, sec = 0.8) {
    if (st.curO === 0) { st.cx = pt.x + 260; st.cy = pt.y + 160; await anim(0.2, (p) => { st.curO = p; }); }
    const a = { x: st.cx, y: st.cy }, d = Math.hypot(pt.x - a.x, pt.y - a.y);
    const bend = Math.min(90, d * 0.12), nx = -(pt.y - a.y) / (d || 1), ny = (pt.x - a.x) / (d || 1);
    const c = { x: (a.x + pt.x) / 2 + nx * bend, y: (a.y + pt.y) / 2 + ny * bend };
    await anim(sec, (p) => {
      const t = ease(p), u = 1 - t;
      st.cx = Math.round(u * u * a.x + 2 * u * t * c.x + t * t * pt.x);
      st.cy = Math.round(u * u * a.y + 2 * u * t * c.y + t * t * pt.y);
    });
  }
  async function click() {
    await page.mouse.down();
    await anim(0.1, (p) => { st.curPress = p; });
    await page.mouse.up();
    st.rip = 0;
    await anim(0.4, (p) => { st.curPress = Math.max(0, 1 - p * 3); st.rip = p; });
    st.rip = 1;
  }
  async function pointClick(sel, opts) { await moveTo(await toPoint(sel, opts), opts && opts.sec); await wait(0.12); await click(); }
  async function typeText(text, cps = 11) {
    for (const ch of text) { await page.keyboard.type(ch); await wait(1 / cps); }
  }
  async function key(k, hold = 0.45) { await page.keyboard.press(k); await wait(hold); }
  const hideCursor = () => anim(0.2, (p) => { st.curO = 1 - p; }).then(() => { st.curO = 0; });

  // scene transitions
  async function sceneIn(url, { desk } = {}) {
    st.wrapO = 0; st.wrapS = 0.96; st.cardO = 0; st.press = false;
    await page.evaluate((u) => window.S.load(u), base + url);
    await app().waitForSelector(desk ? '#ov' : '.sidebar-nav-item');
    if (desk) await app().frameLocator('#ov').locator('.quick-draw-item').first().waitFor();
    await page.waitForTimeout(200);
    await anim(0.5, (p) => { st.wrapO = easeOut(p); st.wrapS = 0.96 + 0.04 * easeOut(p); });
  }
  async function sceneOut() {
    if (caps.length && caps[caps.length - 1].end == null) caps[caps.length - 1].end = now();
    if (st.curO > 0) await hideCursor();
    await anim(0.35, (p) => { st.wrapO = 1 - ease(p); st.wrapS = 1 - 0.03 * ease(p); st.capO = Math.min(st.capO, 1 - p); });
    st.capO = 0;
  }
  async function card(showUrl) {
    await page.evaluate((s) => { if (s) window.S.showUrl(); }, showUrl);
    st.cardO = 1; st.cardP = 0;
    await anim(1.6, (p) => { st.cardP = easeOut(p); });
  }
  async function cardOut() {
    if (caps.length && caps[caps.length - 1].end == null) caps[caps.length - 1].end = now();
    await anim(0.4, (p) => { st.cardO = 1 - p; st.capO = Math.min(st.capO, 1 - p); });
    st.capO = 0;
  }
  const nav = (name) => pointClick(`.sidebar-nav-item:has-text("${name}")`);

  // ════════════════════════ the script ════════════════════════
  // 1 — title
  await cap('A quick tour of Quilvar — your clipboard history, with precision.');
  await card(false); await wait(2.2); await cardOut();

  // 2 — history fills up on its own
  await sceneIn('/');
  await cap('Everything you copy is saved automatically — text <b>and</b> images.');
  await wait(0.9);
  await app().evaluate(() => window.__push({ content: 'Meeting notes: ship v0.2.0 on Friday' })); await wait(1.5);
  await app().evaluate(() => window.__push({ content: 'Image 1920×1080', type: 'image', width: 1920, height: 1080 })); await wait(1.6);
  await pointClick('.clip-card:nth-child(1) [title="Copy"]'); await wait(1.5);
  await sceneOut();

  // 3 — search
  await sceneIn('/');
  await cap('Search your history, then click any clip to copy it again.');
  await wait(0.5);
  await pointClick('.clip-search-input'); await wait(0.2);
  await typeText('invoice', 9); await wait(0.9);
  await pointClick('.clip-card-content'); await wait(1.6);
  await sceneOut();

  // 4 — pin
  await sceneIn('/');
  await cap('Pin the clips you reuse — they survive Clear All.');
  await wait(0.4);
  await pointClick('.clip-card:nth-child(5) [title="Pin"]'); await wait(1);
  await nav('Pinned'); await wait(2);
  await sceneOut();

  // 5 — quivers
  await sceneIn('/');
  await cap('Group pinned clips into Quivers — folders for the snippets you reach for most.');
  await wait(0.3);
  await nav('Quivers'); await wait(0.6);
  await pointClick('.quiver-list-item'); await wait(0.9);
  await pointClick('.quiver-add-section .clip-btn'); await wait(1.8);
  await sceneOut();

  // 6 — quilvert
  await sceneIn('/');
  await cap('Quilvert cleans up text: trim, collapse whitespace, prettify or minify JSON.');
  await wait(0.3);
  await pointClick('.clip-card:nth-child(4) [title^="Quilvert"]'); await wait(0.8);
  await pointClick('.quilvert-btn:has-text("Prettify JSON")'); await wait(1.4);
  await pointClick('.quilvert-btn:has-text("Minify JSON")'); await wait(1.2);
  await pointClick('.quilvert-btn:has-text("Prettify JSON")'); await wait(1.3);
  await sceneOut();

  // 7 — quilvault
  await sceneIn('/');
  await cap('Quilvault keeps sensitive clips behind a PIN, encrypted on your device.');
  await wait(0.3);
  await nav('Quilvault'); await wait(0.8);
  await pointClick('input[type=password]'); await wait(0.2);
  await typeText('1234', 5); await wait(0.4);
  await pointClick('.vault-submit'); await wait(2);
  await sceneOut();

  // 8 — quick draw
  await sceneIn('/__desk', { desk: true });
  const ov = page.frame({ name: 'app' }).childFrames().find((f) => f.name() === 'ov');
  await cap('Press <kbd>Shift</kbd> + <kbd>Alt</kbd> + <kbd>V</kbd> anywhere to open Quick Draw.');
  await wait(1.2);
  st.press = true; await wait(0.25);
  await app().evaluate(() => { window.D.show(0); });
  await anim(0.3, (p) => { app().evaluate((v) => window.D.show(v), easeOut(p)); });
  await app().evaluate(() => window.D.show(1));
  await ov.locator('.quick-draw-input').focus();
  await wait(0.25); st.press = false; await wait(1.1);
  await cap('Pick a clip with <kbd>↑</kbd> <kbd>↓</kbd> and hit <kbd>Enter</kbd> — it pastes straight into the app you were in.');
  await wait(0.6);
  await key('ArrowDown'); await key('ArrowDown'); await key('ArrowUp', 0.4); await key('ArrowUp', 0.7);
  st.press = true; await wait(0.2); st.press = false;
  await key('Enter', 0.1);
  await anim(0.3, (p) => { app().evaluate((v) => window.D.show(v), 1 - easeOut(p)); });
  await app().evaluate(() => window.D.show(0));
  const pasted = "Thanks for the update! I'll send the invoice over by Friday.";
  await anim(0.9, (p) => { app().evaluate((s) => window.D.text(s), pasted.slice(0, Math.round(pasted.length * easeOut(p)))); });
  await wait(2);
  await sceneOut();

  // 9 — settings
  await sceneIn('/');
  await cap('In Settings: change the shortcut, launch at startup, and check for updates.');
  await wait(0.3);
  await nav('Settings'); await wait(0.8);
  await moveTo(await toPoint('.hotkey-recorder'), 0.8); await wait(0.9);
  await pointClick('.toggle'); await wait(1.1);
  await moveTo(await toPoint('.btn-check'), 0.8); await wait(1.2);
  await sceneOut();

  // 10 — closing card → GitHub
  await cap('Get Quilvar free on GitHub.');
  await card(true); await wait(3.2); await cardOut();

  ff.stdin.end(); await ffDone;
  await browser.close(); srv.close();

  // sidecar subtitles
  const ts = (sec) => { const ms = Math.round(sec * 1000); const p = (n, l = 2) => String(n).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  fs.writeFileSync(OUT + '.srt', caps.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end ?? now())}\n${c.text}\n`).join('\n'));
  console.log('wrote', OUT + '.mp4', '—', now().toFixed(1) + 's,', frames, 'frames');
})().catch((e) => { console.error(e); process.exit(1); });
