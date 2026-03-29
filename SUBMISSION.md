# SolScope — Submission Materials

## Agent Description (300 words max — for SuperTeam submission)

SolScope is a Solana blockchain intelligence agent that delivers real-time on-chain data through natural conversation. Built on ElizaOS v2 and deployed entirely on Nosana's decentralized GPU network, it provides the same market intelligence that traders typically pay $50–200/month for through tools like Birdeye or Solscan Pro — except it's free, open-source, and fully decentralized.

**What it does:**

SolScope provides six live data actions, all hitting the blockchain directly — no caching, no stale feeds:

- **Wallet Lookup** — SOL balance, token holdings, and Solscan links for any Solana address
- **Token Prices** — Real-time pricing via Jupiter aggregator for SOL and all SPL tokens
- **Transaction Decoder** — Full breakdown of any transaction: signer, fee, status, balance changes
- **Network Health** — Live TPS, epoch progress, validator count, and delinquency monitoring
- **Trending Tokens** — Top Solana pairs ranked by 24h trading volume via DexScreener
- **Infrastructure Status** — Self-monitoring of the Nosana compute endpoint, Solana RPC health, and agent runtime metrics

**Technical highlights:**

The custom `solscope` plugin implements production-grade reliability with retry logic (exponential backoff), request timeouts on all external API calls, and structured error handling. The Dockerfile includes a native HEALTHCHECK for Nosana's orchestration layer, frozen lockfile installs for reproducible builds, and proper layer caching. 26 unit tests validate all utility functions and action validation patterns.

**Why it matters:**

Most AI agents are chatbots with a personality file. SolScope has real utility — it's a free, decentralized alternative to expensive blockchain analytics platforms. It doesn't just deploy on Nosana; it integrates Nosana into its intelligence through the NOSANA_STATUS action, which reports the health of its own decentralized compute infrastructure in real time.

The Bloomberg Terminal of Solana — powered by Nosana, built with ElizaOS.

---

## Social Media Post (for X/Twitter)

Built SolScope — a free Solana blockchain intelligence agent running 100% on decentralized infrastructure.

6 live on-chain actions: wallet lookup, token prices, tx decoder, network health, trending pairs, and self-monitoring infrastructure status.

No centralized cloud. No stale data. Just real-time blockchain intelligence.

Built with @elizaos on @nosana_ai GPU network.

🔗 github.com/TheTroll88/agent-challenge

#NosanaAgentChallenge #Solana #ElizaOS #DecentralizedAI
