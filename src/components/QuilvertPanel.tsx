import { useEffect, useState } from "react";
import { trim, collapseWhitespace, prettifyJSON, minifyJSON } from "../lib/quilvert";

interface QuilvertPanelProps {
  content: string;
  onClose: () => void;
}

export function QuilvertPanel({ content, onClose }: QuilvertPanelProps) {
  const [text, setText] = useState(content);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function apply(fn: (t: string) => { text: string; error: string | null }) {
    const result = fn(text);
    setText(result.text);
    setError(result.error);
  }

  async function handleCopy() {
    try {
      await window.electronAPI.copyClip(text);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="quilvert-overlay" onClick={onClose}>
      <div className="quilvert-panel" onClick={(e) => e.stopPropagation()}>
        <div className="quilvert-header">
          <span className="quilvert-title">Quilvert</span>
          <button className="clip-btn" onClick={onClose} title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <textarea
          className="quilvert-textarea"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          spellCheck={false}
        />

        {error && <p className="vault-error quilvert-error">{error}</p>}

        <div className="quilvert-actions">
          <button className="quilvert-btn" onClick={() => apply(trim)}>Trim</button>
          <button className="quilvert-btn" onClick={() => apply(collapseWhitespace)}>Collapse whitespace</button>
          <button className="quilvert-btn" onClick={() => apply(prettifyJSON)}>Prettify JSON</button>
          <button className="quilvert-btn" onClick={() => apply(minifyJSON)}>Minify JSON</button>
          <button className="quilvert-btn" onClick={() => { setText(content); setError(null); }}>Reset</button>
        </div>

        <div className="quilvert-footer">
          <span className="clip-stats">{text.length} chars</span>
          <button className="vault-submit quilvert-copy" onClick={handleCopy}>
            {copied ? "✓ Copied!" : "Copy result"}
          </button>
        </div>
      </div>
    </div>
  );
}
