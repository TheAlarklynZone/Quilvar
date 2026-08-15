import { useState } from "react";
import { ClipCard } from "./ClipCard";
import { useClipStore } from "../store/clips";
import type { Clip } from "../types/clip";

interface ClipListProps {
  title: string;
  clips: Clip[];
  showClearAll?: boolean;
}

export function ClipList({ title, clips, showClearAll }: ClipListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { deleteClip, togglePin, copyToClipboard, moveToVault, clearAll } = useClipStore();

  const filtered = clips.filter((c) =>
    c.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearableCount = clips.filter((c) => !c.pinned).length;

  async function handleConfirmClear() {
    await clearAll();
    setConfirmingClear(false);
  }

  return (
    <div>
      {/* Header */}
      <div className="clip-list-header">
        <h1 className="clip-list-title">{title}</h1>
        <div className="clip-list-header-right">
          <span className="clip-list-count">{filtered.length} clips</span>
          {showClearAll && clearableCount > 0 && (
            <button className="clip-clear-all-btn" onClick={() => setConfirmingClear(true)}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="clip-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="clip-search-input"
          type="text"
          placeholder="Search clips…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Clip cards */}
      {filtered.length === 0 ? (
        <div className="clip-empty">
          <svg className="clip-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <p>No clips yet</p>
          <span>Copy something to get started!</span>
        </div>
      ) : (
        <div className="clip-list">
          {filtered.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onCopy={() => copyToClipboard(clip.content)}
              onDelete={() => deleteClip(clip.id)}
              onTogglePin={() => togglePin(clip.id)}
              onMoveToVault={() => moveToVault(clip.id)}
            />
          ))}
        </div>
      )}

      {confirmingClear && (
        <div className="confirm-overlay" onClick={() => setConfirmingClear(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">Clear all clips?</p>
            <p className="confirm-body">
              This permanently deletes <strong>{clearableCount}</strong> clip{clearableCount === 1 ? "" : "s"}.
              Pinned clips are kept.
            </p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setConfirmingClear(false)}>Cancel</button>
              <button className="confirm-danger-btn" onClick={handleConfirmClear}>
                Clear {clearableCount} clip{clearableCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
