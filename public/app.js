const socket = io();
const $ = (id) => document.getElementById(id);
let state = null;

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.hidden = true), 3000);
}
socket.on("error-message", toast);
socket.on("disconnect", () => toast("Connection lost. Refresh the page to rejoin."));

// Remember the name so family members do not retype it.
try { $("name").value = localStorage.getItem("cn-name") || ""; } catch {}
function saveName() { try { localStorage.setItem("cn-name", $("name").value); } catch {} }

$("createBtn").onclick = () => { saveName(); socket.emit("create", { name: $("name").value }); };
$("joinBtn").onclick = () => { saveName(); socket.emit("join", { name: $("name").value, code: $("code").value }); };
document.querySelectorAll("#setup button[data-team]").forEach((b) => {
  b.onclick = () => socket.emit("pick", { team: b.dataset.team, role: b.dataset.role });
});
$("startBtn").onclick = () => socket.emit("start");
$("againBtn").onclick = () => socket.emit("start");
$("clueBtn").onclick = () => {
  socket.emit("clue", { word: $("clueWord").value, count: $("clueCount").value }, (r) => {
    if (r.ok) $("clueWord").value = "";
  });
};
$("clueWord").addEventListener("keydown", (e) => { if (e.key === "Enter") $("clueBtn").click(); });
$("passBtn").onclick = () => socket.emit("pass");

socket.on("state", (s) => { state = s; render(); });

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const roleName = (r) => (r === "teller" ? "Teller" : "Guesser");

function render() {
  const { room, me, game } = state;
  $("lobby").hidden = true;
  $("roomInfo").hidden = false;
  $("roomCode").textContent = room.code;
  $("game").hidden = !game;
  $("setup").hidden = !!(game && game.phase !== "over");
  if (!game || game.phase === "over") renderSetup(room, me, game);
  if (game) renderGame(room, me, game);
}

function renderSetup(room, me, game) {
  const li = (p) => `<li>${p.name === me.name && p.id === me.id ? "<b>" : ""}${esc(p.name)} – ${roleName(p.role)}${p.id === me.id ? "</b>" : ""}</li>`;
  $("redList").innerHTML = room.players.filter((p) => p.team === "red").map(li).join("");
  $("blueList").innerHTML = room.players.filter((p) => p.team === "blue").map(li).join("");
  $("unassigned").textContent = room.players.filter((p) => !p.team).map((p) => p.name).join(", ") || "nobody";
  const isHost = room.host === me.id;
  $("startBtn").hidden = !isHost;
  $("waitHost").hidden = isHost;
  $("startBtn").textContent = game ? "Start a new game" : "Start game";
  $("againBtn").hidden = !isHost;
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function renderGame(room, me, game) {
  const myTurn = game.turn === me.team && game.phase !== "over";
  const status = $("status");
  status.className = game.phase === "over" ? "" : game.turn;
  if (game.phase === "over") {
    status.textContent = `${cap(game.winner)} team wins!`;
  } else if (game.phase === "clue") {
    status.textContent = myTurn && me.role === "teller"
      ? "Your turn: give a one-word clue and a number"
      : `${cap(game.turn)} teller is thinking of a clue…`;
  } else {
    status.textContent = myTurn && me.role === "guesser"
      ? "Your turn: tap the words you think match"
      : `${cap(game.turn)} guesser is choosing…`;
  }
  $("redLeft").textContent = game.remaining.red;
  $("blueLeft").textContent = game.remaining.blue;
  $("redNeutral").textContent = game.neutralsHit.red;
  $("blueNeutral").textContent = game.neutralsHit.blue;

  $("clueBox").innerHTML = game.clue
    ? `Clue: <b>${esc(game.clue.word)}</b> for <b>${game.clue.count}</b>` +
      (game.clue.guessesLeft !== null ? ` <span class="muted">(${game.clue.guessesLeft} guesses left)</span>` : "")
    : "";

  const canGuess = myTurn && me.role === "guesser" && game.phase === "guess";
  const board = $("board");
  board.innerHTML = "";
  game.tiles.forEach((t, i) => {
    const d = document.createElement("div");
    d.className = "tile";
    d.textContent = t.word;
    if (t.revealed) d.classList.add("revealed", t.type);
    else if (t.type) d.classList.add("hint-" + t.type); // teller's secret view
    if (canGuess && !t.revealed) {
      d.classList.add("clickable");
      d.onclick = () => {
        if (confirm(`Reveal "${t.word}"?`)) socket.emit("guess", { index: i });
      };
    }
    board.appendChild(d);
  });

  $("clueForm").hidden = !(myTurn && me.role === "teller" && game.phase === "clue");
  $("guessControls").hidden = !canGuess;

  const over = $("overBox");
  over.hidden = game.phase !== "over";
  if (game.phase === "over") {
    $("overTitle").textContent = `${cap(game.winner)} team wins!`;
    const loser = game.winner === "red" ? "Blue" : "Red";
    $("overReason").textContent = {
      assassin: `${loser} team picked the assassin.`,
      neutrals: `${loser} team hit ${game.neutralLimit} blank tiles.`,
      cleared: `All ${game.winner} tiles were found.`,
    }[game.reason] || "";
  }

  $("log").innerHTML = game.log.slice().reverse().map((e) => {
    if (e.type === "clue") return `<li>${cap(e.team)} clue: <b>${esc(e.word)}</b> ${e.count}</li>`;
    if (e.type === "guess") return `<li>${cap(e.team)} revealed <b>${esc(e.word)}</b> → ${e.result}</li>`;
    if (e.type === "pass") return `<li>${cap(e.team)} ended their turn</li>`;
    if (e.type === "end") return `<li><b>${cap(e.winner)} wins</b> (${e.reason})</li>`;
    return "";
  }).join("");
}
