import { useState, useEffect } from "react";
import { ClipList } from "./components/ClipList";
import { QuickDraw } from "./components/QuickDraw";
import { Sidebar } from "./components/Sidebar";
import { useClipStore } from "./store/clips";

export type View = "history" | "pinned" | "quivers" | "settings";

export default function App() {
  const [view, setView] = useState<View>("history");
  const [quickDrawOpen, setQuickDrawOpen] = useState(false);
  const { clips, pinnedClips, loadClips } = useClipStore();

  useEffect(() => {
    loadClips();
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
          <ClipList
            view={view}
            clips={view === "pinned" ? pinnedClips : clips}
          />
        </main>
      </div>
    </div>
  );
}
