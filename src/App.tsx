import { useState, useEffect } from "react";
import { ClipList } from "./components/ClipList";
import { Sidebar } from "./components/Sidebar";
import { QuiversView } from "./components/QuiversView";
import { VaultView } from "./components/VaultView";
import { SettingsView } from "./components/SettingsView";
import { useClipStore } from "./store/clips";

export type View = "history" | "pinned" | "quivers" | "vault" | "settings";

export default function App() {
  const [view, setView] = useState<View>("history");
  const { clips, pinnedClips, loadClips } = useClipStore();

  useEffect(() => {
    loadClips();
  }, []);

  return (
    <div className="app-shell">
      {/* Main window */}
      <div className="main-layout">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="main-content">
          {view === "history" && <ClipList title="History" clips={clips} showClearAll />}
          {view === "pinned" && <ClipList title="Pinned Clips" clips={pinnedClips} />}
          {view === "quivers" && <QuiversView pinnedClips={pinnedClips} />}
          {view === "vault" && <VaultView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
