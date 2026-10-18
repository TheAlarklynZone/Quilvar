const { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, ipcMain, globalShortcut, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('child_process');
const { createHash } = require('crypto');
const path = require('path');
const db = require('./db');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

const DEFAULT_HOTKEY = 'Shift+Alt+V';
const MAC_ALIAS_HOTKEY = 'Command+Shift+V';
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const LOGIN_ARGS = ['--hidden'];

let mainWindow = null;
let quickDrawWindow = null;
let tray = null;
let clipboardWatcher = null;
let lastClipText = '';
let lastImageHash = '';
let currentHotkey = DEFAULT_HOTKEY;
let registeredHotkeys = [];

// Launched by the OS at login → stay in the tray instead of popping a window.
const startHidden =
  process.argv.includes('--hidden') ||
  (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin);

// ── App single instance lock ──────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    show: !startHidden,
    frame: true,
    resizable: true,
    backgroundColor: '#0f0e0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });

  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ── Quick Draw overlay ────────────────────────────────────────────────────────
// A small frameless window that floats over whatever app you're in. It's
// created up front (hidden) so the hotkey feels instant.
function createQuickDrawWindow() {
  quickDrawWindow = new BrowserWindow({
    width: 560,
    height: 440,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  quickDrawWindow.setAlwaysOnTop(true, 'screen-saver');
  quickDrawWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    quickDrawWindow.loadURL('http://localhost:5173/#quickdraw');
  } else {
    quickDrawWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: 'quickdraw' });
  }

  quickDrawWindow.on('blur', () => {
    if (quickDrawWindow && quickDrawWindow.isVisible()) quickDrawWindow.hide();
  });
}

function showQuickDraw() {
  if (!quickDrawWindow || quickDrawWindow.isDestroyed()) createQuickDrawWindow();

  // Open on whichever screen the cursor is on, a little above centre.
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const [w, h] = quickDrawWindow.getSize();
  quickDrawWindow.setPosition(
    Math.round(workArea.x + (workArea.width - w) / 2),
    Math.round(workArea.y + (workArea.height - h) / 3),
  );
  quickDrawWindow.show();
  quickDrawWindow.focus();
  quickDrawWindow.webContents.send('quickdraw:open');
}

function toggleQuickDraw() {
  if (quickDrawWindow && !quickDrawWindow.isDestroyed() && quickDrawWindow.isVisible()) {
    hideQuickDraw();
  } else {
    showQuickDraw();
  }
}

function hideQuickDraw() {
  if (!quickDrawWindow || quickDrawWindow.isDestroyed()) return;
  quickDrawWindow.hide();
  // On macOS hiding a window leaves Quilvar frontmost; hide the app so focus
  // returns to the app the user was typing in.
  if (process.platform === 'darwin') app.hide();
}

// Types Ctrl/Cmd+V into whichever app now has focus. Done through each OS's own
// scripting host so there's no native module to build. If it isn't available
// (no Accessibility permission, no xdotool) the clip is still on the clipboard.
function simulatePaste() {
  const done = (err) => { if (err && isDev) console.warn('[quilvar] auto-paste unavailable:', err.message); };
  if (process.platform === 'win32') {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
        "(New-Object -ComObject WScript.Shell).SendKeys('^v')"],
      { windowsHide: true },
      done,
    );
  } else if (process.platform === 'darwin') {
    execFile('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'], done);
  } else {
    execFile('xdotool', ['key', '--clearmodifiers', 'ctrl+v'], done);
  }
}

// ── System tray ───────────────────────────────────────────────────────────────
function createTray() {
  // Windows needs .ico for crisp tray rendering
  // macOS & Linux use .png (nativeImage handles scaling)
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const iconCandidates = isWin
    ? [
        path.join(__dirname, '..', 'build', 'icon.ico'),
        path.join(__dirname, '..', 'build', 'icon.png'),
      ]
    : [
        path.join(__dirname, '..', 'build', 'icon.png'),
        path.join(__dirname, '..', 'build', 'tray-icon.png'),
      ];

  let icon = nativeImage.createEmpty();
  for (const candidate of iconCandidates) {
    try {
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) {
        // macOS tray wants 16x16 or 18x18 marked as template
        // Windows .ico already has all sizes embedded — don't resize
        if (!isWin) {
          icon = img.resize({ width: 16, height: 16 });
          if (isMac) icon.setTemplateImage(true); // adapts to dark/light menubar
        } else {
          icon = img;
        }
        break;
      }
    } catch { /* try next */ }
  }

  tray = new Tray(icon);
  tray.setToolTip('Quilvar — Store your clips. Paste with precision.');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Quilvar', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow.isVisible()) { mainWindow.hide(); }
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

// ── Clipboard watcher ─────────────────────────────────────────────────────────
function hashBitmap(image) {
  return createHash('sha1').update(image.toBitmap()).digest('hex');
}

function broadcastClip(clip) {
  if (mainWindow && clip) mainWindow.webContents.send('clip:new', clip);
}

function captureImage() {
  if (!clipboard.availableFormats().some((f) => f.startsWith('image/'))) return;
  const image = clipboard.readImage();
  if (image.isEmpty()) return;

  const hash = hashBitmap(image);
  if (hash === lastImageHash) return;
  lastImageHash = hash;

  const png = image.toPNG();
  if (png.length > MAX_IMAGE_BYTES) return;

  const { width, height } = image.getSize();
  const thumb = width > 260 ? image.resize({ width: 260 }) : image;
  broadcastClip(db.addImageClip({ png, hash, width, height, thumbnail: thumb.toDataURL() }));
}

function startClipboardWatcher() {
  lastClipText = clipboard.readText();
  const initial = clipboard.readImage();
  lastImageHash = initial.isEmpty() ? '' : hashBitmap(initial);

  clipboardWatcher = setInterval(() => {
    const text = clipboard.readText();
    if (text && text !== lastClipText && text.trim().length > 0) {
      lastClipText = text;
      broadcastClip(db.addClip(text));
    } else if (!text) {
      captureImage();
    }
  }, 500);
}

// Puts a stored clip back on the system clipboard (text or image) and marks it
// as already-seen so the watcher doesn't re-capture it.
function writeClipToClipboard(clip) {
  if (clip.type === 'image') {
    const file = db.getClipImagePath(clip.id);
    if (!file) return false;
    clipboard.writeImage(nativeImage.createFromPath(file));
    lastImageHash = hashBitmap(clipboard.readImage());
  } else {
    clipboard.writeText(clip.content);
    lastClipText = clip.content;
  }
  return true;
}

// ── Auto updater ────────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return;
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('updater:available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('updater:not-available');
  });
  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('updater:progress', {
      downloaded: progress.transferred,
      total: progress.total,
    });
  });
  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('updater:downloaded');
    autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('updater:error', err.message);
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
function registerIPC() {
  ipcMain.handle('clips:get', () => db.getClips());
  ipcMain.handle('clips:delete', (_, id) => db.deleteClip(id));
  ipcMain.handle('clips:clear-all', () => db.clearNonPinnedClips());
  ipcMain.handle('clips:toggle-pin', (_, id) => db.togglePin(id));
  ipcMain.handle('clips:copy', (_, content) => {
    clipboard.writeText(content);
    lastClipText = content;
    return true;
  });
  ipcMain.handle('clips:copy-clip', (_, id) => {
    const clip = db.getClipById(id);
    return clip ? writeClipToClipboard(clip) : false;
  });
  ipcMain.handle('quickdraw:select', (_, id) => {
    const clip = db.getClipById(id);
    if (!clip || !writeClipToClipboard(clip)) { hideQuickDraw(); return false; }
    hideQuickDraw();
    // Give the OS a beat to hand focus back before sending the keystroke.
    setTimeout(simulatePaste, 150);
    return true;
  });
  ipcMain.handle('quickdraw:close', () => hideQuickDraw());

  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:set-hotkey', (_, accelerator) => setHotkey(accelerator));
  ipcMain.handle('settings:reset-hotkey', () => setHotkey(DEFAULT_HOTKEY));
  ipcMain.handle('settings:suspend-hotkey', () => { unregisterHotkeys(); return true; });
  ipcMain.handle('settings:resume-hotkey', () => { registerHotkeys(currentHotkey); return true; });
  ipcMain.handle('settings:set-launch', (_, enabled) => setLaunchAtStartup(!!enabled));

  ipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit(); });
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:storage-path', () => app.getPath('userData'));

  ipcMain.handle('updater:check', async () => {
    if (isDev) return { available: false, version: null };
    // Let failures (network errors, no publish feed, etc.) propagate as a
    // rejected IPC call so the renderer can show a real error instead of a
    // false "you're up to date".
    const result = await autoUpdater.checkForUpdates();
    const available = !!result?.updateInfo?.version && result.updateInfo.version !== app.getVersion();
    return { available, version: result?.updateInfo?.version ?? null };
  });
  ipcMain.handle('updater:download', async () => {
    if (isDev) return;
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle('quivers:get', () => db.getQuivers());
  ipcMain.handle('quivers:create', (_, name) => db.createQuiver(name));
  ipcMain.handle('quivers:rename', (_, id, name) => db.renameQuiver(id, name));
  ipcMain.handle('quivers:delete', (_, id) => db.deleteQuiver(id));
  ipcMain.handle('quivers:add-clip', (_, quiverId, clipId) => db.addClipToQuiver(quiverId, clipId));
  ipcMain.handle('quivers:remove-clip', (_, quiverId, clipId) => db.removeClipFromQuiver(quiverId, clipId));

  ipcMain.handle('vault:status', () => db.vaultStatus());
  ipcMain.handle('vault:set-pin', (_, pin) => db.vaultSetPin(pin));
  ipcMain.handle('vault:unlock', (_, pin) => db.vaultUnlock(pin));
  ipcMain.handle('vault:lock', () => db.vaultLock());
  ipcMain.handle('vault:reset-pin', () => db.vaultResetPin());
  ipcMain.handle('vault:get-clips', () => db.getVaultClips());
  ipcMain.handle('vault:add', (_, clipId) => db.addToVault(clipId));
  ipcMain.handle('vault:remove', (_, id) => db.removeFromVault(id));
  ipcMain.handle('vault:restore', (_, id) => db.restoreFromVault(id));
}

// ── Settings: global shortcut + launch at startup ─────────────────────────────
function unregisterHotkeys() {
  registeredHotkeys.forEach((accel) => globalShortcut.unregister(accel));
  registeredHotkeys = [];
}

// Registers the Quick Draw hotkey; returns false (and leaves nothing
// registered) if the OS refuses it — invalid, or already taken by another app.
function registerHotkeys(accelerator) {
  unregisterHotkeys();
  const wanted = [accelerator];
  // macOS also gets the Cmd+Shift+V convention alongside the default shortcut.
  if (process.platform === 'darwin' && accelerator === DEFAULT_HOTKEY) wanted.push(MAC_ALIAS_HOTKEY);

  for (const accel of wanted) {
    let ok = false;
    try { ok = globalShortcut.register(accel, toggleQuickDraw); } catch { ok = false; }
    if (ok) registeredHotkeys.push(accel);
    else if (accel === accelerator) { unregisterHotkeys(); return false; }
  }
  return true;
}

function setHotkey(accelerator) {
  const previous = currentHotkey;
  if (typeof accelerator !== 'string' || !accelerator.trim()) {
    return { ok: false, error: 'Invalid shortcut.', hotkey: previous };
  }
  if (!registerHotkeys(accelerator)) {
    registerHotkeys(previous);
    return { ok: false, error: 'That shortcut is taken by another app or isn\'t supported.', hotkey: previous };
  }
  currentHotkey = accelerator;
  if (accelerator === DEFAULT_HOTKEY) db.deleteSetting('hotkey');
  else db.setSetting('hotkey', accelerator);
  return { ok: true, hotkey: accelerator };
}

// Login items are only supported on macOS and Windows, and a dev run would
// register the bare Electron binary, so both are reported as unsupported.
const launchSupported = () => app.isPackaged && process.platform !== 'linux';

function setLaunchAtStartup(enabled) {
  if (!launchSupported()) return false;
  app.setLoginItemSettings({ openAtLogin: enabled, args: LOGIN_ARGS });
  return app.getLoginItemSettings({ args: LOGIN_ARGS }).openAtLogin;
}

function getSettings() {
  return {
    hotkey: currentHotkey,
    defaultHotkey: DEFAULT_HOTKEY,
    launchSupported: launchSupported(),
    launchAtStartup: launchSupported() && app.getLoginItemSettings({ args: LOGIN_ARGS }).openAtLogin,
  };
}

function registerShortcuts() {
  const saved = db.getSetting('hotkey', DEFAULT_HOTKEY);
  if (registerHotkeys(saved)) { currentHotkey = saved; return; }
  // A saved shortcut that no longer registers falls back to the default.
  currentHotkey = DEFAULT_HOTKEY;
  registerHotkeys(DEFAULT_HOTKEY);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  db.init();
  registerIPC();
  createWindow();
  createQuickDrawWindow();
  createTray();
  registerShortcuts();
  startClipboardWatcher();
  setupAutoUpdater();

  app.on('activate', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', (e) => { e.preventDefault(); });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (clipboardWatcher) clearInterval(clipboardWatcher);
});

app.on('before-quit', () => { app.isQuitting = true; });
