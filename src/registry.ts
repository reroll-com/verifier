import { calculateEV } from "./engine";
import type { GameVersion } from "./types";
import { CURRENT_GAME, GAME_VERSIONS } from "./versions";

const SLOTS_VERSIONS = GAME_VERSIONS satisfies readonly GameVersion[];

function validateVersion(game: GameVersion) {
  if (game.distribution.length === 0) {
    throw new Error(`Version ${game.version} has an empty distribution`);
  }

  let previousHigh = 0n;
  for (const { interval, weight } of game.distribution) {
    if (weight <= 0n) {
      throw new Error(`Version ${game.version} has a non-positive weight`);
    }
    if (
      interval.inclusiveLow !== previousHigh ||
      interval.exclusiveHigh <= interval.inclusiveLow
    ) {
      throw new Error(`Version ${game.version} has invalid payout intervals`);
    }
    previousHigh = interval.exclusiveHigh;
  }

  const bitLength = game.normalization.toString(2).length - 1;
  if (
    game.normalization !== 1n << BigInt(bitLength) ||
    bitLength === 0 ||
    bitLength % 8 !== 0
  ) {
    throw new Error(`Version ${game.version} has invalid normalization`);
  }

  const integrity = calculateEV(game.distribution, game.totalWeight);
  if (integrity.calculatedTotalWeight !== game.totalWeight) {
    throw new Error(
      `Version ${game.version} weights do not match total weight`
    );
  }
  if (Math.abs(integrity.expectedValue - game.expectedRtp) > 1e-8) {
    throw new Error(`Version ${game.version} does not match its declared RTP`);
  }
}

for (const game of SLOTS_VERSIONS) validateVersion(game);

const versionsById = new Map(
  SLOTS_VERSIONS.map((game) => [game.version, game])
);

if (versionsById.size !== SLOTS_VERSIONS.length) {
  throw new Error("Game versions must have unique identifiers");
}

export const GameRegistry = Object.freeze({
  get(id: string) {
    const v = versionsById.get(id);
    if (!v) throw new Error(`Version ${id} not found`);
    return v;
  },
  has(id: string) {
    return versionsById.has(id);
  },
  listVersions() {
    return SLOTS_VERSIONS.map((version) => version.version);
  },
  getLatest() {
    return CURRENT_GAME;
  },
});
