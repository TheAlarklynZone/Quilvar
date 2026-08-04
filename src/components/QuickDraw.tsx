import { useState, useEffect, useRef } from "react";
import { useClipStore } from "../store/clips";
import { formatTimeAgo } from "../lib/time";
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
    <div className="quick-draw-overlay" onClick={onClose}>
      <div
        className="quick-draw-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search */}
        <div className="quick-draw-input-row">
          <svg className="quick-draw-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className="quick-draw-input"
            type="text"
            placeholder="Search clips..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Results */}
        <div className="quick-draw-results">
          {filtered.length === 0 ? (
            <div className="quick-draw-empty">No clips found</div>
          ) : (
            filtered.slice(0, 8).map((clip, idx) => (
              <button
                key={clip.id}
                className={`quick-draw-item ${
                  idx === selectedIdx ? "quick-draw-item--focused" : ""
                }`}
                onClick={() => handleSelect(clip)}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <span className="quick-draw-item-text">
                  {clip.pinned && "📌 "}
                  {clip.content.slice(0, 120)}
                  {clip.content.length > 120 ? "…" : ""}
                </span>
                <span className="quick-draw-item-time">{formatTimeAgo(clip.timestamp)}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="quick-draw-hint">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> paste</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
