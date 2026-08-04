import { useState } from "react";
import type { Clip } from "../types/clip";
import { formatTimeAgo } from "../lib/time";
import { QuilvertPanel } from "./QuilvertPanel";

interface ClipCardProps {
  clip: Clip;
  onCopy: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onMoveToVault?: () => Promise<void>;
}

export function ClipCard({ clip, onCopy, onDelete, onTogglePin, onMoveToVault }: ClipCardProps) {
  const [copied, setCopied] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [quilvertOpen, setQuilvertOpen] = useState(false);

  async function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleMoveToVault() {
    if (!onMoveToVault) return;
    try {
      await onMoveToVault();
    } catch (e: any) {
      setVaultError(e?.message?.includes('locked') ? 'Unlock Quilvault first' : 'Couldn\'t move to vault');
      setTimeout(() => setVaultError(null), 2000);
    }
  }

  const timeAgo = formatTimeAgo(clip.timestamp);

  return (
    <div className={`clip-card ${clip.pinned ? "clip-card--pinned" : ""}`}>
      {/* Content preview */}
      <button className="clip-card-content" onClick={handleCopy}>
        <span className="clip-text">
          {clip.content.slice(0, 200)}
          {clip.content.length > 200 ? "…" : ""}
        </span>
      </button>

      {/* Footer */}
      <div className="clip-card-footer">
        <div className="clip-meta">
          {clip.pinned && <span className="clip-pin-badge">📌 Pinned</span>}
          <span className="clip-time">{timeAgo}</span>
          <span className="clip-stats">{clip.charCount} chars · {clip.wordCount} words</span>
        </div>

        <div className="clip-actions">
          {vaultError ? (
            <span className="clip-copied clip-copied--error">{vaultError}</span>
          ) : copied ? (
            <span className="clip-copied">✓ Copied!</span>
          ) : (
            <button className="clip-btn" onClick={handleCopy} title="Copy">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          )}
          <button
            className={`clip-btn ${clip.pinned ? "clip-btn--active" : ""}`}
            onClick={onTogglePin}
            title={clip.pinned ? "Unpin" : "Pin"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 17-7 4 1.5-7.5L2 9l7.5-1L12 2l2.5 6L22 9l-4.5 4.5L19 21z"/>
            </svg>
          </button>
          {onMoveToVault && (
            <button className="clip-btn" onClick={handleMoveToVault} title="Move to Quilvault">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </button>
          )}
          <button className="clip-btn" onClick={() => setQuilvertOpen(true)} title="Quilvert — clean up text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 4 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/>
            </svg>
          </button>
          <button className="clip-btn clip-btn--danger" onClick={onDelete} title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      {quilvertOpen && (
        <QuilvertPanel content={clip.content} onClose={() => setQuilvertOpen(false)} />
      )}
    </div>
  );
}
