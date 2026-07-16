// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const {
  upsertPlayer, markLeft, getAllPlayers, logEvent, getRecentEvents,
  serializePlayer, serializeEvent
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = process.env.DASHBOARD_API_KEY || 'change-me-please';

function requireApiKey(req, res, next) {
  if (req.header('x-api-key') !== API_KEY) {
    return res.status(401).json({ error: 'invalid api key' });
  }
  next();
}

function pushEvent(e) {
  const now = new Date().toISOString();
  logEvent({ ...e, created_at: now });
  io.emit('game:event', { ...e, createdAt: now });
}

// Roblox calls this whenever a tracked stat changes (currency, level, inventory).
app.post('/api/player-update', requireApiKey, (req, res) => {
  const { userId, username, currency, level, inventory } = req.body || {};
  if (!userId || !username) {
    return res.status(400).json({ error: 'userId and username are required' });
  }

  const wasKnown = getAllPlayers().some(p => p.user_id === userId);
  const now = new Date().toISOString();

  upsertPlayer({
    user_id: userId,
    username,
    currency: currency ?? 0,
    level: level ?? 1,
    inventory: JSON.stringify(inventory ?? []),
    updated_at: now
  });

  if (!wasKnown) {
    pushEvent({ user_id: userId, username, event_type: 'online', payload: null });
  }

  const players = getAllPlayers().map(serializePlayer);
  const updated = players.find(p => p.userId === userId);
  io.emit('player:update', updated);
  res.json({ ok: true });
});

// Roblox calls this when a player leaves the game.
app.post('/api/player-left', requireApiKey, (req, res) => {
  const { userId, username } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const now = new Date().toISOString();
  markLeft({ user_id: userId, updated_at: now });
  pushEvent({ user_id: userId, username, event_type: 'offline', payload: null });
  io.emit('player:left', { userId });
  res.json({ ok: true });
});

// Generic event log for the activity feed: item pickups, milestones, purchases, etc.
// Roblox example:
//   POST /api/event  { userId, username, eventType: "pet", payload: { name: "Rainbow Unicorn" } }
app.post('/api/event', requireApiKey, (req, res) => {
  const { userId, username, eventType, payload } = req.body || {};
  if (!eventType) return res.status(400).json({ error: 'eventType is required' });

  pushEvent({
    user_id: userId ?? null,
    username: username ?? null,
    event_type: eventType,
    payload: JSON.stringify(payload ?? {})
  });
  res.json({ ok: true });
});

app.get('/api/players', (req, res) => {
  res.json(getAllPlayers().map(serializePlayer));
});

app.get('/api/events', (req, res) => {
  res.json(getRecentEvents(50).map(serializeEvent));
});

io.on('connection', (socket) => {
  socket.emit('players:snapshot', getAllPlayers().map(serializePlayer));
  socket.emit('events:snapshot', getRecentEvents(50).map(serializeEvent));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`API key required on POST routes: set DASHBOARD_API_KEY env var (currently "${API_KEY}")`);
});
