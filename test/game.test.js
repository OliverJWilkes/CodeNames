import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, giveClue, guess, passTurn, viewFor, remaining, otherTeam, NEUTRAL_LIMIT } from "../src/game.js";

// Deterministic pseudo-random generator so tests are repeatable.
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

function idx(game, type, team) {
  return game.tiles.findIndex((t) => !t.revealed && t.type === (team ?? type));
}

test("board has correct distribution", () => {
  const g = createGame(seeded(1));
  const counts = {};
  for (const t of g.tiles) counts[t.type] = (counts[t.type] || 0) + 1;
  assert.equal(g.tiles.length, 25);
  assert.equal(counts[g.startingTeam], 9);
  assert.equal(counts[otherTeam(g.startingTeam)], 8);
  assert.equal(counts.neutral, 7);
  assert.equal(counts.assassin, 1);
  assert.equal(new Set(g.tiles.map((t) => t.word)).size, 25);
});

test("clue validation", () => {
  const g = createGame(seeded(2));
  assert.throws(() => giveClue(g, otherTeam(g.turn), "x", 1), /not your team/);
  assert.throws(() => giveClue(g, g.turn, "two words", 1), /single word/);
  assert.throws(() => giveClue(g, g.turn, g.tiles[0].word, 1), /on the board/);
  assert.throws(() => giveClue(g, g.turn, "ok", 10), /0 to 9/);
  giveClue(g, g.turn, "ok", 2);
  assert.equal(g.phase, "guess");
  assert.equal(g.clue.guessesLeft, 3);
});

test("correct guesses continue, wrong colour ends turn", () => {
  const g = createGame(seeded(3));
  const team = g.turn;
  giveClue(g, team, "ok", 2);
  guess(g, team, idx(g, team));
  assert.equal(g.turn, team);
  assert.equal(g.clue.guessesLeft, 2);
  guess(g, team, idx(g, otherTeam(team)));
  assert.equal(g.turn, otherTeam(team));
  assert.equal(g.phase, "clue");
});

test("assassin loses immediately", () => {
  const g = createGame(seeded(4));
  const team = g.turn;
  giveClue(g, team, "ok", 1);
  guess(g, team, idx(g, "assassin"));
  assert.equal(g.phase, "over");
  assert.equal(g.winner, otherTeam(team));
  assert.equal(g.reason, "assassin");
});

test("three neutrals loses", () => {
  const g = createGame(seeded(5));
  const team = g.turn;
  for (let i = 0; i < NEUTRAL_LIMIT; i++) {
    if (g.turn !== team) { // other team gives a clue then passes
      giveClue(g, g.turn, "skip" + i, 1);
      passTurn(g, g.turn);
    }
    assert.equal(g.turn, team);
    giveClue(g, team, "ok" + i, 1);
    guess(g, team, idx(g, "neutral"));
  }
  assert.equal(g.phase, "over");
  assert.equal(g.winner, otherTeam(team));
  assert.equal(g.reason, "neutrals");
});

test("clearing all tiles wins, even via the other team's mistake", () => {
  const g = createGame(seeded(6));
  const team = g.turn;
  const other = otherTeam(team);
  // Reveal all but one of team's tiles directly to set up the situation.
  while (remaining(g, team) > 1) g.tiles[idx(g, team)].revealed = true;
  giveClue(g, team, "ok", 0);
  passTurn(g, team);
  giveClue(g, other, "oops", 1);
  guess(g, other, idx(g, team));
  assert.equal(g.phase, "over");
  assert.equal(g.winner, team);
  assert.equal(g.reason, "cleared");
});

test("guesser view hides unrevealed colours, teller sees all", () => {
  const g = createGame(seeded(7));
  const gv = viewFor(g, "guesser");
  assert.ok(gv.tiles.every((t) => t.type === null));
  const tv = viewFor(g, "teller");
  assert.ok(tv.tiles.every((t) => t.type !== null));
});
