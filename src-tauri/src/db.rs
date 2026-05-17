use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Clip {
    pub id: String,
    pub content: String,
    pub timestamp: i64,
    pub pinned: bool,
    pub pin_label: Option<String>,
    pub quiver_id: Option<String>,
    pub word_count: i64,
    pub char_count: i64,
}

pub struct DbState(pub Mutex<Connection>);

pub fn init(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("quilvar.db");
    let conn = Connection::open(db_path)?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS clips (
            id          TEXT PRIMARY KEY,
            content     TEXT NOT NULL,
            timestamp   INTEGER NOT NULL,
            pinned      INTEGER NOT NULL DEFAULT 0,
            pin_label   TEXT,
            quiver_id   TEXT,
            word_count  INTEGER NOT NULL DEFAULT 0,
            char_count  INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_clips_timestamp ON clips(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_clips_pinned    ON clips(pinned);

        CREATE TABLE IF NOT EXISTS quivers (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            color      TEXT,
            icon       TEXT,
            created_at INTEGER NOT NULL
        );
    ")?;

    app.manage(DbState(Mutex::new(conn)));
    Ok(())
}

pub fn get_all_clips(conn: &Connection) -> Result<Vec<Clip>> {
    let mut stmt = conn.prepare(
        "SELECT id, content, timestamp, pinned, pin_label, quiver_id, word_count, char_count
         FROM clips ORDER BY pinned DESC, timestamp DESC"
    )?;
    let clips = stmt.query_map([], |row| {
        Ok(Clip {
            id:         row.get(0)?,
            content:    row.get(1)?,
            timestamp:  row.get(2)?,
            pinned:     row.get::<_, i32>(3)? != 0,
            pin_label:  row.get(4)?,
            quiver_id:  row.get(5)?,
            word_count: row.get(6)?,
            char_count: row.get(7)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;
    Ok(clips)
}

pub fn insert_clip(conn: &Connection, clip: &Clip) -> Result<()> {
    conn.execute(
        "INSERT INTO clips (id, content, timestamp, pinned, pin_label, quiver_id, word_count, char_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            clip.id, clip.content, clip.timestamp,
            clip.pinned as i32, clip.pin_label, clip.quiver_id,
            clip.word_count, clip.char_count
        ],
    )?;
    Ok(())
}

pub fn delete_clip_by_id(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM clips WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn set_pin(conn: &Connection, id: &str, pinned: bool) -> Result<()> {
    conn.execute(
        "UPDATE clips SET pinned = ?1 WHERE id = ?2",
        params![pinned as i32, id],
    )?;
    Ok(())
}

pub fn is_duplicate(conn: &Connection, content: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM clips WHERE content = ?1",
        params![content],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
