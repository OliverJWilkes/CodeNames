import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createGame, giveClue, guess, passTurn, viewFor, TEAMS, ROLES } from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/healthz", (_req, res) => res.send("ok"));

const server = http.createServer(app);
const io = new Server(server);

/** rooms: code -> { code, players: Map<socketId, {name, team, role}>, game, host } */
const rooms = new Map();

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O to avoid confusion
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function roomState(room) {
  return {
    code: room.code,
    host: room.host,
    players: [...room.players.entries()].map(([id, p]) => ({ id, ...p })),
  };
}

/** Send every player in the room the state they are allowed to see. */
function broadcast(room) {
  const state = roomState(room);
  for (const [id, p] of room.players) {
    io.to(id).emit("state", {
      room: state,
      me: { id, ...p },
      game: room.game ? viewFor(room.game, p.role) : null,
    });
  }
}

function cleanName(name) {
  return String(name || "").trim().slice(0, 20) || "Player";
}

io.on("connection", (socket) => {
  let room = null;

  const fail = (msg) => socket.emit("error-message", msg);

  const guarded = (fn) => (payload, ack) => {
    try {
      fn(payload || {});
      if (typeof ack === "function") ack({ ok: true });
    } catch (e) {
      fail(e.message);
      if (typeof ack === "function") ack({ ok: false, error: e.message });
    }
  };

  socket.on("create", guarded(({ name }) => {
    const code = makeCode();
    room = { code, players: new Map(), game: null, host: socket.id };
    rooms.set(code, room);
    room.players.set(socket.id, { name: cleanName(name), team: null, role: null });
    socket.join(code);
    broadcast(room);
  }));

  socket.on("join", guarded(({ name, code }) => {
    const c = String(code || "").trim().toUpperCase();
    const r = rooms.get(c);
    if (!r) throw new Error("No game found with code " + c);
    room = r;
    room.players.set(socket.id, { name: cleanName(name), team: null, role: null });
    socket.join(c);
    broadcast(room);
  }));

  socket.on("pick", guarded(({ team, role }) => {
    if (!room) throw new Error("Not in a room.");
    if (!TEAMS.includes(team) || !ROLES.includes(role)) throw new Error("Bad team or role.");
    if (room.game && room.game.phase !== "over") throw new Error("Cannot change seat mid-game.");
    // One person per seat, so nobody can play both sides from two browser tabs.
    for (const [id, p] of room.players) {
      if (id !== socket.id && p.team === team && p.role === role) {
        throw new Error(`${p.name} already has that seat.`);
      }
    }
    const me = room.players.get(socket.id);
    me.team = team;
    me.role = role;
    broadcast(room);
  }));

  socket.on("start", guarded(() => {
    if (!room) throw new Error("Not in a room.");
    if (socket.id !== room.host) throw new Error("Only the host can start the game.");
    for (const t of TEAMS) {
      const members = [...room.players.values()].filter((p) => p.team === t);
      if (!members.some((p) => p.role === "teller")) throw new Error(`Team ${t} needs a teller.`);
      if (!members.some((p) => p.role === "guesser")) throw new Error(`Team ${t} needs a guesser.`);
    }
    room.game = createGame();
    broadcast(room);
  }));

  socket.on("clue", guarded(({ word, count }) => {
    if (!room || !room.game) throw new Error("No game in progress.");
    const me = room.players.get(socket.id);
    if (me.role !== "teller") throw new Error("Only the teller can give clues.");
    giveClue(room.game, me.team, word, count);
    broadcast(room);
  }));

  socket.on("guess", guarded(({ index }) => {
    if (!room || !room.game) throw new Error("No game in progress.");
    const me = room.players.get(socket.id);
    if (me.role !== "guesser") throw new Error("Only the guesser can pick tiles.");
    guess(room.game, me.team, Number(index));
    broadcast(room);
  }));

  socket.on("pass", guarded(() => {
    if (!room || !room.game) throw new Error("No game in progress.");
    const me = room.players.get(socket.id);
    if (me.role !== "guesser") throw new Error("Only the guesser can pass.");
    passTurn(room.game, me.team);
    broadcast(room);
  }));

  socket.on("disconnect", () => {
    if (!room) return;
    room.players.delete(socket.id);
    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.host === socket.id) room.host = room.players.keys().next().value;
    broadcast(room);
  });
});

server.listen(PORT, () => console.log(`Game server listening on http://localhost:${PORT}`));
