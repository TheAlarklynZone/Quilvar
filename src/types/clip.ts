export interface Clip {
  id: string;
  content: string;
  timestamp: number;
  pinned: boolean;
  charCount: number;
  wordCount: number;
}

export interface Quiver {
  id: string;
  name: string;
  clipIds: string[];
  createdAt: number;
}
