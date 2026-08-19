import type { DigestGenerator, HmacGenerator, HmacAlgorithm } from "./types";
import { verifyRoll, type VerifyRollInput } from "./verify";

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const browserHmac: HmacGenerator = async (algorithm, options) => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(options.key),
    { name: "HMAC", hash: toWebCryptoAlgorithm(algorithm) },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(options.message)
  );

  return bytesToHex(signature);
};

const browserDigest: DigestGenerator = async (algorithm, value) => {
  const digest = await crypto.subtle.digest(
    toWebCryptoAlgorithm(algorithm),
    new TextEncoder().encode(value)
  );
  return bytesToHex(digest);
};

function toWebCryptoAlgorithm(algorithm: HmacAlgorithm) {
  return algorithm === "sha256" ? "SHA-256" : "SHA-512";
}

export function verifyRollInBrowser(input: VerifyRollInput) {
  return verifyRoll(input, { hmac: browserHmac, digest: browserDigest });
}
