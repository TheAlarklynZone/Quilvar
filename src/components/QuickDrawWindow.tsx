import { useEffect, useState } from "react";
import { QuickDraw } from "./QuickDraw";
import { useClipStore } from "../store/clips";
import type { Clip } from "../types/clip";

// Root of the floating Quick Draw overlay window (loaded at #quickdraw).
export function QuickDrawWindow() {
  const { clips, loadClips } = useClipStore();
  // Bumped on every open so the search box and selection start fresh.
  const [session, setSession] = useState(0);

  useEffect(() => {
    loadClips();
    window.electronAPI.onQuickDrawOpen(() => {
      loadClips();
      setSession((n) => n + 1);
    });
    return () => window.electronAPI.removeAllListeners("quickdraw:open");
  }, []);

  return (
    <QuickDraw
      key={session}
      clips={clips}
      onSelect={(clip: Clip) => window.electronAPI.quickDrawSelect(clip.id)}
      onClose={() => window.electronAPI.quickDrawClose()}
    />
  );
}
