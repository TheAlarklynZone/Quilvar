const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

let db;

function init() {
  const dbPath = path.join(app.getPath('userData'), 'quilvar.db');
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      char_count INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_clips_timestamp ON clips(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_clips_pinned ON clips(pinned DESC, timestamp DESC);
  `);
}

function addClip(content) {
  const existing = db.prepare('SELECT id FROM clips WHERE content = ?').get(content);
  if (existing) {
    // Move to top by updating timestamp
    db.prepare('UPDATE clips SET timestamp = ? WHERE id = ?').run(Date.now(), existing.id);
    return getClipById(existing.id);
  }

  const id = randomUUID();
  const timestamp = Date.now();
  const charCount = content.length;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  db.prepare(
    'INSERT INTO clips (id, content, timestamp, pinned, char_count, word_count) VALUES (?, ?, ?, 0, ?, ?)'
  ).run(id, content, timestamp, charCount, wordCount);

  // Keep max 500 clips
  db.prepare(
    'DELETE FROM clips WHERE pinned = 0 AND id NOT IN (SELECT id FROM clips WHERE pinned = 0 ORDER BY timestamp DESC LIMIT 500)'
  ).run();

  return getClipById(id);
}

function getClipById(id) {
  const row = db.prepare('SELECT * FROM clips WHERE id = ?').get(id);
  return row ? rowToClip(row) : null;
}

function getClips() {
  const rows = db.prepare('SELECT * FROM clips ORDER BY pinned DESC, timestamp DESC LIMIT 500').all();
  return rows.map(rowToClip);
}

function deleteClip(id) {
  db.prepare('DELETE FROM clips WHERE id = ?').run(id);
  return true;
}

function togglePin(id) {
  db.prepare('UPDATE clips SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
  return getClipById(id);
}

function rowToClip(row) {
  return {
    id: row.id,
    content: row.content,
    timestamp: row.timestamp,
    pinned: row.pinned === 1,
    charCount: row.char_count,
    wordCount: row.word_count,
  };
}

module.exports = { init, addClip, getClips, deleteClip, togglePin };
