import type { View } from "../App";
import type { ReactElement } from "react";

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems: { id: View; label: string; icon: ReactElement }[] = [
  {
    id: "history",
    label: "History",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5M12 7v5l4 2"/>
      </svg>
    ),
  },
  {
    id: "pinned",
    label: "Pinned",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m12 17-7 4 1.5-7.5L2 9l7.5-1L12 2l2.5 6L22 9l-4.5 4.5L19 21z"/>
      </svg>
    ),
  },
  {
    id: "quivers",
    label: "Quivers",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M3 12h18M3 18h18"/>
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-label="Quilvar">
          <rect width="32" height="32" rx="8" fill="var(--color-primary)" opacity="0.15"/>
          <path d="M8 24 L16 6 L18 6 L22 14 L20 14 L16 7 L10 24 Z" fill="var(--color-primary)"/>
          <path d="M13 18 L20 18 L21 21 L19 21 L18.5 19.5 L14.5 19.5 Z" fill="var(--color-primary)" opacity="0.7"/>
          <circle cx="22" cy="22" r="3" stroke="var(--color-primary)" strokeWidth="1.5" fill="none"/>
        </svg>
        <span className="sidebar-logo-text">Quilvar</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav" role="navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${
              currentView === item.id ? "sidebar-nav-item--active" : ""
            }`}
            onClick={() => onNavigate(item.id)}
            aria-current={currentView === item.id ? "page" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="sidebar-version">v0.1.1</span>
      </div>
    </aside>
  );
}
