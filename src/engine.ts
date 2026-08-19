import type {
  CalculatedRoll,
  DistRange,
  GameVersion,
  HmacGenerator,
  Interval,
  RollInput,
  SyncHmacGenerator,
} from "./types";

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;

  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }

  return value;
}

function getEntropyByteLength(normalization: bigint): number {
  const bitLength = normalization.toString(2).length - 1;

  if (
    normalization !== 1n << BigInt(bitLength) ||
    bitLength === 0 ||
    bitLength % 8 !== 0
  ) {
    throw new Error("Game normalization must be a non-zero power of two bytes");
  }

  return bitLength / 8;
}

const hexToNumber = (hash: string, interval: Interval, denominator: bigint) => {
  const num = BigInt(`0x${hash}`);
  return (
    interval.inclusiveLow +
    ((interval.exclusiveHigh - interval.inclusiveLow) * num) / denominator
  );
};

const mapRandomToInterval = (
  value: bigint,
  interval: Interval,
  denominator: bigint
) => {
  return (
    interval.inclusiveLow +
    ((interval.exclusiveHigh - interval.inclusiveLow) * value) / denominator
  );
};

const findIntervalFromRandom = (
  value: bigint,
  distribution: readonly DistRange[],
  totalWeight: bigint,
  denominator: bigint
): Interval => {
  const target = mapRandomToInterval(
    value,
    { exclusiveHigh: totalWeight, inclusiveLow: 0n },
    denominator
  );

  let acc = 0n;
  for (const { interval, weight } of distribution) {
    if (acc <= target && target < acc + weight) return interval;
    acc += weight;
  }
  throw new Error("Critical: Distribution Gap");
};

const findIntervalFromHash = (
  hash: string,
  distribution: readonly DistRange[],
  totalWeight: bigint,
  denominator: bigint
): Interval => {
  const target = hexToNumber(
    hash,
    { exclusiveHigh: totalWeight, inclusiveLow: 0n },
    denominator
  );

  let acc = 0n;
  for (const { interval, weight } of distribution) {
    if (acc <= target && target < acc + weight) return interval;
    acc += weight;
  }
  throw new Error("Critical: Distribution Gap");
};

export function calculateMultiplierX100FromEntropy(params: {
  intervalRandom: bigint;
  pointRandom: bigint;
  distribution: readonly DistRange[];
  totalWeight: bigint;
  normalization: bigint;
}): number {
  const interval = findIntervalFromRandom(
    params.intervalRandom,
    params.distribution,
    params.totalWeight,
    params.normalization
  );
  const point = mapRandomToInterval(
    params.pointRandom,
    interval,
    params.normalization
  );

  return Number(point);
}

export function calculateRandomMultiplierX100(
  game: Pick<GameVersion, "distribution" | "totalWeight" | "normalization">,
  randomBytes: (byteLength: number) => Uint8Array
): number {
  const byteLength = getEntropyByteLength(game.normalization);
  const intervalBytes = randomBytes(byteLength);
  const pointBytes = randomBytes(byteLength);

  if (intervalBytes.length !== byteLength || pointBytes.length !== byteLength) {
    throw new Error(`Random source must return ${byteLength} bytes`);
  }

  return calculateMultiplierX100FromEntropy({
    intervalRandom: bytesToBigInt(intervalBytes),
    pointRandom: bytesToBigInt(pointBytes),
    distribution: game.distribution,
    totalWeight: game.totalWeight,
    normalization: game.normalization,
  });
}

function calculateMultiplierFromHashParts(params: {
  intervalHash: string;
  pointHash: string;
  distribution: readonly DistRange[];
  totalWeight: bigint;
  normalization: bigint;
}): number {
  const interval = findIntervalFromHash(
    params.intervalHash,
    params.distribution,
    params.totalWeight,
    params.normalization
  );
  const point = hexToNumber(params.pointHash, interval, params.normalization);

  return Number(point);
}

function calculateSplitDigestRoll(
  game: GameVersion,
  digest: string
): CalculatedRoll {
  const intervalHash = digest.slice(0, 32);
  const pointHash = digest.slice(32, 64);

  return {
    multiplierX100: calculateMultiplierX100FromEntropy({
      intervalRandom: BigInt(`0x${intervalHash}`),
      pointRandom: BigInt(`0x${pointHash}`),
      distribution: game.distribution,
      totalWeight: game.totalWeight,
      normalization: game.normalization,
    }),
    proof: {
      hashMethod: "split-digest",
      digest,
      intervalHash,
      pointHash,
    },
  };
}

function calculateChainedHmacRoll(
  game: GameVersion,
  combinedSeed: string,
  intervalHash: string,
  pointHash: string
): CalculatedRoll {
  return {
    multiplierX100: calculateMultiplierFromHashParts({
      intervalHash,
      pointHash,
      distribution: game.distribution,
      totalWeight: game.totalWeight,
      normalization: game.normalization,
    }),
    proof: {
      hashMethod: "chained-hmac",
      combinedSeed,
      intervalHash,
      pointHash,
    },
  };
}

export async function calculateRoll(
  game: GameVersion,
  input: RollInput,
  hasher: HmacGenerator
): Promise<CalculatedRoll> {
  if (input.nonce < 0n) throw new Error("Nonce must be zero or greater");

  if (game.hashMethod === "split-digest") {
    const digest = await hasher(game.algorithm, {
      key: input.serverSeed,
      message: `${input.clientSeed}:${input.nonce}:0`,
    });
    return calculateSplitDigestRoll(game, digest);
  }

  const combinedSeed = await hasher(game.algorithm, {
    key: `${input.serverSeed}:${input.nonce}`,
    message: input.clientSeed,
  });
  const intervalHash = await hasher(game.algorithm, {
    key: combinedSeed,
    message: "interval",
  });
  const pointHash = await hasher(game.algorithm, {
    key: combinedSeed,
    message: "point",
  });

  return calculateChainedHmacRoll(game, combinedSeed, intervalHash, pointHash);
}

export function calculateRollSync(
  game: GameVersion,
  input: RollInput,
  hasher: SyncHmacGenerator
): CalculatedRoll {
  if (input.nonce < 0n) throw new Error("Nonce must be zero or greater");

  if (game.hashMethod === "split-digest") {
    const digest = hasher(game.algorithm, {
      key: input.serverSeed,
      message: `${input.clientSeed}:${input.nonce}:0`,
    });
    return calculateSplitDigestRoll(game, digest);
  }

  const combinedSeed = hasher(game.algorithm, {
    key: `${input.serverSeed}:${input.nonce}`,
    message: input.clientSeed,
  });
  const intervalHash = hasher(game.algorithm, {
    key: combinedSeed,
    message: "interval",
  });
  const pointHash = hasher(game.algorithm, {
    key: combinedSeed,
    message: "point",
  });

  return calculateChainedHmacRoll(game, combinedSeed, intervalHash, pointHash);
}

export function calculateEV(
  distribution: readonly DistRange[],
  totalWeight: bigint
): { expectedValue: number; calculatedTotalWeight: bigint } {
  let weightedSum = 0n;
  let accumulatedWeight = 0n;

  for (const { interval, weight } of distribution) {
    weightedSum +=
      (interval.exclusiveHigh + interval.inclusiveLow - 1n) * weight;
    accumulatedWeight += weight;
  }

  const ev = Number(weightedSum) / Number(totalWeight) / 200;

  return {
    expectedValue: ev,
    calculatedTotalWeight: accumulatedWeight,
  };
}
