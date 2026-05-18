import { useState } from 'react';
import { checkForUpdates, downloadAndInstall } from '../lib/updater';

export function UpdaterPanel() {
  const [status, setStatus] = useState<
    'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'error'
  >('idle');
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCheck() {
    setStatus('checking');
    setErrorMsg(null);
    try {
      const result = await checkForUpdates();
      if (result.available) {
        setNewVersion(result.version);
        setStatus('available');
      } else {
        setStatus('up-to-date');
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Unknown error');
      setStatus('error');
    }
  }

  async function handleInstall() {
    setStatus('downloading');
    setProgress(0);
    try {
      await downloadAndInstall((downloaded, total) => {
        if (total) setProgress(Math.round((downloaded / total) * 100));
      });
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Install failed');
      setStatus('error');
    }
  }

  return (
    <div className="updater-panel">
      <h3>Updates</h3>

      {status === 'idle' && (
        <button className="btn-check" onClick={handleCheck}>
          Check for updates
        </button>
      )}

      {status === 'checking' && (
        <p className="status-muted">Checking for updates…</p>
      )}

      {status === 'up-to-date' && (
        <div className="status-ok">
          <span>✅ You're on the latest version!</span>
          <button className="btn-ghost" onClick={handleCheck}>Check again</button>
        </div>
      )}

      {status === 'available' && (
        <div className="status-update">
          <p>🎉 <strong>v{newVersion}</strong> is available!</p>
          <button className="btn-primary" onClick={handleInstall}>
            Download &amp; Install
          </button>
          <button className="btn-ghost" onClick={() => setStatus('idle')}>Later</button>
        </div>
      )}

      {status === 'downloading' && (
        <div className="status-downloading">
          <p>Downloading update… {progress > 0 ? `${progress}%` : ''}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="status-muted">Quilvar will restart automatically when done.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="status-error">
          <p>⚠️ {errorMsg}</p>
          <button className="btn-ghost" onClick={handleCheck}>Try again</button>
        </div>
      )}
    </div>
  );
}
