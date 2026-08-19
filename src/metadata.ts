import { GameRegistry } from "./registry";
import { calculateEV } from "./engine";
import type { GameVersion } from "./types";

type GameMetadata = Pick<
  GameVersion,
  "version" | "distribution" | "totalWeight" | "expectedRtp"
>;

function getMaxExclusiveHigh(game: GameMetadata): bigint {
  if (game.distribution.length === 0) {
    throw new Error(`Version ${game.version} has empty distribution`);
  }

  return game.distribution.reduce((max, entry) => {
    return entry.interval.exclusiveHigh > max
      ? entry.interval.exclusiveHigh
      : max;
  }, 0n);
}

export function getGameVersionMaxMultiplier(game: GameMetadata): number {
  const maxExclusiveHigh = getMaxExclusiveHigh(game);
  const maxInclusive = maxExclusiveHigh - 1n;
  return Number(maxInclusive) / 100;
}

export function getVersionMaxMultiplier(version: string): number {
  const game = GameRegistry.get(version);
  return getGameVersionMaxMultiplier(game);
}

export function getLatestMaxMultiplier(): number {
  const latest = GameRegistry.getLatest();
  return getGameVersionMaxMultiplier(latest);
}

export function getGameVersionIntegrity(game: GameMetadata): {
  expectedValue: number;
  calculatedTotalWeight: bigint;
} {
  return calculateEV(game.distribution, game.totalWeight);
}

export function getVersionIntegrity(version: string) {
  return getGameVersionIntegrity(GameRegistry.get(version));
}

export function getLatestIntegrity() {
  return getGameVersionIntegrity(GameRegistry.getLatest());
}

export function assertGameVersionIntegrity(game: GameMetadata) {
  const check = getGameVersionIntegrity(game);

  if (Math.abs(check.expectedValue - game.expectedRtp) > 1e-8) {
    throw new Error(
      `CRITICAL: Math Failure in ${game.version}. EV is ${check.expectedValue}`
    );
  }

  if (check.calculatedTotalWeight !== game.totalWeight) {
    throw new Error(
      `CRITICAL: Math Failure in ${game.version}. Distribution weights do not match total weight.`
    );
  }
}

function toThresholdX100(value: bigint | number | string): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

export function getGameVersionHitProbabilityForMultiplierX100(
  game: GameMetadata,
  thresholdX100: bigint | number | string
): number {
  const threshold = toThresholdX100(thresholdX100);

  if (threshold <= 0n) return 1;

  const hitWeight = game.distribution.reduce((total, { interval, weight }) => {
    if (interval.exclusiveHigh <= threshold) return total;
    if (interval.inclusiveLow >= threshold) return total + Number(weight);

    const intervalSize = interval.exclusiveHigh - interval.inclusiveLow;
    const hitSize = interval.exclusiveHigh - threshold;

    return total + Number(weight) * (Number(hitSize) / Number(intervalSize));
  }, 0);

  return hitWeight / Number(game.totalWeight);
}

export function getGameVersionExpectedRollsForMultiplierX100(
  game: GameMetadata,
  thresholdX100: bigint | number | string
): number {
  const probability = getGameVersionHitProbabilityForMultiplierX100(
    game,
    thresholdX100
  );

  return probability > 0 ? 1 / probability : Number.POSITIVE_INFINITY;
}

export function getVersionExpectedRollsForMultiplierX100(
  version: string,
  thresholdX100: bigint | number | string
): number {
  return getGameVersionExpectedRollsForMultiplierX100(
    GameRegistry.get(version),
    thresholdX100
  );
}

export function assertSystemIntegrity() {
  for (const version of GameRegistry.listVersions()) {
    assertGameVersionIntegrity(GameRegistry.get(version));
  }
}
