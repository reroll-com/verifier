import { createHash, createHmac } from "node:crypto";
import { calculateRollSync } from "./engine";
import { GameRegistry } from "./registry";
import type { HmacGenerator, RollInput } from "./types";

export function nodeHmacHex(
  algo: "sha256" | "sha512",
  options: {
    key: string;
    message: string;
  }
) {
  return createHmac(algo, options.key).update(options.message).digest("hex");
}

export const nodeHmac: HmacGenerator = async (algo, options) => {
  return nodeHmacHex(algo, options);
};

export function nodeDigestHex(algorithm: "sha256" | "sha512", value: string) {
  return createHash(algorithm).update(value).digest("hex");
}

export function calculateServerRoll(version: string, input: RollInput) {
  return calculateRollSync(GameRegistry.get(version), input, nodeHmacHex);
}
