// Pure game logic. No networking here, so it can be tested on its own.
import { WORDS } from "./words.js";

export const TEAMS = ["red", "blue"];
export const ROLES = ["teller", "guesser"];
export const NEUTRAL_LIMIT = 3; // A team that reveals this many blank tiles loses.

export function otherTeam(team) {
  return team === "red" ? "blue" : "red";
}

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a fresh board: 25 words, 9 red, 9 blue, 6 blank (neutral) and 1 assassin.
 */
export function createBoard(rng = Math.random, wordBank = WORDS) {
  const startingTeam = rng() < 0.5 ? "red" : "blue";
  const words = shuffle(wordBank, rng).slice(0, 25);
  const types = [
    ...Array(9).fill("red"),
    ...Array(9).fill("blue"),
    ...Array(6).fill("neutral"),
    "assassin",
  ];
  const shuffledTypes = shuffle(types, rng);
  const tiles = words.map((word, i) => ({ word, type: shuffledTypes[i], revealed: false }));
  return { tiles, startingTeam };
}

export function createGame(rng = Math.random) {
  const { tiles, startingTeam } = createBoard(rng);
  return {
    phase: "clue", // "clue" -> teller gives a clue; "guess" -> guesser picks tiles; "over"
    turn: startingTeam,
    startingTeam,
    tiles,
    clue: null, // { word, count, guessesLeft }
    neutralsHit: { red: 0, blue: 0 },
    winner: null,
    reason: null,
    log: [],
  };
}

export function remaining(game, team) {
  return game.tiles.filter((t) => t.type === team && !t.revealed).length;
}

function endGame(game, winner, reason) {
  game.phase = "over";
  game.winner = winner;
  game.reason = reason;
  game.clue = null;
  game.log.push({ type: "end", winner, reason });
}

function endTurn(game) {
  game.turn = otherTeam(game.turn);
  game.phase = "clue";
  game.clue = null;
}

export function giveClue(game, team, word, count) {
  if (game.phase !== "clue") throw new Error("It is not time for a clue.");
  if (team !== game.turn) throw new Error("It is not your team's turn.");
  const clean = String(word || "").trim();
  if (!clean) throw new Error("Clue cannot be empty.");
  if (/\s/.test(clean)) throw new Error("Clue must be a single word.");
  const onBoard = game.tiles.some(
    (t) => !t.revealed && t.word.toLowerCase() === clean.toLowerCase()
  );
  if (onBoard) throw new Error("Clue cannot be a word on the board.");
  const n = Number(count);
  if (!Number.isInteger(n) || n < 0 || n > 9) throw new Error("Number must be 0 to 9.");
  // The guesser gets exactly the number of guesses the teller stated.
  // 0 is the all-in option: guess freely until you get one wrong.
  game.clue = { word: clean, count: n, guessesLeft: n === 0 ? Infinity : n };
  game.phase = "guess";
  game.log.push({ type: "clue", team, word: clean, count: n });
}

export function guess(game, team, index) {
  if (game.phase !== "guess") throw new Error("Wait for a clue first.");
  if (team !== game.turn) throw new Error("It is not your team's turn.");
  const tile = game.tiles[index];
  if (!tile) throw new Error("No such tile.");
  if (tile.revealed) throw new Error("That tile is already revealed.");

  tile.revealed = true;
  game.log.push({ type: "guess", team, word: tile.word, result: tile.type });

  if (tile.type === "assassin") {
    endGame(game, otherTeam(team), "assassin");
    return;
  }
  if (tile.type === "neutral") {
    game.neutralsHit[team] += 1;
    if (game.neutralsHit[team] >= NEUTRAL_LIMIT) {
      endGame(game, otherTeam(team), "neutrals");
      return;
    }
  } else {
    // A coloured tile. Either team may have just cleared their set,
    // including when a team reveals the other team's last word.
    for (const t of TEAMS) {
      if (remaining(game, t) === 0) {
        endGame(game, t, "cleared");
        return;
      }
    }
  }
  // A wrong guess does not end the turn. The team keeps going until they have
  // used the number of guesses the teller gave them, or they choose to stop.
  game.clue.guessesLeft -= 1;
  if (game.clue.guessesLeft <= 0) endTurn(game);
}

export function passTurn(game, team) {
  if (game.phase !== "guess") throw new Error("You can only pass while guessing.");
  if (team !== game.turn) throw new Error("It is not your team's turn.");
  game.log.push({ type: "pass", team });
  endTurn(game);
}

/**
 * The view a given player is allowed to see. Tellers see every tile's colour;
 * guessers only see revealed tiles. Once the game is over everyone sees all.
 */
export function viewFor(game, role) {
  const seeAll = role === "teller" || game.phase === "over";
  return {
    phase: game.phase,
    turn: game.turn,
    startingTeam: game.startingTeam,
    clue: game.clue
      ? { word: game.clue.word, count: game.clue.count,
          guessesLeft: Number.isFinite(game.clue.guessesLeft) ? game.clue.guessesLeft : null }
      : null,
    neutralsHit: game.neutralsHit,
    neutralLimit: NEUTRAL_LIMIT,
    remaining: { red: remaining(game, "red"), blue: remaining(game, "blue") },
    winner: game.winner,
    reason: game.reason,
    log: game.log.slice(-30),
    tiles: game.tiles.map((t) => ({
      word: t.word,
      revealed: t.revealed,
      type: seeAll || t.revealed ? t.type : null,
    })),
  };
}
