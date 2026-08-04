import { useState, useEffect } from "react";
import { ClipList } from "./components/ClipList";
import { QuickDraw } from "./components/QuickDraw";
import { Sidebar } from "./components/Sidebar";
import { QuiversView } from "./components/QuiversView";
import { VaultView } from "./components/VaultView";
import { SettingsView } from "./components/SettingsView";
import { useClipStore } from "./store/clips";

export type View = "history" | "pinned" | "quivers" | "vault" | "settings";

export default function App() {
  const [view, setView] = useState<View>("history");
  const [quickDrawOpen, setQuickDrawOpen] = useState(false);
  const { clips, pinnedClips, loadClips } = useClipStore();

  useEffect(() => {
    loadClips();
  }, []);

  useEffect(() => {
    window.electronAPI.onQuickDrawOpen(() => setQuickDrawOpen(true));
    return () => window.electronAPI.removeAllListeners('quickdraw:open');
  }, []);

  return (
    <div className="app-shell">
      {/* Quick Draw overlay — rendered on top */}
      {quickDrawOpen && (
        <QuickDraw
          clips={clips}
          onClose={() => setQuickDrawOpen(false)}
        />
      )}

      {/* Main window */}
      <div className="main-layout">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="main-content">
          {view === "history" && <ClipList title="History" clips={clips} />}
          {view === "pinned" && <ClipList title="Pinned Clips" clips={pinnedClips} />}
          {view === "quivers" && <QuiversView pinnedClips={pinnedClips} />}
          {view === "vault" && <VaultView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
