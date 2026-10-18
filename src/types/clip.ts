export interface Clip {
  id: string;
  content: string;
  timestamp: number;
  pinned: boolean;
  charCount: number;
  wordCount: number;
  type: "text" | "image";
  // Image clips only: the row carries a small thumbnail; the full PNG lives on disk.
  width?: number;
  height?: number;
  thumbnail?: string;
}

export interface Quiver {
  id: string;
  name: string;
  clipIds: string[];
  createdAt: number;
}
