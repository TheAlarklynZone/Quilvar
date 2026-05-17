import { useState, useEffect, useRef } from "react";
import { useClipStore } from "../store/clips";
import type { Clip } from "../types/clip";

interface QuickDrawProps {
  clips: Clip[];
  onClose: () => void;
}

export function QuickDraw({ clips, onClose }: QuickDrawProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { copyToClipboard } = useClipStore();

  const filtered = clips.filter((c) =>
    c.content.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (filtered[selectedIdx]) {
          handleSelect(filtered[selectedIdx]);
        }
        break;
    }
  }

  async function handleSelect(clip: Clip) {
    await copyToClipboard(clip.content);
    onClose();
  }

  return (
    <div className="quickdraw-backdrop" onClick={onClose}>
      <div
        className="quickdraw-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="quickdraw-header">
          <span className="quickdraw-logo">⚡ Quick Draw</span>
          <kbd className="quickdraw-kbd">ESC to close</kbd>
        </div>

        {/* Search */}
        <div className="quickdraw-search">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="quickdraw-input"
            type="text"
            placeholder="Search clips..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Results */}
        <div className="quickdraw-results">
          {filtered.length === 0 ? (
            <div className="quickdraw-empty">No clips found</div>
          ) : (
            filtered.slice(0, 8).map((clip, idx) => (
              <button
                key={clip.id}
                className={`quickdraw-item ${
                  idx === selectedIdx ? "quickdraw-item--selected" : ""
                }`}
                onClick={() => handleSelect(clip)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span className="quickdraw-item-content">
                  {clip.content.slice(0, 120)}
                  {clip.content.length > 120 ? "…" : ""}
                </span>
                <span className="quickdraw-item-meta">
                  {clip.pinned && <span className="pin-badge">📌</span>}
                  <span className="clip-chars">{clip.charCount}ch</span>
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="quickdraw-footer">
          <kbd>↑↓</kbd> navigate &nbsp;·&nbsp; <kbd>↵</kbd> copy &nbsp;·&nbsp; <kbd>ESC</kbd> close
        </div>
      </div>
    </div>
  );
}
