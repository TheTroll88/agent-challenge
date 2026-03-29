/**
 * SolScope — One-command Nosana deployment
 *
 * Usage:
 *   NOSANA_API_KEY=nos_xxx npx tsx deploy.ts
 *
 * Prerequisites:
 *   1. Create account at deploy.nosana.com
 *   2. Claim builder credits at nosana.com/builders-credits
 *   3. Generate API key from deploy.nosana.com → Account → API Keys
 *   4. Docker image pushed: docker.io/thetroll888/solscope:latest
 */

import { createNosanaClient } from "@nosana/kit";

const API_KEY = process.env.NOSANA_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set NOSANA_API_KEY environment variable");
  console.error("  Get one at: deploy.nosana.com → Account → API Keys");
  process.exit(1);
}

// NVIDIA 3060 — cheapest market, plenty for a text-based agent
const GPU_MARKET = "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq";

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

async function deploy() {
  console.log("Connecting to Nosana...");

  const client = createNosanaClient("mainnet", {
    api: { apiKey: API_KEY },
  });

  console.log("Creating deployment...");
  const deployment = await (client as any).api.deployments.create({
    name: "SolScope",
    market: GPU_MARKET,
    timeout: 60,
    replicas: 1,
    strategy: "SIMPLE",
    job_definition: JOB_DEFINITION,
  });

  console.log(`Deployment created: ${deployment.id}`);
  console.log("Starting deployment...");

  const dep = await (client as any).deployments.get(deployment.id);
  await dep.start();

  console.log("\n=== DEPLOYMENT STARTED ===");
  console.log(`ID: ${deployment.id}`);
  console.log(`Dashboard: https://deploy.nosana.com/deployments/${deployment.id}`);
  console.log("\nWait for the endpoint URL to appear in the dashboard.");
  console.log("Once live, that URL is your submission deployment link.");
}

deploy().catch((err) => {
  console.error("Deploy failed:", err.message || err);
  process.exit(1);
});
