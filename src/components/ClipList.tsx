import { useState } from "react";
import { ClipCard } from "./ClipCard";
import { useClipStore } from "../store/clips";
import type { Clip } from "../types/clip";
import type { View } from "../App";

interface ClipListProps {
  view: View;
  clips: Clip[];
}

export function ClipList({ view, clips }: ClipListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { deleteClip, togglePin, copyToClipboard } = useClipStore();

  const filtered = clips.filter((c) =>
    c.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const viewLabel: Record<View, string> = {
    history: "History",
    pinned: "Pinned Clips",
    quivers: "Quivers",
    settings: "Settings",
  };

  return (
    <div className="cliplist">
      {/* Header */}
      <div className="cliplist-header">
        <h1 className="cliplist-title">{viewLabel[view]}</h1>
        <span className="cliplist-count">{filtered.length} clips</span>
      </div>

      {/* Search */}
      <div className="cliplist-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          className="cliplist-search-input"
          type="text"
          placeholder="Search clips…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Clip cards */}
      <div className="cliplist-items">
        {filtered.length === 0 ? (
          <div className="cliplist-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <p>No clips yet</p>
            <span>Copy something to get started!</span>
          </div>
        ) : (
          filtered.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onCopy={() => copyToClipboard(clip.content)}
              onDelete={() => deleteClip(clip.id)}
              onTogglePin={() => togglePin(clip.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
