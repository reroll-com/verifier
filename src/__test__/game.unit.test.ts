import { describe, expect, test } from "bun:test";
import {
  calculateEV,
  calculateMultiplierX100FromEntropy,
  calculateRandomMultiplierX100,
  calculateRoll,
} from "../engine";
import {
  assertGameVersionIntegrity,
  assertSystemIntegrity,
  getGameVersionExpectedRollsForMultiplierX100,
  getGameVersionMaxMultiplier,
  getLatestMaxMultiplier,
  getVersionMaxMultiplier,
} from "../metadata";
import { GameRegistry } from "../registry";
import {
  calculateServerRoll,
  nodeDigestHex,
  nodeHmac,
  nodeHmacHex,
} from "../server";
import type { DistRange, GameVersion } from "../types";
import {
  CURRENT_GAME,
  CURRENT_GAME_VERSION,
  V2_GAME,
  V3_GAME,
} from "../versions";
import { verifyRoll } from "../verify";

describe("engine", () => {
  test("calculateEV computes weighted midpoint expected value", () => {
    const distribution: DistRange[] = [
      { interval: { inclusiveLow: 0n, exclusiveHigh: 100n }, weight: 3n },
      { interval: { inclusiveLow: 100n, exclusiveHigh: 200n }, weight: 1n },
    ];
    const result = calculateEV(distribution, 4n);
    expect(result.calculatedTotalWeight).toBe(4n);
    expect(result.expectedValue).toBe(0.745);
  });

  test("calculateMultiplierX100FromEntropy selects an exact integer point", () => {
    const multiplierX100 = calculateMultiplierX100FromEntropy({
      intervalRandom: 60n,
      pointRandom: 50n,
      distribution: [
        { interval: { inclusiveLow: 0n, exclusiveHigh: 100n }, weight: 5n },
        { interval: { inclusiveLow: 100n, exclusiveHigh: 200n }, weight: 5n },
      ],
      totalWeight: 10n,
      normalization: 100n,
    });

    expect(multiplierX100).toBe(150);
  });

  test("calculateMultiplierX100FromEntropy throws for an uncovered weight", () => {
    expect(() =>
      calculateMultiplierX100FromEntropy({
        intervalRandom: 90n,
        pointRandom: 0n,
        distribution: [
          { interval: { inclusiveLow: 0n, exclusiveHigh: 100n }, weight: 5n },
        ],
        totalWeight: 10n,
        normalization: 100n,
      })
    ).toThrow("Critical: Distribution Gap");
  });

  test("calculateRandomMultiplierX100 derives entropy width from the version", () => {
    const requestedByteLengths: number[] = [];
    const multiplierX100 = calculateRandomMultiplierX100(
      V3_GAME,
      (byteLength) => {
        requestedByteLengths.push(byteLength);
        return new Uint8Array(byteLength).fill(255);
      }
    );

    expect(requestedByteLengths).toEqual([32, 32]);
    expect(multiplierX100).toBe(500_000);
  });

  test("split-digest versions derive both entropy values from one HMAC", async () => {
    const calls: Array<{ key: string; message: string }> = [];
    await calculateRoll(
      V2_GAME,
      { serverSeed: "server", clientSeed: "client", nonce: 7n },
      async (_algorithm, options) => {
        calls.push(options);
        return "99".padEnd(64, "0");
      }
    );

    expect(calls).toEqual([{ key: "server", message: "client:7:0" }]);
  });

  test("rejects negative nonces", () => {
    expect(() =>
      calculateServerRoll("v3", {
        serverSeed: "server",
        clientSeed: "client",
        nonce: -1n,
      })
    ).toThrow("Nonce must be zero or greater");
  });
});

describe("registry and metadata", () => {
  test("registry preserves every immutable fairness version", () => {
    expect(GameRegistry.listVersions()).toEqual([
      "v1",
      "v2",
      CURRENT_GAME_VERSION,
    ]);
    expect(GameRegistry.get(CURRENT_GAME_VERSION)).toBe(CURRENT_GAME);
    expect(GameRegistry.getLatest()).toBe(CURRENT_GAME);
    expect(GameRegistry.has("v1")).toBe(true);
    expect(GameRegistry.has("unknown")).toBe(false);
    expect(Object.isFrozen(CURRENT_GAME)).toBe(true);
    expect(Object.isFrozen(CURRENT_GAME.distribution)).toBe(true);
  });

  test("metadata resolves max multiplier values", () => {
    expect(getGameVersionMaxMultiplier(CURRENT_GAME)).toBe(5000);
    expect(getVersionMaxMultiplier(CURRENT_GAME_VERSION)).toBe(5000);
    expect(getLatestMaxMultiplier()).toBe(5000);
  });

  test("metadata estimates rolls before hitting a multiplier threshold", () => {
    expect(
      getGameVersionExpectedRollsForMultiplierX100(CURRENT_GAME, 10000)
    ).toBeCloseTo(1683.85, 2);
    expect(
      getGameVersionExpectedRollsForMultiplierX100(CURRENT_GAME, 100000)
    ).toBeCloseTo(18539.1, 1);
  });
});

describe("integrity and verification", () => {
  test("every registered version passes its declared integrity checks", () => {
    expect(() => assertSystemIntegrity()).not.toThrow();
  });

  test("integrity rejects a version whose declared RTP is wrong", () => {
    const invalid: GameVersion = {
      ...CURRENT_GAME,
      version: "invalid",
      expectedRtp: 1,
    };

    expect(() => assertGameVersionIntegrity(invalid)).toThrow(
      "CRITICAL: Math Failure in invalid"
    );
  });

  test.each([
    {
      version: "v1",
      multiplierX100: 0,
      combinedSeed:
        "0fb102a9fc97969579240f437045f7b1691787b600d84c84948a6c556f2c6607",
      intervalHash:
        "bc6a7d6e48331cced82ef53c1c7e0647d1be0d4738dfa6026fc95c7d7ad31054",
      pointHash:
        "b7014df4b2aef358575b91a0f5e918424f3940983269b39fe4ca98b71bd50b05",
    },
    {
      version: "v3",
      multiplierX100: 72,
      combinedSeed:
        "0fb102a9fc97969579240f437045f7b1691787b600d84c84948a6c556f2c6607",
      intervalHash:
        "bc6a7d6e48331cced82ef53c1c7e0647d1be0d4738dfa6026fc95c7d7ad31054",
      pointHash:
        "b7014df4b2aef358575b91a0f5e918424f3940983269b39fe4ca98b71bd50b05",
    },
  ])("preserves the $version chained-HMAC vector", async (vector) => {
    const result = await verifyRoll(
      {
        version: vector.version,
        serverSeed: "server-seed-vector",
        clientSeed: "client-seed-vector",
        nonce: 0n,
        expectedServerSeedHash:
          "03892E44DC06F9EE4B0E033D4D85927E83EEBD5889759CF9649E89D01B05A546",
      },
      {
        hmac: nodeHmac,
        digest: async (algorithm, value) => nodeDigestHex(algorithm, value),
      }
    );

    expect(result.multiplierX100).toBe(vector.multiplierX100);
    expect(result.serverSeedHash).toBe(
      "03892e44dc06f9ee4b0e033d4d85927e83eebd5889759cf9649e89d01b05a546"
    );
    expect(result.commitmentMatches).toBe(true);
    expect(result.proof).toEqual({
      hashMethod: "chained-hmac",
      combinedSeed: vector.combinedSeed,
      intervalHash: vector.intervalHash,
      pointHash: vector.pointHash,
    });
  });

  test("preserves the v2 split-digest vector", () => {
    expect(
      calculateServerRoll("v2", {
        serverSeed: "server-seed-vector",
        clientSeed: "client-seed-vector",
        nonce: 0n,
      })
    ).toEqual({
      multiplierX100: 0,
      proof: {
        hashMethod: "split-digest",
        digest:
          "35f010b2e8bc3a3cc5d51081adde5b5ed7015d3edaa0ae6440c1093015a9d856",
        intervalHash: "35f010b2e8bc3a3cc5d51081adde5b5e",
        pointHash: "d7015d3edaa0ae6440c1093015a9d856",
      },
    });
  });

  test("node HMAC adapter remains deterministic", () => {
    expect(
      nodeHmacHex("sha256", { key: "server", message: "client:0:0" })
    ).toHaveLength(64);
  });
});
