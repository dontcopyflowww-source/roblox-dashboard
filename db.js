// db.js
// Uses Node's BUILT-IN sqlite module (node:sqlite) — no npm package to compile,
// no Python/build tools required. Needs Node 22.5+ (you have Node 24, so you're fine).

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'game.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    user_id     INTEGER PRIMARY KEY,
    username    TEXT NOT NULL,
    currency    INTEGER NOT NULL DEFAULT 0,
    level       INTEGER NOT NULL DEFAULT 1,
    inventory   TEXT NOT NULL DEFAULT '[]',
    in_game     INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    event_type  TEXT NOT NULL,
    payload     TEXT,
    created_at  TEXT NOT NULL
  );
`);

const upsertStmt = db.prepare(`
  INSERT INTO players (user_id, username, currency, level, inventory, in_game, updated_at)
  VALUES ($user_id, $username, $currency, $level, $inventory, 1, $updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    username   = excluded.username,
    currency   = excluded.currency,
    level      = excluded.level,
    inventory  = excluded.inventory,
    in_game    = 1,
    updated_at = excluded.updated_at
`);

const markLeftStmt = db.prepare(`
  UPDATE players SET in_game = 0, updated_at = $updated_at WHERE user_id = $user_id
`);

const getAllStmt = db.prepare(`
  SELECT * FROM players ORDER BY in_game DESC, updated_at DESC
`);

const logEventStmt = db.prepare(`
  INSERT INTO events (user_id, event_type, payload, created_at)
  VALUES ($user_id, $event_type, $payload, $created_at)
`);

function upsertPlayer(p) {
  upsertStmt.run({
    user_id: p.user_id,
    username: p.username,
    currency: p.currency,
    level: p.level,
    inventory: p.inventory,
    updated_at: p.updated_at
  });
}

function markLeft(p) {
  markLeftStmt.run({ user_id: p.user_id, updated_at: p.updated_at });
}

function getAllPlayers() {
  return getAllStmt.all();
}

function logEvent(e) {
  logEventStmt.run({
    user_id: e.user_id,
    event_type: e.event_type,
    payload: e.payload,
    created_at: e.created_at
  });
}

function serializePlayer(row) {
  return {
    userId: row.user_id,
    username: row.username,
    currency: row.currency,
    level: row.level,
    inventory: JSON.parse(row.inventory || '[]'),
    inGame: !!row.in_game,
    updatedAt: row.updated_at
  };
}

module.exports = { upsertPlayer, markLeft, getAllPlayers, logEvent, serializePlayer };
