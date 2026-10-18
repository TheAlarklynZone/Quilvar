const path = require('path');
const fs = require('fs');
const { app, safeStorage } = require('electron');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

let db;
let vaultUnlocked = false;
let imageDir;

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

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Image clips: added after the first release, so migrate existing databases in place.
  const cols = db.prepare('PRAGMA table_info(clips)').all().map((c) => c.name);
  if (!cols.includes('type')) db.exec("ALTER TABLE clips ADD COLUMN type TEXT NOT NULL DEFAULT 'text'");
  if (!cols.includes('hash')) db.exec('ALTER TABLE clips ADD COLUMN hash TEXT');
  if (!cols.includes('width')) db.exec('ALTER TABLE clips ADD COLUMN width INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('height')) db.exec('ALTER TABLE clips ADD COLUMN height INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('thumbnail')) db.exec('ALTER TABLE clips ADD COLUMN thumbnail TEXT');

  imageDir = path.join(app.getPath('userData'), 'clip-images');
  fs.mkdirSync(imageDir, { recursive: true });
}

// ── App settings ───────────────────────────────────────────────────────────

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
  return value;
}

function deleteSetting(key) {
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
}

function addClip(content) {
  const existing = db.prepare("SELECT id FROM clips WHERE type = 'text' AND content = ?").get(content);
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
  pruneOrphanImages();

  return getClipById(id);
}

// Image clips keep their PNG on disk (the row only holds a small thumbnail),
// so any delete path has to sweep files whose row is gone.
function imagePath(id) {
  return path.join(imageDir, `${id}.png`);
}

function pruneOrphanImages() {
  const live = new Set(db.prepare("SELECT id FROM clips WHERE type = 'image'").all().map((r) => r.id));
  for (const file of fs.readdirSync(imageDir)) {
    if (file.endsWith('.png') && !live.has(file.slice(0, -4))) {
      try { fs.unlinkSync(path.join(imageDir, file)); } catch { /* best effort */ }
    }
  }
}

function addImageClip({ png, hash, width, height, thumbnail }) {
  const existing = db.prepare("SELECT id FROM clips WHERE type = 'image' AND hash = ?").get(hash);
  if (existing) {
    db.prepare('UPDATE clips SET timestamp = ? WHERE id = ?').run(Date.now(), existing.id);
    return getClipById(existing.id);
  }

  const id = randomUUID();
  fs.writeFileSync(imagePath(id), png);
  db.prepare(
    `INSERT INTO clips (id, content, timestamp, pinned, char_count, word_count, type, hash, width, height, thumbnail)
     VALUES (?, ?, ?, 0, 0, 0, 'image', ?, ?, ?, ?)`
  ).run(id, `Image ${width}×${height}`, Date.now(), hash, width, height, thumbnail);

  db.prepare(
    'DELETE FROM clips WHERE pinned = 0 AND id NOT IN (SELECT id FROM clips WHERE pinned = 0 ORDER BY timestamp DESC LIMIT 500)'
  ).run();
  pruneOrphanImages();

  return getClipById(id);
}

function getClipImagePath(id) {
  const p = imagePath(id);
  return fs.existsSync(p) ? p : null;
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
  pruneOrphanImages();
  return true;
}

function clearNonPinnedClips() {
  const { changes } = db.prepare('DELETE FROM clips WHERE pinned = 0').run();
  pruneOrphanImages();
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
    type: row.type === 'image' ? 'image' : 'text',
    width: row.width || undefined,
    height: row.height || undefined,
    thumbnail: row.thumbnail || undefined,
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

// Clears the stored PIN so a new one can be set — for a forgotten PIN.
// Vault clip content is encrypted via safeStorage independent of the PIN
// (the PIN is only a gate check, not a key), so this never touches
// vault_clips and no content is lost.
function vaultResetPin() {
  db.prepare("DELETE FROM vault_settings WHERE key = 'pin'").run();
  vaultUnlocked = false;
  return true;
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
    type: 'text',
  }));
}

function addToVault(clipId) {
  requireVaultUnlocked();
  requireEncryption();
  const clip = getClipById(clipId);
  if (!clip) throw new Error('Clip not found.');
  if (clip.type === 'image') throw new Error('Image clips can\'t be moved to Quilvault.');

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
  getSetting,
  setSetting,
  deleteSetting,
  addClip,
  addImageClip,
  getClipById,
  getClipImagePath,
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
  vaultResetPin,
  getVaultClips,
  addToVault,
  removeFromVault,
  restoreFromVault,
};
