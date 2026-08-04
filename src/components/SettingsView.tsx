import { useEffect, useState } from "react";
import { UpdaterPanel } from "./UpdaterPanel";
import { useClipStore } from "../store/clips";

const isMac = navigator.platform.toLowerCase().includes("mac");

export function SettingsView() {
  const [version, setVersion] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const { clips } = useClipStore();

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion);
    window.electronAPI.getStoragePath().then(setStoragePath);
  }, []);

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
    </div>
  );
}
