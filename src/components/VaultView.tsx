import { useEffect, useState } from "react";
import type { Clip } from "../types/clip";
import { formatTimeAgo } from "../lib/time";

type Stage = "loading" | "setup" | "locked" | "unlocked" | "unavailable";

export function VaultView() {
  const [stage, setStage] = useState<Stage>("loading");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refreshStatus() {
    const status = await window.electronAPI.vaultStatus();
    if (status.unlocked) {
      await loadVaultClips();
    } else {
      setStage(status.hasPin ? "locked" : "setup");
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function loadVaultClips() {
    const data = await window.electronAPI.getVaultClips();
    setClips(data);
    setStage("unlocked");
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length < 4) return setError("Use at least 4 digits or characters.");
    if (pin !== confirmPin) return setError("PINs don't match.");
    try {
      await window.electronAPI.vaultSetPin(pin);
      setPin(""); setConfirmPin("");
      await loadVaultClips();
    } catch (e: any) {
      setStage("unavailable");
      setError(e?.message ?? "Encryption isn't available on this device.");
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const ok = await window.electronAPI.vaultUnlock(pin);
      setPin("");
      if (ok) {
        await loadVaultClips();
      } else {
        setError("Incorrect PIN.");
      }
    } catch (e: any) {
      setStage("unavailable");
      setError(e?.message ?? "Encryption isn't available on this device.");
    }
  }

  async function handleLock() {
    await window.electronAPI.vaultLock();
    setClips([]);
    setStage("locked");
  }

  async function handleCopy(clip: Clip) {
    await window.electronAPI.copyClip(clip.content);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleRestore(id: string) {
    await window.electronAPI.restoreFromVault(id);
    setClips((cs) => cs.filter((c) => c.id !== id));
  }

  async function handleDelete(id: string) {
    await window.electronAPI.removeFromVault(id);
    setClips((cs) => cs.filter((c) => c.id !== id));
  }

  return (
    <div className="vault-view">
      <div className="clip-list-header">
        <h1 className="clip-list-title">Quilvault</h1>
        {stage === "unlocked" && (
          <button className="vault-lock-btn" onClick={handleLock}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Lock
          </button>
        )}
      </div>

      {stage === "loading" && <p className="vault-hint">Loading…</p>}

      {stage === "unavailable" && (
        <div className="vault-gate">
          <p className="vault-gate-title">Quilvault is unavailable</p>
          <p className="vault-hint">{error ?? "This device has no OS keychain to encrypt against."}</p>
        </div>
      )}

      {(stage === "setup" || stage === "locked") && (
        <div className="vault-gate">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="vault-gate-icon">
            <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {stage === "setup" ? (
            <>
              <p className="vault-gate-title">Set up Quilvault</p>
              <p className="vault-hint">
                Clips you move here are encrypted at rest with your OS keychain and hidden
                behind this PIN — even Quilvar won't show them without it.
              </p>
              <form className="vault-form" onSubmit={handleSetup}>
                <input
                  className="vault-input"
                  type="password"
                  placeholder="Choose a PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                />
                <input
                  className="vault-input"
                  type="password"
                  placeholder="Confirm PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                />
                {error && <p className="vault-error">{error}</p>}
                <button className="vault-submit" type="submit">Create Quilvault</button>
              </form>
            </>
          ) : (
            <>
              <p className="vault-gate-title">Quilvault is locked</p>
              <form className="vault-form" onSubmit={handleUnlock}>
                <input
                  className="vault-input"
                  type="password"
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                />
                {error && <p className="vault-error">{error}</p>}
                <button className="vault-submit" type="submit">Unlock</button>
              </form>
            </>
          )}
        </div>
      )}

      {stage === "unlocked" && (
        clips.length === 0 ? (
          <div className="clip-empty">
            <svg className="clip-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p>Quilvault is empty</p>
            <span>Move a sensitive clip here from History or Pinned.</span>
          </div>
        ) : (
          <div className="clip-list">
            {clips.map((clip) => (
              <div key={clip.id} className="clip-card">
                <div className="clip-card-content">
                  <span className="clip-text">
                    {clip.content.slice(0, 200)}{clip.content.length > 200 ? "…" : ""}
                  </span>
                </div>
                <div className="clip-card-footer">
                  <div className="clip-meta">
                    <span className="clip-time">{formatTimeAgo(clip.timestamp)}</span>
                    <span className="clip-stats">{clip.charCount} chars · {clip.wordCount} words</span>
                  </div>
                  <div className="clip-actions">
                    {copiedId === clip.id ? (
                      <span className="clip-copied">✓ Copied!</span>
                    ) : (
                      <button className="clip-btn" onClick={() => handleCopy(clip)} title="Copy">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    )}
                    <button className="clip-btn" onClick={() => handleRestore(clip.id)} title="Restore to History">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                      </svg>
                    </button>
                    <button className="clip-btn clip-btn--danger" onClick={() => handleDelete(clip.id)} title="Delete permanently">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
