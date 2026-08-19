import { Fragment, useMemo, useState, type FormEvent } from "react";
import { verifyRollInBrowser } from "../src/browser";
import {
  getGameVersionIntegrity,
  getGameVersionMaxMultiplier,
} from "../src/metadata";
import { GameRegistry } from "../src/registry";
import type { VerificationResult } from "../src/verify";

type BatchRoll = {
  nonce: string;
  multiplier: string;
};

const VERIFIER_VERSIONS = GameRegistry.listVersions().map((version) => ({
  version,
  label:
    version === GameRegistry.getLatest().version
      ? `Current ${version}`
      : version,
  game: GameRegistry.get(version),
}));

const SOURCE_REPOSITORY_URL =
  import.meta.env.VITE_SOURCE_REPOSITORY?.trim() ||
  "https://github.com/reroll-com/verifier";
const SOURCE_REVISION = import.meta.env.VITE_SOURCE_REVISION?.trim() || "main";
const SOURCE_BASE_URL = `${SOURCE_REPOSITORY_URL}/blob/${SOURCE_REVISION}`;
const SOURCE_LINKS = [
  { label: "engine.ts", href: `${SOURCE_BASE_URL}/src/engine.ts` },
  { label: "verify.ts", href: `${SOURCE_BASE_URL}/src/verify.ts` },
  { label: "versions.ts", href: `${SOURCE_BASE_URL}/src/versions.ts` },
  { label: "registry.ts", href: `${SOURCE_BASE_URL}/src/registry.ts` },
  { label: "verifier", href: `${SOURCE_BASE_URL}/verifier/App.tsx` },
];

function getVerifierVersion(version: string) {
  const match = VERIFIER_VERSIONS.find((entry) => entry.version === version);
  if (!match) throw new Error(`Version ${version} not found`);
  return match;
}

function getUrlParams() {
  const fragment = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(fragment || window.location.search);
}

function getInitialValue(name: string, fallback: string) {
  return getUrlParams().get(name) ?? fallback;
}

function getInitialVersion() {
  const requested = getInitialValue("version", "");
  return GameRegistry.has(requested)
    ? requested
    : GameRegistry.getLatest().version;
}

function formatMultiplier(multiplierX100: number) {
  return `${(multiplierX100 / 100).toFixed(2)}x`;
}

function getProofRows(result: VerificationResult) {
  return result.proof.hashMethod === "split-digest"
    ? [
        ["Digest (HMAC)", result.proof.digest],
        ["Interval Hash", result.proof.intervalHash],
        ["Point Hash", result.proof.pointHash],
      ]
    : [
        ["Combined Seed (HMAC)", result.proof.combinedSeed],
        ["Interval Hash", result.proof.intervalHash],
        ["Point Hash", result.proof.pointHash],
      ];
}

export function App() {
  const versions = useMemo(() => VERIFIER_VERSIONS, []);
  const verifierUrl = `${window.location.origin}${window.location.pathname}`;
  const [version, setVersion] = useState(getInitialVersion);
  const [serverSeed, setServerSeed] = useState(
    getInitialValue("serverSeed", "")
  );
  const [clientSeed, setClientSeed] = useState(
    getInitialValue("clientSeed", "")
  );
  const [expectedServerSeedHash, setExpectedServerSeedHash] = useState(
    getInitialValue("serverSeedHash", "")
  );
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [nonce, setNonce] = useState(getInitialValue("nonce", "0"));
  const [startNonce, setStartNonce] = useState(getInitialValue("nonce", "0"));
  const [rollCount, setRollCount] = useState("10");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [batchRolls, setBatchRolls] = useState<BatchRoll[]>([]);
  const [error, setError] = useState("");
  const selectedVersion = useMemo(() => getVerifierVersion(version), [version]);
  const selectedIntegrity = useMemo(
    () => getGameVersionIntegrity(selectedVersion.game),
    [selectedVersion]
  );
  const selectedMaxMultiplier = useMemo(
    () => getGameVersionMaxMultiplier(selectedVersion.game),
    [selectedVersion]
  );

  const verifyNonce = (nonceValue: bigint) =>
    verifyRollInBrowser({
      version,
      serverSeed: serverSeed.trim(),
      clientSeed: clientSeed.trim(),
      nonce: nonceValue,
      expectedServerSeedHash:
        expectedServerSeedHash.trim().toLowerCase() || undefined,
    });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      if (!serverSeed.trim() || !clientSeed.trim()) {
        throw new Error("Server seed and client seed are required.");
      }

      if (mode === "single") {
        const nonceValue = BigInt(nonce.trim());
        if (nonceValue < 0n) {
          throw new Error("Nonce must be zero or greater.");
        }

        setResult(await verifyNonce(nonceValue));
        setBatchRolls([]);
        return;
      }

      const startValue = BigInt(startNonce.trim());
      if (startValue < 0n) {
        throw new Error("Start nonce must be zero or greater.");
      }

      const countValue = Number(rollCount);
      if (!Number.isInteger(countValue) || countValue <= 0) {
        throw new Error("Roll count must be a positive integer.");
      }
      if (countValue > 500) {
        throw new Error("Roll count max is 500.");
      }

      const nextRolls: BatchRoll[] = [];
      let lastResult: VerificationResult | null = null;

      for (let index = 0; index < countValue; index += 1) {
        const rowResult = await verifyNonce(startValue + BigInt(index));
        nextRolls.push({
          nonce: rowResult.nonce.toString(),
          multiplier: formatMultiplier(rowResult.multiplierX100),
        });
        lastResult = rowResult;
      }

      setBatchRolls(nextRolls);
      setResult(lastResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  return (
    <main className="container">
      <header className="header">
        <h1>Reroll Provably Fair Verifier</h1>
        <p>
          This page uses the same versioned engine that calculates production
          outcomes. Verification runs entirely in your browser.
        </p>
        <p className="header-meta">
          Verifier URL: <a href={verifierUrl}>{verifierUrl}</a> | Source:{" "}
          <a href={SOURCE_REPOSITORY_URL} target="_blank" rel="noreferrer">
            {SOURCE_REPOSITORY_URL.replace(/^https?:\/\//, "")}
          </a>{" "}
          | Revision: <code>{SOURCE_REVISION}</code>
        </p>
        <p>
          Supply the revealed server seed, client seed, nonce, and recorded
          version to reproduce an outcome. Add the original server-seed hash to
          verify the earlier commitment as well.
        </p>
        <div className="header-links">
          {SOURCE_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>
      </header>

      <section className="card">
        <form className="form" onSubmit={onSubmit}>
          <div className="top-controls">
            <label>
              Seed Version
              <select
                name="version"
                value={version}
                onChange={(event) => setVersion(event.currentTarget.value)}
              >
                {versions.map((entry) => (
                  <option key={entry.version} value={entry.version}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mode-wrap">
              <span className="mode-label">Mode</span>
              <div className="mode-row">
                <button
                  type="button"
                  className={mode === "single" ? "tab active" : "tab"}
                  onClick={() => setMode("single")}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={mode === "batch" ? "tab active" : "tab"}
                  onClick={() => setMode("batch")}
                >
                  Batch
                </button>
              </div>
            </div>

            {mode === "single" ? (
              <label>
                Nonce
                <input
                  name="nonce"
                  type="number"
                  min="0"
                  step="1"
                  value={nonce}
                  onChange={(event) => setNonce(event.currentTarget.value)}
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  Start Nonce
                  <input
                    name="startNonce"
                    type="number"
                    min="0"
                    step="1"
                    value={startNonce}
                    onChange={(event) =>
                      setStartNonce(event.currentTarget.value)
                    }
                    required
                  />
                </label>
                <label>
                  Roll Count
                  <input
                    name="rollCount"
                    type="number"
                    min="1"
                    max="500"
                    step="1"
                    value={rollCount}
                    onChange={(event) =>
                      setRollCount(event.currentTarget.value)
                    }
                    required
                  />
                </label>
              </>
            )}
          </div>

          <div className="seed-row">
            <label>
              Server Seed
              <input
                name="serverSeed"
                type="text"
                value={serverSeed}
                onChange={(event) => setServerSeed(event.currentTarget.value)}
                required
              />
            </label>

            <label>
              Client Seed
              <input
                name="clientSeed"
                type="text"
                value={clientSeed}
                onChange={(event) => setClientSeed(event.currentTarget.value)}
                required
              />
            </label>

            <label>
              Original Server Seed Hash (optional)
              <input
                name="serverSeedHash"
                type="text"
                value={expectedServerSeedHash}
                onChange={(event) =>
                  setExpectedServerSeedHash(event.currentTarget.value)
                }
              />
            </label>
          </div>

          <div className="version-strip">
            <span>
              <strong>Version:</strong> {selectedVersion.label}
            </span>
            <span>
              <strong>Method:</strong> {selectedVersion.game.hashMethod}
            </span>
            <span>
              <strong>RTP:</strong> {selectedIntegrity.expectedValue.toFixed(6)}
            </span>
            <span>
              <strong>Max:</strong>{" "}
              {selectedMaxMultiplier.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              x
            </span>
          </div>

          <button type="submit">
            {mode === "single" ? "Verify Roll" : "Verify Rolls"}
          </button>
        </form>
      </section>

      {error ? (
        <section className="card">
          <div className="error">{error}</div>
        </section>
      ) : null}

      {result ? (
        <section className="card">
          <h2>Verification Result</h2>
          {result.commitmentMatches !== undefined ? (
            <p
              className={
                result.commitmentMatches
                  ? "commitment commitment-match"
                  : "commitment commitment-mismatch"
              }
            >
              Server seed commitment:{" "}
              {result.commitmentMatches ? "MATCH" : "DOES NOT MATCH"}
            </p>
          ) : null}
          <dl className="result-grid">
            <dt>Version</dt>
            <dd>{result.version}</dd>
            <dt>Nonce</dt>
            <dd>{result.nonce.toString()}</dd>
            <dt>Multiplier</dt>
            <dd>{formatMultiplier(result.multiplierX100)}</dd>
            {getProofRows(result).map(([label, value]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </Fragment>
            ))}
            <dt>Server Seed SHA-256</dt>
            <dd>{result.serverSeedHash}</dd>
          </dl>
        </section>
      ) : null}

      {batchRolls.length > 0 ? (
        <section className="card">
          <h2>Batch Rolls</h2>
          <div className="table-wrap">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Nonce</th>
                  <th>Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {batchRolls.map((row) => (
                  <tr key={row.nonce}>
                    <td>{row.nonce}</td>
                    <td>{row.multiplier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
