import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Clip, Quiver } from "../types/clip";

// Simple in-memory store — persisted via Rust backend (tauri-plugin-store)
let _clips: Clip[] = [];
let _quivers: Quiver[] = [];
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

export function useClipStore() {
  const [, rerender] = useState(0);

  const subscribe = useCallback(() => {
    const fn = () => rerender((n) => n + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  }, []);

  const loadClips = useCallback(async () => {
    try {
      const data = await invoke<Clip[]>("get_clips");
      _clips = data;
      notify();
    } catch (e) {
      console.error("Failed to load clips:", e);
    }
  }, []);

  const addClip = useCallback(async (content: string) => {
    // Ignore duplicates — if top clip matches, skip
    if (_clips.length > 0 && _clips[0].content === content) return;
    try {
      const clip = await invoke<Clip>("add_clip", { content });
      _clips = [clip, ..._clips];
      notify();
    } catch (e) {
      console.error("Failed to add clip:", e);
    }
  }, []);

  const deleteClip = useCallback(async (id: string) => {
    try {
      await invoke("delete_clip", { id });
      _clips = _clips.filter((c) => c.id !== id);
      notify();
    } catch (e) {
      console.error("Failed to delete clip:", e);
    }
  }, []);

  const togglePin = useCallback(async (id: string) => {
    try {
      await invoke("toggle_pin", { id });
      _clips = _clips.map((c) =>
        c.id === id ? { ...c, pinned: !c.pinned } : c
      );
      notify();
    } catch (e) {
      console.error("Failed to toggle pin:", e);
    }
  }, []);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await invoke("copy_to_clipboard", { content });
    } catch (e) {
      // Fallback to web API
      await navigator.clipboard.writeText(content);
    }
  }, []);

  return {
    clips: _clips,
    pinnedClips: _clips.filter((c) => c.pinned),
    quivers: _quivers,
    loadClips,
    addClip,
    deleteClip,
    togglePin,
    copyToClipboard,
    subscribe,
  };
}
