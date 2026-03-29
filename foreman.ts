/**
 * Foreman — SolScope self-service deployment pipeline
 *
 * Generates its own Solana keypair, authenticates with Nosana via wallet signing,
 * creates a vault, and deploys the SolScope container. Fully autonomous.
 *
 * Usage:
 *   npx tsx foreman.ts
 *
 * If NOSANA_API_KEY is set, uses that instead (simpler path).
 * Otherwise, uses wallet authentication (keypair-based, no dashboard needed).
 */

import { createNosanaClient, NosanaNetwork } from "@nosana/kit";
import { generateKeyPairSigner, createKeyPairFromBytes } from "@solana/kit";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ──
const WALLET_PATH = path.join(__dirname, ".foreman", "wallet.json");
const STATE_PATH = path.join(__dirname, ".foreman", "state.json");
const GPU_MARKET = "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq"; // NVIDIA 3060 — cheapest

const JOB_DEFINITION = {
  version: "0.1",
  type: "container",
  meta: { trigger: "api" },
  ops: [
    {
      type: "container/run",
      id: "solscope-agent",
      args: {
        image: "docker.io/thetroll888/solscope:latest",
        expose: 3000,
        env: {
          OPENAI_API_KEY: "nosana",
          OPENAI_BASE_URL:
            "https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1",
          SMALL_MODEL: "Qwen3.5-27B-AWQ-4bit",
          LARGE_MODEL: "Qwen3.5-27B-AWQ-4bit",
          MODEL_NAME: "Qwen3.5-27B-AWQ-4bit",
          SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
          SERVER_PORT: "3000",
          NODE_ENV: "production",
        },
      },
    },
  ],
};

// ── Helpers ──
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadState(): Record<string, unknown> {
  if (fs.existsSync(STATE_PATH)) {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  }
  return {};
}

function saveState(state: Record<string, unknown>) {
  ensureDir(path.dirname(STATE_PATH));
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ── Wallet Management ──
async function getOrCreateWallet(): Promise<{ publicKey: string; keypairBytes: Uint8Array }> {
  ensureDir(path.dirname(WALLET_PATH));

  if (fs.existsSync(WALLET_PATH)) {
    const data = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
    const kp = Keypair.fromSecretKey(Uint8Array.from(data));
    log(`Wallet loaded: ${kp.publicKey.toBase58()}`);
    return { publicKey: kp.publicKey.toBase58(), keypairBytes: kp.secretKey };
  }

  // Generate new keypair
  const kp = Keypair.generate();
  fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(kp.secretKey)));
  log(`New wallet generated: ${kp.publicKey.toBase58()}`);
  log(`IMPORTANT: Fund this wallet with SOL + NOS on mainnet for deployment`);
  return { publicKey: kp.publicKey.toBase58(), keypairBytes: kp.secretKey };
}

// ── API Key Path (if available) ──
async function deployWithApiKey(apiKey: string) {
  log("Using API key authentication...");

  const client = createNosanaClient(NosanaNetwork.MAINNET, {
    api: { apiKey },
  });

  log("Creating deployment...");
  const deployment = await (client as any).api.deployments.create({
    name: "SolScope",
    market: GPU_MARKET,
    timeout: 60,
    replicas: 1,
    strategy: "SIMPLE",
    job_definition: JOB_DEFINITION,
  });

  log(`Deployment created: ${deployment.id}`);

  const dep = await (client as any).deployments.get(deployment.id);
  log("Starting deployment...");
  await dep.start();

  saveState({
    ...loadState(),
    deploymentId: deployment.id,
    method: "api-key",
    deployedAt: new Date().toISOString(),
    status: "started",
  });

  log(`DEPLOYED: ${deployment.id}`);
  log(`Dashboard: https://deploy.nosana.com/deployments/${deployment.id}`);
  return deployment.id;
}

// ── Wallet Auth Path ──
async function deployWithWallet() {
  log("Using wallet authentication (keypair)...");

  const { publicKey, keypairBytes } = await getOrCreateWallet();

  // Create client with keypair wallet
  const signer = await createKeyPairFromBytes(keypairBytes);
  const client = createNosanaClient(NosanaNetwork.MAINNET, {
    wallet: signer as any,
  });

  // Check if we can list vaults (tests auth)
  log("Testing wallet authentication...");
  try {
    const vaults = await (client as any).deployments.vaults.list();
    log(`Auth OK — ${vaults.length} existing vaults`);
  } catch (err: any) {
    if (err.message?.includes("insufficient") || err.message?.includes("balance")) {
      log(`Auth works but wallet needs funding: ${publicKey}`);
      log("Fund with SOL + NOS tokens on Solana mainnet, then re-run.");
    } else {
      log(`Auth test: ${err.message || err}`);
    }
  }

  log("Creating deployment with vault...");
  try {
    const deployment = await (client as any).deployments.create({
      name: "SolScope",
      market: GPU_MARKET,
      replicas: 1,
      timeout: 60,
      strategy: "SIMPLE",
      job_definition: JOB_DEFINITION,
    });

    log(`Deployment created: ${deployment.id}`);
    log(`Vault: ${deployment.vault?.address || "pending"}`);

    // If vault exists, try to start
    if (deployment.vault?.address) {
      const balance = await deployment.vault.getBalance();
      log(`Vault balance — SOL: ${balance.SOL}, NOS: ${balance.NOS}`);

      if (balance.SOL > 0 || balance.NOS > 0) {
        log("Vault funded — starting deployment...");
        await deployment.start();
        log("DEPLOYMENT STARTED");
      } else {
        log(`Vault needs funding: ${deployment.vault.address}`);
        log("Send SOL or NOS to the vault address, then re-run with --start");
      }
    }

    saveState({
      ...loadState(),
      deploymentId: deployment.id,
      vaultAddress: deployment.vault?.address,
      walletPublicKey: publicKey,
      method: "wallet",
      deployedAt: new Date().toISOString(),
      status: "created",
    });

    return deployment.id;
  } catch (err: any) {
    log(`Deploy error: ${err.message || err}`);
    saveState({
      ...loadState(),
      walletPublicKey: publicKey,
      lastError: err.message || String(err),
      lastAttempt: new Date().toISOString(),
    });
    throw err;
  }
}

// ── Direct HTTP Auth (fallback) ──
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { publicKey, keypairBytes } = await getOrCreateWallet();
  const kp = Keypair.fromSecretKey(keypairBytes);
  const nacl = await import("tweetnacl");
  const msgBytes = new TextEncoder().encode("NosanaApiAuthentication");
  const signature = nacl.default.sign.detached(msgBytes, kp.secretKey);
  return {
    "Authorization": `NosanaApiAuthentication:${bs58.encode(signature)}`,
    "x-user-id": publicKey,
    "Content-Type": "application/json",
  };
}

const API_BASE = "https://dashboard.k8s.prd.nos.ci/api";

async function apiGet(endpoint: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function apiPost(endpoint: string, body?: unknown) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  log(`POST ${endpoint}: HTTP ${res.status}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function probeApi() {
  log("Probing Nosana API...");

  // Markets (public, no auth)
  try {
    const res = await fetch(`${API_BASE}/markets`);
    const markets = await res.json() as any[];
    log(`Markets: ${markets.length} GPU markets available`);
    const sorted = markets
      .filter((m: any) => m.nos_job_price_per_second > 0)
      .sort((a: any, b: any) => a.nos_job_price_per_second - b.nos_job_price_per_second);
    if (sorted[0]) {
      const usdHr = sorted[0].usd_reward_per_hour;
      log(`Cheapest: ${sorted[0].name} @ $${usdHr}/hr`);
    }
  } catch (err: any) {
    log(`Markets probe failed: ${err.message}`);
  }

  // Authenticated endpoints
  try {
    const deployments = await apiGet("/deployments");
    const list = deployments.deployments || deployments;
    log(`Deployments: ${Array.isArray(list) ? list.length : 0}`);
  } catch (err: any) {
    log(`Deployments probe: ${err.message}`);
  }

  try {
    const vaults = await apiGet("/deployments/vaults");
    log(`Vaults: ${Array.isArray(vaults) ? vaults.length : 0}`);
    if (Array.isArray(vaults) && vaults.length > 0) {
      for (const v of vaults) {
        log(`  Vault: ${v.vault}`);
      }
    }
  } catch (err: any) {
    log(`Vaults probe: ${err.message}`);
  }
}

async function createAndDeploy() {
  log("Creating vault + deployment...");

  // Step 1: Check existing vaults
  let vault: string | undefined;
  try {
    const existingVaults = await apiGet("/deployments/vaults") as any[];
    if (existingVaults.length > 0) {
      vault = existingVaults[0].vault;
      log(`Using existing vault: ${vault}`);
    } else {
      log("No vaults found — will let deployment API create one.");
    }
  } catch (err: any) {
    log(`Vault check: ${err.message}`);
  }

  // Step 2: Create deployment (vault is optional — API may auto-create)
  try {
    const deployBody: Record<string, unknown> = {
      name: "SolScope",
      market: GPU_MARKET,
      replicas: 1,
      timeout: 60,
      strategy: "SIMPLE",
      job_definition: JOB_DEFINITION,
    };
    if (vault) deployBody.vault = vault;

    const deployment = await apiPost("/deployments/create", deployBody);

    const depId = deployment.id || deployment.deployment;
    log(`Deployment created: ${depId}`);
    log(`Status: ${deployment.status}`);
    if (deployment.vault) log(`Vault: ${deployment.vault}`);

    if (deployment.endpoints?.length) {
      for (const ep of deployment.endpoints) {
        log(`Endpoint: ${ep.url} (port ${ep.port})`);
      }
    }

    saveState({
      ...loadState(),
      deploymentId: depId,
      vaultAddress: deployment.vault || vault,
      status: deployment.status,
      method: "wallet-http",
      deployedAt: new Date().toISOString(),
    });

    // Step 3: Try to start if in DRAFT
    if (deployment.status === "DRAFT") {
      log("Deployment is in DRAFT — attempting start...");
      try {
        const startResult = await apiPost(`/deployments/${depId}/start`);
        log(`Start result: ${startResult.status}`);
        saveState({ ...loadState(), status: startResult.status });
      } catch (err: any) {
        log(`Start failed: ${err.message}`);
        log("Vault likely needs SOL/NOS funding before deployment can start.");
        const { publicKey } = await getOrCreateWallet();
        log(`Fund the vault or wallet (${publicKey}) with SOL + NOS on mainnet.`);
      }
    }

    return depId;
  } catch (err: any) {
    log(`Deploy failed: ${err.message}`);
    throw err;
  }
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "deploy";

  log("=== Foreman — SolScope Deployment Pipeline ===");

  switch (command) {
    case "probe":
      await probeApi();
      break;

    case "wallet":
      await getOrCreateWallet();
      break;

    case "create":
      await createAndDeploy();
      break;

    case "status": {
      const state = loadState();
      console.log(JSON.stringify(state, null, 2));
      break;
    }

    case "deploy":
    default: {
      // Try API key first, then HTTP wallet auth
      const apiKey = process.env.NOSANA_API_KEY;
      if (apiKey) {
        await deployWithApiKey(apiKey);
      } else {
        log("No NOSANA_API_KEY — using wallet HTTP auth...");
        try {
          await createAndDeploy();
        } catch {
          log("Deploy failed — running diagnostics...");
          await probeApi();
        }
      }
      break;
    }
  }
}

main().catch((err) => {
  log(`FATAL: ${err.message || err}`);
  process.exit(1);
});
