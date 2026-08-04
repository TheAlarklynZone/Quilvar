import { useState, useCallback, useEffect } from "react";
import type { Clip, Quiver } from "../types/clip";

// Typed electronAPI from preload
declare global {
  interface Window {
    electronAPI: {
      getClips: () => Promise<Clip[]>;
      deleteClip: (id: string) => Promise<boolean>;
      togglePin: (id: string) => Promise<Clip>;
      copyClip: (content: string) => Promise<boolean>;
      quit: () => Promise<void>;
      getVersion: () => Promise<string>;
      getStoragePath: () => Promise<string>;
      onNewClip: (cb: (clip: Clip) => void) => void;
      onQuickDrawOpen: (cb: () => void) => void;
      removeAllListeners: (channel: string) => void;

      // Updater
      checkForUpdates: () => Promise<{ available: boolean; version: string | null }>;
      downloadAndInstall: () => Promise<void>;
      onUpdateAvailable: (cb: (info: { version: string }) => void) => void;
      onUpdateNotAvailable: (cb: () => void) => void;
      onUpdateProgress: (cb: (downloaded: number, total: number | null) => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
      onUpdateError: (cb: (message: string) => void) => void;

      // Quivers
      getQuivers: () => Promise<Quiver[]>;
      createQuiver: (name: string) => Promise<Quiver>;
      renameQuiver: (id: string, name: string) => Promise<Quiver>;
      deleteQuiver: (id: string) => Promise<boolean>;
      addClipToQuiver: (quiverId: string, clipId: string) => Promise<Quiver>;
      removeClipFromQuiver: (quiverId: string, clipId: string) => Promise<Quiver>;

      // Quilvault
      vaultStatus: () => Promise<{ hasPin: boolean; unlocked: boolean }>;
      vaultSetPin: (pin: string) => Promise<boolean>;
      vaultUnlock: (pin: string) => Promise<boolean>;
      vaultLock: () => Promise<void>;
      getVaultClips: () => Promise<Clip[]>;
      addToVault: (clipId: string) => Promise<boolean>;
      removeFromVault: (id: string) => Promise<boolean>;
      restoreFromVault: (id: string) => Promise<Clip | null>;
    };
  }
}

let _clips: Clip[] = [];
let _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

export function useClipStore() {
  const [, rerender] = useState(0);

  // Re-render this component whenever the store's data changes.
  useEffect(() => {
    const fn = () => rerender((n) => n + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  }, []);

  // Listen for new clips pushed from main process
  useEffect(() => {
    window.electronAPI.onNewClip((clip) => {
      const exists = _clips.find((c) => c.id === clip.id);
      if (!exists) {
        _clips = [clip, ..._clips];
      } else {
        _clips = _clips.map((c) => c.id === clip.id ? clip : c);
      }
      notify();
    });
    return () => window.electronAPI.removeAllListeners('clip:new');
  }, []);

  const loadClips = useCallback(async () => {
    try {
      const data = await window.electronAPI.getClips();
      _clips = data;
      notify();
    } catch (e) {
      console.error('Failed to load clips:', e);
    }
  }, []);

  const deleteClip = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteClip(id);
      _clips = _clips.filter((c) => c.id !== id);
      notify();
    } catch (e) {
      console.error('Failed to delete clip:', e);
    }
  }, []);

  const togglePin = useCallback(async (id: string) => {
    try {
      const updated = await window.electronAPI.togglePin(id);
      _clips = _clips.map((c) => c.id === id ? updated : c);
      notify();
    } catch (e) {
      console.error('Failed to toggle pin:', e);
    }
  }, []);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await window.electronAPI.copyClip(content);
    } catch {
      await navigator.clipboard.writeText(content);
    }
  }, []);

  const moveToVault = useCallback(async (id: string) => {
    await window.electronAPI.addToVault(id);
    _clips = _clips.filter((c) => c.id !== id);
    notify();
  }, []);

  return {
    clips: _clips,
    pinnedClips: _clips.filter((c) => c.pinned),
    loadClips,
    deleteClip,
    togglePin,
    copyToClipboard,
    moveToVault,
  };
}
