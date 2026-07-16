// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const {
  upsertPlayer, markLeft, getAllPlayers, logEvent, serializePlayer
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple shared-secret auth so random people can't post fake stats to your dashboard.
// Set this in your environment and paste the same value into the Roblox script.
const API_KEY = process.env.DASHBOARD_API_KEY || 'change-me-please';

function requireApiKey(req, res, next) {
  if (req.header('x-api-key') !== API_KEY) {
    return res.status(401).json({ error: 'invalid api key' });
  }
  next();
}

// Roblox calls this whenever a tracked stat changes (currency, level, inventory).
app.post('/api/player-update', requireApiKey, (req, res) => {
  const { userId, username, currency, level, inventory } = req.body || {};
  if (!userId || !username) {
    return res.status(400).json({ error: 'userId and username are required' });
  }

  const now = new Date().toISOString();
  upsertPlayer({
    user_id: userId,
    username,
    currency: currency ?? 0,
    level: level ?? 1,
    inventory: JSON.stringify(inventory ?? []),
    updated_at: now
  });

  const players = getAllPlayers().map(serializePlayer);
  const updated = players.find(p => p.userId === userId);
  io.emit('player:update', updated);
  res.json({ ok: true });
});

// Roblox calls this when a player leaves the game.
app.post('/api/player-left', requireApiKey, (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const now = new Date().toISOString();
  markLeft({ user_id: userId, updated_at: now });
  io.emit('player:left', { userId });
  res.json({ ok: true });
});

// Optional: generic event log (purchases, deaths, etc.) shown as a live feed.
app.post('/api/event', requireApiKey, (req, res) => {
  const { userId, eventType, payload } = req.body || {};
  if (!eventType) return res.status(400).json({ error: 'eventType is required' });

  const now = new Date().toISOString();
  logEvent({
    user_id: userId ?? null,
    event_type: eventType,
    payload: JSON.stringify(payload ?? {}),
    created_at: now
  });
  io.emit('game:event', { userId, eventType, payload, createdAt: now });
  res.json({ ok: true });
});

// Dashboard loads current state once on page load, then listens on the socket for live updates.
app.get('/api/players', (req, res) => {
  res.json(getAllPlayers().map(serializePlayer));
});

io.on('connection', (socket) => {
  socket.emit('players:snapshot', getAllPlayers().map(serializePlayer));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`API key required on POST routes: set DASHBOARD_API_KEY env var (currently "${API_KEY}")`);
});
