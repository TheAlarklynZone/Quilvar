import { useEffect, useState } from "react";
import { UpdaterPanel } from "./UpdaterPanel";
import { useClipStore } from "../store/clips";

const isMac = navigator.platform.toLowerCase().includes("mac");

export function SettingsView() {
  const [version, setVersion] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [vaultHasPin, setVaultHasPin] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const { clips } = useClipStore();

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion);
    window.electronAPI.getStoragePath().then(setStoragePath);
    refreshVaultStatus();
  }, []);

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
          <span className="settings-hotkey"><kbd>Shift</kbd><kbd>Alt</kbd><kbd>V</kbd></span>
          {isMac && <span className="settings-hotkey"><kbd>⌘</kbd><kbd>Shift</kbd><kbd>V</kbd></span>}
        </div>
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
