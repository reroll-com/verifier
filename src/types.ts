export interface Interval {
  readonly exclusiveHigh: bigint;
  readonly inclusiveLow: bigint;
}

export type DistRange = {
  readonly interval: Interval;
  readonly weight: bigint;
};

export type HmacGenerator = (
  algorithm: HmacAlgorithm,
  options: {
    key: string;
    message: string;
  }
) => Promise<string>;

export type SyncHmacGenerator = (
  algorithm: HmacAlgorithm,
  options: {
    key: string;
    message: string;
  }
) => string;

export type DigestGenerator = (
  algorithm: HmacAlgorithm,
  value: string
) => Promise<string>;

export type HmacAlgorithm = "sha256" | "sha512";

export type FairnessHashMethod = "split-digest" | "chained-hmac";

export interface GameVersion {
  readonly version: string;
  readonly distribution: readonly DistRange[];
  readonly algorithm: HmacAlgorithm;
  readonly hashMethod: FairnessHashMethod;
  readonly normalization: bigint;
  readonly totalWeight: bigint;
  readonly expectedRtp: number;
}

export type RollInput = {
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: bigint;
};

export type SplitDigestProof = {
  readonly hashMethod: "split-digest";
  readonly digest: string;
  readonly intervalHash: string;
  readonly pointHash: string;
};

export type ChainedHmacProof = {
  readonly hashMethod: "chained-hmac";
  readonly combinedSeed: string;
  readonly intervalHash: string;
  readonly pointHash: string;
};

export type RollProof = SplitDigestProof | ChainedHmacProof;

export type CalculatedRoll = {
  readonly multiplierX100: number;
  readonly proof: RollProof;
};
