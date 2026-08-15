const path = require('path');
const { app, safeStorage } = require('electron');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

let db;
let vaultUnlocked = false;

function init() {
  const dbPath = path.join(app.getPath('userData'), 'quilvar.db');
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

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

    CREATE TABLE IF NOT EXISTS quivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS quiver_clips (
      quiver_id TEXT NOT NULL REFERENCES quivers(id) ON DELETE CASCADE,
      clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (quiver_id, clip_id)
    );

    CREATE TABLE IF NOT EXISTS vault_clips (
      id TEXT PRIMARY KEY,
      content_encrypted BLOB NOT NULL,
      timestamp INTEGER NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS vault_settings (
      key TEXT PRIMARY KEY,
      value_encrypted BLOB NOT NULL
    );
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

function clearNonPinnedClips() {
  const { changes } = db.prepare('DELETE FROM clips WHERE pinned = 0').run();
  return changes;
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

// ── Quivers ────────────────────────────────────────────────────────────────

function getQuiverById(id) {
  const row = db.prepare('SELECT * FROM quivers WHERE id = ?').get(id);
  return row ? rowToQuiver(row) : null;
}

function getQuivers() {
  const rows = db.prepare('SELECT * FROM quivers ORDER BY created_at ASC').all();
  return rows.map(rowToQuiver);
}

function createQuiver(name) {
  const id = randomUUID();
  db.prepare('INSERT INTO quivers (id, name, created_at) VALUES (?, ?, ?)').run(id, name, Date.now());
  return getQuiverById(id);
}

function renameQuiver(id, name) {
  db.prepare('UPDATE quivers SET name = ? WHERE id = ?').run(name, id);
  return getQuiverById(id);
}

function deleteQuiver(id) {
  db.prepare('DELETE FROM quivers WHERE id = ?').run(id);
  return true;
}

function addClipToQuiver(quiverId, clipId) {
  db.prepare(
    'INSERT OR IGNORE INTO quiver_clips (quiver_id, clip_id, added_at) VALUES (?, ?, ?)'
  ).run(quiverId, clipId, Date.now());
  return getQuiverById(quiverId);
}

function removeClipFromQuiver(quiverId, clipId) {
  db.prepare('DELETE FROM quiver_clips WHERE quiver_id = ? AND clip_id = ?').run(quiverId, clipId);
  return getQuiverById(quiverId);
}

function rowToQuiver(row) {
  const clipIds = db
    .prepare('SELECT clip_id FROM quiver_clips WHERE quiver_id = ? ORDER BY added_at ASC')
    .all(row.id)
    .map((r) => r.clip_id);
  return {
    id: row.id,
    name: row.name,
    clipIds,
    createdAt: row.created_at,
  };
}

// ── Quilvault ──────────────────────────────────────────────────────────────

function requireEncryption() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this device (no OS keychain found).');
  }
}

function vaultStatus() {
  const row = db.prepare("SELECT 1 FROM vault_settings WHERE key = 'pin'").get();
  return { hasPin: !!row, unlocked: vaultUnlocked };
}

function vaultSetPin(pin) {
  requireEncryption();
  const encrypted = safeStorage.encryptString(pin);
  db.prepare('INSERT OR REPLACE INTO vault_settings (key, value_encrypted) VALUES (?, ?)').run('pin', encrypted);
  vaultUnlocked = true;
  return true;
}

function vaultUnlock(pin) {
  const row = db.prepare("SELECT value_encrypted FROM vault_settings WHERE key = 'pin'").get();
  if (!row) return false;
  requireEncryption();
  const storedPin = safeStorage.decryptString(row.value_encrypted);
  vaultUnlocked = storedPin === pin;
  return vaultUnlocked;
}

function vaultLock() {
  vaultUnlocked = false;
}

function requireVaultUnlocked() {
  if (!vaultUnlocked) throw new Error('Quilvault is locked.');
}

function getVaultClips() {
  requireVaultUnlocked();
  requireEncryption();
  const rows = db.prepare('SELECT * FROM vault_clips ORDER BY timestamp DESC').all();
  return rows.map((row) => ({
    id: row.id,
    content: safeStorage.decryptString(row.content_encrypted),
    timestamp: row.timestamp,
    pinned: false,
    charCount: row.char_count,
    wordCount: row.word_count,
  }));
}

function addToVault(clipId) {
  requireVaultUnlocked();
  requireEncryption();
  const clip = getClipById(clipId);
  if (!clip) throw new Error('Clip not found.');

  const encrypted = safeStorage.encryptString(clip.content);
  db.prepare(
    'INSERT OR REPLACE INTO vault_clips (id, content_encrypted, timestamp, char_count, word_count) VALUES (?, ?, ?, ?, ?)'
  ).run(clip.id, encrypted, clip.timestamp, clip.charCount, clip.wordCount);
  db.prepare('DELETE FROM clips WHERE id = ?').run(clipId);
  return true;
}

function removeFromVault(id) {
  requireVaultUnlocked();
  db.prepare('DELETE FROM vault_clips WHERE id = ?').run(id);
  return true;
}

function restoreFromVault(id) {
  requireVaultUnlocked();
  requireEncryption();
  const row = db.prepare('SELECT * FROM vault_clips WHERE id = ?').get(id);
  if (!row) return null;

  const content = safeStorage.decryptString(row.content_encrypted);
  db.prepare('DELETE FROM vault_clips WHERE id = ?').run(id);
  return addClip(content);
}

module.exports = {
  init,
  addClip,
  getClips,
  deleteClip,
  clearNonPinnedClips,
  togglePin,
  getQuivers,
  createQuiver,
  renameQuiver,
  deleteQuiver,
  addClipToQuiver,
  removeClipFromQuiver,
  vaultStatus,
  vaultSetPin,
  vaultUnlock,
  vaultLock,
  getVaultClips,
  addToVault,
  removeFromVault,
  restoreFromVault,
};
