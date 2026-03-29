# ⚡ SolScope — Solana Blockchain Intelligence Agent

**Real-time on-chain data at your fingertips, powered by decentralized AI.**

SolScope is a Solana blockchain intelligence agent built on [ElizaOS v2](https://elizaos.com) and deployed on [Nosana's](https://nosana.com) decentralized GPU network. It fetches live data directly from the Solana blockchain — no cached feeds, no third-party dashboards, no trust required.

> Built for the [Nosana x ElizaOS Builders Challenge](https://nosana.com/blog/builders-challenge-elizaos/)

---

## What It Does

| Capability | Description |
|---|---|
| 👛 **Wallet Lookup** | Balance, token holdings, and explorer links for any Solana address |
| 💰 **Token Prices** | Real-time prices via Jupiter aggregator for SOL and all SPL tokens |
| 🔍 **Transaction Details** | Decode any transaction: signer, fee, status, balance changes, slot |
| 📊 **Network Health** | Live TPS, epoch progress, validator count, delinquency status |
| 🔥 **Trending Tokens** | Top Solana pairs by 24h volume via DexScreener |
| 🖥️ **Nosana Status** | Live infrastructure health: compute endpoint, RPC, uptime, memory |

Every query hits the actual blockchain. No stale data.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Web UI     │────▶│  ElizaOS Agent   │────▶│ Solana Mainnet    │
│  (HTML/JS)   │     │  + SolScope      │     │ JSON-RPC          │
└──────────────┘     │    Plugin        │     └───────────────────┘
                     │                  │
                     │  Qwen3.5-27B     │────▶ Jupiter Price API
                     │  (Nosana GPU)    │────▶ DexScreener API
                     └──────────────────┘
                           │
                     ┌─────┴─────────┐
                     │  Nosana GPU   │
                     │  Network      │──── Self-monitoring
                     └───────────────┘     (health checks)
```

### Tech Stack
- **Framework:** ElizaOS v2 (TypeScript)
- **Model:** Qwen3.5-27B-AWQ-4bit via Nosana inference endpoint
- **Compute:** Nosana decentralized GPU network
- **Data Sources:** Solana RPC, Jupiter v2, DexScreener
- **Frontend:** Custom single-page web UI

---

## Custom Plugin: `solscope`

The core of SolScope is a custom ElizaOS plugin (`src/index.ts`) that provides 6 blockchain-native actions:

| Action | Trigger Keywords | Data Source |
|---|---|---|
| `CHECK_WALLET_BALANCE` | wallet, balance, address, holdings | Solana RPC (`getBalance`, `getTokenAccountsByOwner`) |
| `TOKEN_PRICE` | price, worth, cost, trading at | Jupiter Price API v2 |
| `TRANSACTION_LOOKUP` | transaction, tx, signature | Solana RPC (`getTransaction`) |
| `NETWORK_HEALTH` | network, tps, health, epoch, validators | Solana RPC (`getRecentPerformanceSamples`, `getEpochInfo`, `getVoteAccounts`) |
| `TOP_TOKENS` | trending, top, popular, volume | DexScreener API |
| `NOSANA_STATUS` | nosana, compute, gpu, infrastructure | Nosana endpoint + Solana RPC (`getHealth`) |

Each action:
- Validates user intent via regex pattern matching
- Fetches live data from the appropriate API
- Formats results with human-readable numbers, short addresses, and explorer links

---

## Quick Start

### Prerequisites
- Node.js 23+
- pnpm (`npm install -g pnpm`)

### Run Locally
```bash
# Clone
git clone https://github.com/TheTroll88/nosana-agent-challenge.git
cd nosana-agent-challenge

# Configure
cp .env.example .env
# Edit .env with your Nosana endpoint (or use defaults)

# Install & run
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to interact with SolScope.

### Run Tests
```bash
pnpm test
```

26 unit tests covering utility functions, address extraction, and action validation patterns.

---

## Deploy to Nosana

### 1. Build Docker Image
```bash
docker build -t yourusername/solscope:latest .
docker push yourusername/solscope:latest
```

### 2. Deploy via Nosana Dashboard
1. Visit [deploy.nosana.com](https://deploy.nosana.com)
2. Paste the job definition from `nos_job_def/nosana_eliza_job_definition.json`
3. Select a GPU market (nvidia-3090 recommended)
4. Deploy — your agent gets a public URL

---

## Project Structure

```
nosana-agent-challenge/
├── characters/
│   └── agent.character.json   # SolScope personality & config
├── src/
│   └── index.ts               # Custom solscope plugin (6 actions)
├── __tests__/
│   └── solscope.test.ts       # Unit tests (26 tests)
├── assets/
│   └── index.html             # Web UI frontend
├── nos_job_def/
│   └── nosana_eliza_job_definition.json  # Nosana deployment config
├── Dockerfile                 # Production container (multi-stage, healthcheck)
├── .dockerignore              # Lean image builds
├── .env.example               # Environment template
├── vitest.config.ts           # Test configuration
├── package.json               # Dependencies & scripts
└── pnpm-lock.yaml             # Reproducible installs
```

---

## Why SolScope?

Most AI agents are generic chatbots with a personality file. SolScope has **real utility** — it provides the same on-chain data that traders pay $50-200/month for through tools like Birdeye, Step Finance, or Solscan Pro. Except it runs on decentralized infrastructure, responds in natural language, and costs nothing.

### Nosana Integration Depth

SolScope doesn't just deploy on Nosana — it integrates Nosana into its intelligence:

- **Self-monitoring**: The `NOSANA_STATUS` action reports real-time health of the Nosana compute endpoint, model availability, Solana RPC status, and agent runtime metrics
- **Docker HEALTHCHECK**: Container-native health monitoring for Nosana's orchestration layer
- **Resilient networking**: All API calls use retry logic with exponential backoff and timeouts — essential for decentralized infrastructure where nodes may rotate
- **Production Dockerfile**: Multi-stage build with proper layer caching, security hardening, and lean image size
- **Zero centralized dependencies**: No AWS, no GCP — fully decentralized compute via Nosana GPU network

The Bloomberg Terminal of Solana — free, open, and decentralized.

---

## Built With

- [ElizaOS](https://elizaos.com) — AI agent framework
- [Nosana](https://nosana.com) — Decentralized GPU compute
- [Qwen3.5-27B](https://huggingface.co/Qwen) — Open-source LLM
- [Jupiter](https://jup.ag) — Solana price data
- [DexScreener](https://dexscreener.com) — DEX analytics
- [Solana JSON-RPC](https://solana.com/docs/rpc) — On-chain data

---

## Author

**Nathaniel Crigger** — [GitHub](https://github.com/TheTroll88)

## License

MIT
