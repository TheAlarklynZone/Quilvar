# Quilvar — Store your clips. Paste with precision.

> A lightweight clipboard manager for Windows, macOS, and Linux.  
> Your copied text does not disappear just because you copied something else.

---

## What is Quilvar?

Quilvar is a **local-first clipboard history manager** that runs quietly in your system tray. It captures everything you copy, lets you search and re-paste anything from your history, and gives you a fast global hotkey overlay called **Quick Draw** to pull clips from anywhere on your desktop.

Your OS clipboard works exactly as normal — Quilvar just makes sure nothing gets lost.

---

## Features

| Feature | Details |
|---|---|
| **Clipboard History** | Captures all copied text automatically, no duplicates, up to 500 clips |
| **Quick Draw** | Global hotkey overlay (`Shift + Alt + V`) for instant search + paste |
| **Pins** | Pin clips to keep them permanently accessible |
| **Quivers** | Organize pinned clips into named collections |
| **Quilvault** | Private/encrypted storage for sensitive clips |
| **Quilvert** | Text cleanup and conversion tools (plain-text paste, trim, prettify JSON, etc.) |
| **System Tray** | Runs in the background — close sends to tray, quit is intentional |
| **Auto-updater** | Built-in update checks via GitHub Releases |

---

## Platform Support

| Platform | Status |
|---|---|
| Windows | ✅ Supported |
| macOS | ✅ Supported |
| Linux | ✅ Supported |

---

## Global Shortcut

Default: **`Shift + Alt + V`**

Opens the Quick Draw overlay from anywhere on your desktop. Auto-focuses the search field. Fully customizable in Settings.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | [Electron](https://www.electronjs.org/) |
| **Frontend** | React + TypeScript + Vite |
| **Styling** | Tailwind CSS + custom design system (Satoshi font) |
| **Storage** | SQLite via `better-sqlite3` (local-first, no cloud) |
| **Tray / IPC** | Electron `Tray`, `ipcMain`/`ipcRenderer`, `contextBridge` |
| **Build** | `electron-builder` (Win/Mac/Linux) |

---

## Project Structure

```
quilvar/
├── electron/
│   ├── main.js        # App lifecycle, tray, clipboard watcher, IPC handlers
│   ├── preload.js     # Secure contextBridge → window.electronAPI
│   └── db.js          # SQLite schema, clip CRUD, deduplication
├── src/
│   ├── components/    # React UI components
│   ├── store/         # Clip state (electronAPI bridge)
│   ├── styles/        # globals.css — full component design system
│   └── main.tsx       # App entry
├── build/
│   ├── icon.png       # 256x256 — Linux + electron-builder
│   ├── icon.icns      # macOS (6 sizes)
│   ├── icon.ico       # Windows (7 sizes, proper BMP format)
│   └── tray-icon.png  # 32x32 system tray icon
└── .github/workflows/
    └── release.yml    # CI: Win + Mac + Linux builds on tag push
```

---

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (Electron + Vite HMR)
npm run electron:dev

# Build for production
npm run build

# Package for release
npm run electron:build
```

---

## Releasing

Push a tag to trigger the CI release workflow:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Builds Windows (`.exe`/`.msi`), macOS (`.dmg`), and Linux (`.AppImage`/`.deb`) automatically via GitHub Actions.

---

## Brand Architecture

| Name | Role |
|---|---|
| **Quilvar** | Main app and product identity |
| **Quick Draw** | Global hotkey panel / fast paste overlay |
| **Quivers** | Organized clip collections/folders |
| **Quivergraph** | Searchable history/archive view |
| **Quilvault** | Private/encrypted clip storage |
| **Quilvert** | Text cleanup and conversion tools |
| **Targets** | App rules, exclusions, and privacy controls |

---

## Name & Brand Logic

**Quilvar** combines three meanings:

- **Quill** — writing, text, authorship
- **Quiver** — quick-draw storage and precision  
- **var** — variables, the building blocks of code and reusable values

> *A writer/dev tool that stores reusable text variables you can draw from anytime.*

---

## Status

> 🚧 **Early development — MVP in progress.**  
> Migrated from Tauri → Electron on May 18, 2026. See [Issue #1](https://github.com/TheAlarklynZone/Quilvar/issues/1) for full migration history.

---

## Credits

Designed and created by **Alarkius Elvya Jay**  
Part of the [TheAlarklynZone](https://github.com/TheAlarklynZone) project suite

---

*Quilvar — fantasy-tech enough to feel like Alarkius' other apps. Clean enough to ship.*
