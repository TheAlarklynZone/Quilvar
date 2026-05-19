const { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, ipcMain, globalShortcut, shell } = require('electron');
const path = require('path');
const db = require('./db');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

let mainWindow = null;
let tray = null;
let clipboardWatcher = null;
let lastClipText = '';

// ── App single instance lock ──────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    show: true,
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

  // Hide to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Hide to tray on minimize
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ── System tray ───────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('Quilvar — Store your clips. Paste with precision.');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Quilvar',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Left-click tray icon to toggle window
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Clipboard watcher ─────────────────────────────────────────────────────────
function startClipboardWatcher() {
  lastClipText = clipboard.readText();

  clipboardWatcher = setInterval(() => {
    const text = clipboard.readText();
    if (text && text !== lastClipText && text.trim().length > 0) {
      lastClipText = text;
      const clip = db.addClip(text);
      if (mainWindow && clip) {
        mainWindow.webContents.send('clip:new', clip);
      }
    }
  }, 500);
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
function registerIPC() {
  ipcMain.handle('clips:get', () => db.getClips());
  ipcMain.handle('clips:delete', (_, id) => db.deleteClip(id));
  ipcMain.handle('clips:toggle-pin', (_, id) => db.togglePin(id));
  ipcMain.handle('clips:copy', (_, content) => {
    clipboard.writeText(content);
    lastClipText = content; // prevent re-capture
    return true;
  });
  ipcMain.handle('app:quit', () => {
    app.isQuitting = true;
    app.quit();
  });
  ipcMain.handle('app:version', () => app.getVersion());
}

// ── Global shortcut (QuickDraw) ───────────────────────────────────────────────
function registerShortcuts() {
  globalShortcut.register('Shift+Alt+V', () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('quickdraw:open');
      }
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  db.init();
  registerIPC();
  createWindow();
  createTray();
  registerShortcuts();
  startClipboardWatcher();

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', (e) => {
  // Never quit on window close — stay alive in tray
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (clipboardWatcher) clearInterval(clipboardWatcher);
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
