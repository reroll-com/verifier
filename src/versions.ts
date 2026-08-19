import type { DistRange, GameVersion } from "./types";

function freezeDistribution(distribution: readonly DistRange[]) {
  return Object.freeze(
    distribution.map(({ interval, weight }) =>
      Object.freeze({ interval: Object.freeze({ ...interval }), weight })
    )
  );
}

export const V1_DISTRIBUTION = freezeDistribution([
  { interval: { exclusiveHigh: 1n, inclusiveLow: 0n }, weight: 802625250328n },
  {
    interval: { exclusiveHigh: 101n, inclusiveLow: 1n },
    weight: 160525050066n,
  },
  {
    interval: { exclusiveHigh: 1001n, inclusiveLow: 101n },
    weight: 27454700943n,
  },
  {
    interval: { exclusiveHigh: 2001n, inclusiveLow: 1001n },
    weight: 5490940189n,
  },
  {
    interval: { exclusiveHigh: 10001n, inclusiveLow: 2001n },
    weight: 2745470094n,
  },
  {
    interval: { exclusiveHigh: 50001n, inclusiveLow: 10001n },
    weight: 1098188038n,
  },
  {
    interval: { exclusiveHigh: 100001n, inclusiveLow: 50001n },
    weight: 54909402n,
  },
  {
    interval: { exclusiveHigh: 5000001n, inclusiveLow: 100001n },
    weight: 5490940n,
  },
] satisfies readonly DistRange[]);

export const V2_DISTRIBUTION = freezeDistribution([
  { interval: { exclusiveHigh: 1n, inclusiveLow: 0n }, weight: 486940870481n },
  {
    interval: { exclusiveHigh: 101n, inclusiveLow: 1n },
    weight: 486940870481n,
  },
  {
    interval: { exclusiveHigh: 1001n, inclusiveLow: 101n },
    weight: 19459290000n,
  },
  {
    interval: { exclusiveHigh: 2001n, inclusiveLow: 1001n },
    weight: 3891858000n,
  },
  {
    interval: { exclusiveHigh: 10001n, inclusiveLow: 2001n },
    weight: 1945929000n,
  },
  {
    interval: { exclusiveHigh: 50001n, inclusiveLow: 10001n },
    weight: 778371600n,
  },
  {
    interval: { exclusiveHigh: 100001n, inclusiveLow: 50001n },
    weight: 38918580n,
  },
  {
    interval: { exclusiveHigh: 10000001n, inclusiveLow: 100001n },
    weight: 3891858n,
  },
] satisfies readonly DistRange[]);

export const V3_DISTRIBUTION = freezeDistribution([
  { interval: { exclusiveHigh: 1n, inclusiveLow: 0n }, weight: 655484310244n },
  {
    interval: { exclusiveHigh: 101n, inclusiveLow: 1n },
    weight: 327742155122n,
  },
  {
    interval: { exclusiveHigh: 1001n, inclusiveLow: 101n },
    weight: 10786838993n,
  },
  {
    interval: { exclusiveHigh: 10001n, inclusiveLow: 1001n },
    weight: 5393419496n,
  },
  {
    interval: { exclusiveHigh: 100001n, inclusiveLow: 10001n },
    weight: 539341950n,
  },
  {
    interval: { exclusiveHigh: 500001n, inclusiveLow: 100001n },
    weight: 53934195n,
  },
] satisfies readonly DistRange[]);

const totalWeight = (distribution: readonly DistRange[]) =>
  distribution.reduce((total, { weight }) => total + weight, 0n);

export const V1_GAME: GameVersion = Object.freeze({
  version: "v1",
  algorithm: "sha256",
  hashMethod: "chained-hmac",
  distribution: V1_DISTRIBUTION,
  totalWeight: totalWeight(V1_DISTRIBUTION),
  normalization: 2n ** 256n,
  expectedRtp: 0.9899999953428601,
});

export const V2_GAME: GameVersion = Object.freeze({
  version: "v2",
  algorithm: "sha256",
  hashMethod: "split-digest",
  distribution: V2_DISTRIBUTION,
  totalWeight: totalWeight(V2_DISTRIBUTION),
  normalization: 2n ** 128n,
  expectedRtp: 0.987434679888095,
});

export const V3_GAME: GameVersion = Object.freeze({
  version: "v3",
  algorithm: "sha256",
  hashMethod: "chained-hmac",
  distribution: V3_DISTRIBUTION,
  totalWeight: totalWeight(V3_DISTRIBUTION),
  normalization: 2n ** 256n,
  expectedRtp: 0.98000000025128,
});

export const GAME_VERSIONS = Object.freeze([
  V1_GAME,
  V2_GAME,
  V3_GAME,
] as const);
export const CURRENT_GAME_VERSION = V3_GAME.version;
export const CURRENT_GAME = V3_GAME;
