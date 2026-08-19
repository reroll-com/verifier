import { calculateRoll } from "./engine";
import { GameRegistry } from "./registry";
import type {
  DigestGenerator,
  HmacGenerator,
  RollInput,
  RollProof,
} from "./types";

export type VerifyRollInput = RollInput & {
  readonly version: string;
  readonly expectedServerSeedHash?: string;
};

export type VerificationResult = {
  readonly version: string;
  readonly nonce: bigint;
  readonly multiplierX100: number;
  readonly serverSeedHash: string;
  readonly commitmentMatches?: boolean;
  readonly proof: RollProof;
};

export async function verifyRoll(
  input: VerifyRollInput,
  crypto: { hmac: HmacGenerator; digest: DigestGenerator }
): Promise<VerificationResult> {
  const game = GameRegistry.get(input.version);
  const [roll, serverSeedHash] = await Promise.all([
    calculateRoll(game, input, crypto.hmac),
    crypto.digest(game.algorithm, input.serverSeed),
  ]);

  return {
    version: game.version,
    nonce: input.nonce,
    multiplierX100: roll.multiplierX100,
    serverSeedHash,
    commitmentMatches: input.expectedServerSeedHash
      ? serverSeedHash === input.expectedServerSeedHash.trim().toLowerCase()
      : undefined,
    proof: roll.proof,
  };
}
