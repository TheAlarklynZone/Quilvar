import { useEffect, useState } from "react";
import type { Clip, Quiver } from "../types/clip";

interface QuiversViewProps {
  pinnedClips: Clip[];
}

export function QuiversView({ pinnedClips }: QuiversViewProps) {
  const [quivers, setQuivers] = useState<Quiver[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function refresh() {
    const data = await window.electronAPI.getQuivers();
    setQuivers(data);
    return data;
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const quiver = await window.electronAPI.createQuiver(name);
    setNewName("");
    await refresh();
    setSelectedId(quiver.id);
  }

  async function handleDelete(id: string) {
    await window.electronAPI.deleteQuiver(id);
    if (selectedId === id) setSelectedId(null);
    await refresh();
  }

  async function handleRenameSubmit(id: string) {
    const name = renameValue.trim();
    if (name) await window.electronAPI.renameQuiver(id, name);
    setRenamingId(null);
    await refresh();
  }

  async function handleAddClip(quiverId: string, clipId: string) {
    await window.electronAPI.addClipToQuiver(quiverId, clipId);
    await refresh();
  }

  async function handleRemoveClip(quiverId: string, clipId: string) {
    await window.electronAPI.removeClipFromQuiver(quiverId, clipId);
    await refresh();
  }

  const selected = quivers.find((q) => q.id === selectedId) ?? null;
  const selectedClips = selected
    ? selected.clipIds
        .map((id) => pinnedClips.find((c) => c.id === id))
        .filter((c): c is Clip => !!c)
    : [];
  const availableToAdd = selected
    ? pinnedClips.filter((c) => !selected.clipIds.includes(c.id))
    : [];

  return (
    <div className="quivers-view">
      <div className="clip-list-header">
        <h1 className="clip-list-title">Quivers</h1>
        <span className="clip-list-count">{quivers.length} quivers</span>
      </div>

      <form className="quiver-new-form" onSubmit={handleCreate}>
        <input
          className="quiver-new-input"
          type="text"
          placeholder="New quiver name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="quiver-new-btn" type="submit" disabled={!newName.trim()}>
          Create
        </button>
      </form>

      {quivers.length === 0 ? (
        <div className="clip-empty">
          <svg className="clip-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
          <p>No quivers yet</p>
          <span>Pin a clip, then group your pins into a named quiver.</span>
        </div>
      ) : (
        <div className="quivers-layout">
          <ul className="quiver-list">
            {quivers.map((q) => (
              <li key={q.id}>
                <button
                  className={`quiver-list-item ${selectedId === q.id ? "quiver-list-item--active" : ""}`}
                  onClick={() => setSelectedId(q.id)}
                >
                  <span className="quiver-list-name">{q.name}</span>
                  <span className="quiver-list-count">{q.clipIds.length}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="quiver-detail">
            {!selected ? (
              <p className="quiver-detail-empty">Select a quiver to see what's in it.</p>
            ) : (
              <>
                <div className="quiver-detail-header">
                  {renamingId === selected.id ? (
                    <input
                      className="quiver-rename-input"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(selected.id)}
                      onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit(selected.id)}
                    />
                  ) : (
                    <h2
                      className="quiver-detail-title"
                      onClick={() => { setRenamingId(selected.id); setRenameValue(selected.name); }}
                      title="Click to rename"
                    >
                      {selected.name}
                    </h2>
                  )}
                  <button className="clip-btn clip-btn--danger" onClick={() => handleDelete(selected.id)} title="Delete quiver">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>

                {selectedClips.length === 0 ? (
                  <p className="quiver-detail-empty">No clips in this quiver yet.</p>
                ) : (
                  <ul className="quiver-clip-list">
                    {selectedClips.map((clip) => (
                      <li key={clip.id} className="quiver-clip-row">
                        <span className="quiver-clip-text">{clip.content.slice(0, 140)}</span>
                        <button
                          className="clip-btn"
                          title="Remove from quiver"
                          onClick={() => handleRemoveClip(selected.id, clip.id)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {availableToAdd.length > 0 && (
                  <div className="quiver-add-section">
                    <span className="quiver-add-label">Add a pinned clip</span>
                    <ul className="quiver-clip-list">
                      {availableToAdd.map((clip) => (
                        <li key={clip.id} className="quiver-clip-row">
                          <span className="quiver-clip-text">{clip.content.slice(0, 140)}</span>
                          <button
                            className="clip-btn"
                            title="Add to quiver"
                            onClick={() => handleAddClip(selected.id, clip.id)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
