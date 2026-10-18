import { useEffect, useRef, useState } from "react";
import { UpdaterPanel } from "./UpdaterPanel";
import { useClipStore, type AppSettings } from "../store/clips";

const isMac = navigator.platform.toLowerCase().includes("mac");

const KEY_NAMES: Record<string, string> = {
  Space: "Space", Enter: "Return", Tab: "Tab", Backspace: "Backspace", Delete: "Delete",
  Insert: "Insert", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Minus: "-", Equal: "=", Comma: ",", Period: ".", Slash: "/", Semicolon: ";",
  Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\", Backquote: "`",
};

// Turns a keydown into an Electron accelerator ("Shift+Alt+V"), or null while
// only modifiers are held / the key has no accelerator name.
function toAccelerator(e: React.KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push(isMac ? "Command" : "Super");

  const m = /^Key([A-Z])$/.exec(e.code) ?? /^Digit(\d)$/.exec(e.code) ?? /^(F\d{1,2})$/.exec(e.code);
  const key = m ? m[1] : KEY_NAMES[e.code];
  if (!key || mods.length === 0) return null;
  return [...mods, key].join("+");
}

const KEY_LABELS: Record<string, string> = isMac
  ? { Command: "⌘", Control: "⌃", Alt: "⌥", Shift: "⇧" }
  : { Control: "Ctrl", Super: "Win" };

function HotkeyKeys({ accelerator }: { accelerator: string }) {
  return (
    <span className="settings-hotkey">
      {accelerator.split("+").map((k) => <kbd key={k}>{KEY_LABELS[k] ?? k}</kbd>)}
    </span>
  );
}

export function SettingsView() {
  const [version, setVersion] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [vaultHasPin, setVaultHasPin] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recording, setRecording] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const recorderRef = useRef<HTMLButtonElement>(null);
  const { clips } = useClipStore();

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion);
    window.electronAPI.getStoragePath().then(setStoragePath);
    window.electronAPI.getSettings().then(setSettings);
    refreshVaultStatus();
  }, []);

  // While recording, the live global shortcut is suspended so pressing the
  // current combo is captured instead of triggering Quick Draw.
  function startRecording() {
    setHotkeyError(null);
    setRecording(true);
    recorderRef.current?.focus();
    window.electronAPI.suspendHotkey();
  }

  function stopRecording() {
    setRecording(false);
    window.electronAPI.resumeHotkey();
  }

  async function handleRecordKey(e: React.KeyboardEvent) {
    e.preventDefault();
    if (e.key === "Escape") { stopRecording(); return; }
    const accelerator = toAccelerator(e);
    if (!accelerator) return;
    setRecording(false);
    // set-hotkey re-registers on its own, so no separate resume is needed.
    const result = await window.electronAPI.setHotkey(accelerator);
    if (!result.ok) setHotkeyError(result.error ?? "Couldn't use that shortcut.");
    setSettings((s) => (s ? { ...s, hotkey: result.hotkey } : s));
  }

  async function handleResetHotkey() {
    setHotkeyError(null);
    const result = await window.electronAPI.resetHotkey();
    setSettings((s) => (s ? { ...s, hotkey: result.hotkey } : s));
  }

  async function handleToggleLaunch() {
    if (!settings) return;
    const enabled = await window.electronAPI.setLaunchAtStartup(!settings.launchAtStartup);
    setSettings({ ...settings, launchAtStartup: enabled });
  }

  function refreshVaultStatus() {
    window.electronAPI.vaultStatus().then((s) => setVaultHasPin(s.hasPin));
  }

  async function handleResetPin() {
    await window.electronAPI.resetVaultPin();
    setConfirmingReset(false);
    refreshVaultStatus();
  }

  return (
    <div className="settings-view">
      <div className="clip-list-header">
        <h1 className="clip-list-title">Settings</h1>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">Global Shortcut</h2>
        <p className="settings-section-desc">
          Opens Quick Draw from anywhere on your desktop, even when Quilvar isn't focused.
        </p>
        <div className="settings-hotkey-row">
          {settings && <HotkeyKeys accelerator={settings.hotkey} />}
          {isMac && settings?.hotkey === settings?.defaultHotkey && (
            <HotkeyKeys accelerator="Command+Shift+V" />
          )}
          <button
            ref={recorderRef}
            className={`hotkey-recorder ${recording ? "hotkey-recorder--recording" : ""}`}
            onClick={recording ? stopRecording : startRecording}
            onKeyDown={recording ? handleRecordKey : undefined}
            onBlur={() => recording && stopRecording()}
          >
            {recording ? "Press a shortcut… (Esc to cancel)" : "Change"}
          </button>
          {settings && settings.hotkey !== settings.defaultHotkey && !recording && (
            <button className="settings-danger-link" onClick={handleResetHotkey}>Reset to default</button>
          )}
        </div>
        {hotkeyError && <p className="hotkey-error">{hotkeyError}</p>}
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Startup</h2>
        <div className="settings-row">
          <span>Launch Quilvar when I sign in</span>
          <button
            className="toggle"
            role="switch"
            aria-checked={!!settings?.launchAtStartup}
            aria-label="Launch at startup"
            disabled={!settings?.launchSupported}
            onClick={handleToggleLaunch}
          />
        </div>
        <p className="settings-section-desc">
          {settings && !settings.launchSupported
            ? "Not available here — launch at startup works in the installed app on Windows and macOS."
            : "Starts quietly in the tray so your clipboard history is always being saved."}
        </p>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Quilvault</h2>
        {vaultHasPin ? (
          <>
            <p className="settings-section-desc">
              A PIN is set for your vault. Forgot it? Resetting clears the PIN — your vault
              clips stay intact, and you'll set a new PIN next time you open Quilvault.
            </p>
            <button className="settings-danger-link" onClick={() => setConfirmingReset(true)}>
              Reset Quilvault PIN
            </button>
          </>
        ) : (
          <p className="settings-section-desc">
            No PIN set yet — set one from the Quilvault tab to start using it.
          </p>
        )}
      </section>

      <section className="settings-section">
        <UpdaterPanel />
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Storage</h2>
        <div className="settings-row">
          <span>Clip history</span>
          <span className="settings-row-value">{clips.length} / 500 clips</span>
        </div>
        {storagePath && (
          <div className="settings-row">
            <span>Local database</span>
            <span className="settings-row-value settings-row-path" title={storagePath}>{storagePath}</span>
          </div>
        )}
        <p className="settings-section-desc">
          Everything is stored locally on this device. Nothing is ever sent to a server.
        </p>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">About</h2>
        <div className="settings-row">
          <span>Version</span>
          <span className="settings-row-value">{version || "—"}</span>
        </div>
      </section>

      {confirmingReset && (
        <div className="confirm-overlay" onClick={() => setConfirmingReset(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">Reset Quilvault PIN?</p>
            <p className="confirm-body">
              Your vault clips stay intact. But until you set a new PIN, anyone with access to
              this app can set one themselves and see what's in the vault.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmingReset(false)}>Cancel</button>
              <button className="confirm-danger-btn" onClick={handleResetPin}>Reset PIN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
