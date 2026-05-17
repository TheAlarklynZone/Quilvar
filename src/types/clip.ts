export interface Clip {
  id: string;
  content: string;
  timestamp: number;       // Unix ms
  pinned: boolean;
  pinLabel?: string;       // optional rename for pinned clips
  quiverId?: string;       // assigned Quiver, if any
  wordCount: number;
  charCount: number;
}

export interface Quiver {
  id: string;
  name: string;
  color?: string;          // hex color for UI accent
  icon?: string;           // emoji or icon name
  clipIds: string[];
  createdAt: number;
}

export type ClipSortOrder = "newest" | "oldest" | "pinned-first";
