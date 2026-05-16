# Quilvar - Store your clips. Paste with precision. 
### App Coming Soon!

---

## What is Quilvar?

Quilvar is a **lightweight clipboard layer** that enhances your native system clipboard — without breaking it.

Your OS clipboard still receives the latest copied item normally. Quilvar quietly saves a persistent local history so older copied text can be searched, restored, pinned, and pasted again.

> Your copied text does not disappear just because you copied something else.

---

## Core Promise

- 🪶 **Never lose a copied clip again** — recover, search, pin, and organize
- ⚡ **Quick Draw** — instant access via `Shift + Alt + V` from anywhere
- 📁 **Quivers** — organize clips into named collections (Writing, Code, Links, Prompts…)
- 🔒 **Quilvault** — private/encrypted storage for sensitive clips
- 🛠️ **Quilvert** — clean, convert, and transform text on paste
- 🗺️ **Quivergraph** — searchable archive and history view

---

## Platform Support

| Platform | Status |
|---|---|
| Windows | ✅ Planned (system tray) |
| macOS | ✅ Planned (menu bar) |
| Linux | ✅ Planned (tray/AppIndicator) |

---

## Brand Architecture

| Name | Role |
|---|---|
| **Quilvar** | Main application and product identity |
| **Quick Draw** | Global hotkey panel / fast paste overlay |
| **Quivers** | Organized collections/folders of pinned clips |
| **Quivergraph** | Searchable history/archive view |
| **Quilvault** | Private/encrypted storage for sensitive clips |
| **Quilvert** | Text cleanup and conversion tools |
| **Fletch** | Potential formatting/cleanup action language |
| **Targets** | App rules, exclusions, and privacy controls |
| **Quilpository** | Internal/local database or README-lore term for the clip repository |

---

## Taglines

- *Store your clips. Paste with precision.*
- *A quick-draw clipboard archive for every desktop.*
- *Your clipboard, ready at hand.*
- *Copy once. Draw it anytime.*

---

## Core Features (MVP)

| Feature | Details |
|---|---|
| **Clipboard Capture** | Text-first. Links, code, Markdown stored as text. No duplicate spam. |
| **History** | Searchable list with timestamps, deletion, and restoration. |
| **Pins** | 50 pinned clips by default. Persistent, renameable, reorderable. |
| **Quivers** | Folders for organized pinned clips. |
| **Quick Draw** | Compact hotkey panel for fast search and paste. |
| **Quilvault** | Private/encrypted clips, app exclusions, pause capture. |
| **Quilvert** | Plain-text paste, trim whitespace, clean URLs, prettify JSON, Markdown/code conversions. |
| **Settings** | Login startup, history size, retention, theme, hotkeys, backup/export/import. |

---

## Global Shortcut

Default: **`Shift + Alt + V`**

- Brings up Quilvar from anywhere on desktop
- If hidden or minimized, shows the window; if already open, focuses it
- Search field auto-focuses
- Fully customizable / disableable
- Mac equivalent: `Option + Shift + V`

---

## Locked Technical Decisions

- **Framework:** Tauri (lightweight, cross-platform, Rust-backed)
- **Storage:** Local-first by default; sync is opt-in later
- **Clipboard behavior:** Quilvar *enhances* the OS clipboard — never replaces it
- **Dark mode:** Required; default follows system theme, manual toggle available
- **Window behavior:** Closing sends to tray, quitting must be intentional

### Tray Right-Click Menu
`Open Quilvar` · `Quick Draw` · `Pause Capture` · `Recent Clips` · `Pinned Clips` · `Settings` · `Quit`

### Clip Right-Click Menu
`Copy` · `Paste` · `Paste as plain text` · `Pin/Unpin` · `Add to Quiver` · `Rename` · `Delete` · `View details` · `Move to Quilvault`

---

## Name & Brand Logic

**Quilvar** combines three meanings:

- **Quill** — writing, text, authorship
- **Quiver** — quick-draw storage and precision
- **var** — variables, the building blocks of code and reusable values

> *A writer/dev tool that stores reusable text variables you can draw from anytime.*

The name is distinct without being unreadable. It carries writerly, dev, and quick-draw metaphors simultaneously — and naturally spawned an entire ecosystem of sub-brand names.

---

## Tech Stack

- **Runtime:** [Tauri](https://tauri.app/) (cross-platform desktop via Rust + WebView)
- **Frontend:** Web-based UI (HTML/CSS/JS)
- **Storage:** Local SQLite or similar (exact TBD)
- **Repo org:** [TheAlarklynZone](https://github.com/TheAlarklynZone)

---

## Status

> 🚧 **Early development.** MVP in planning phase.  
> Handoff destination: [Bolt.new](https://bolt.new)

---

## Open Questions (for next planning pass)

- Should `Shift + Alt + V` open the full Quilvar window or Quick Draw overlay by default?
- Should duplicate copies be ignored, moved to top, or counted as repeated usage?
- Should MVP keep copied text forever or offer a first-run retention setting?
- Should 50 pinned clips be a hard limit, configurable, or free-tier limit?
- Should images be included in v1, or stay text-only for speed?
- Should sensitive detection be in MVP or delayed to Quilvault?

---

## April Fools — Forbidden Beta Names

> *During early development, Quilvar narrowly avoided several naming catastrophes. Every April Fools, users may vote to temporarily rename the app to one of these disasters.*

Highlights include: **Pastesus Christ**, **ClipHOA**, **Clippnado**, **CliplarkiusEJ**, and **AllYourClipsAreBelongToUs**.

The full cursed name archive is available for those brave enough to seek it.

---

## Credits
Designed and created by **Alarkius Elvya Jay**  
Part of the [TheAlarklynZone](https://github.com/TheAlarklynZone) project suite  

---

*Quilvar — fantasy-tech enough to feel like Alaria. Clean enough to ship.*
