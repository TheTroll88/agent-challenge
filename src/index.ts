/**
 * SolScope — Solana DeFi Intelligence Plugin
 * Custom actions for real-time blockchain data queries
 */

import { type Action, type HandlerCallback, type HandlerOptions, type IAgentRuntime, type Memory, type Plugin, type State } from "@elizaos/core";

// --- Solana RPC Helper ---
async function solanaRpc(method: string, params: unknown[] = []): Promise<unknown> {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// --- Jupiter Price API Helper ---
async function getTokenPrice(symbol: string): Promise<{ price: number; symbol: string } | null> {
  try {
    const ids = symbol.toUpperCase() === "SOL" ? "So11111111111111111111111111111111111111112" : symbol;
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`);
    const json = (await res.json()) as { data?: Record<string, { price: string; mintSymbol?: string }> };
    if (json.data) {
      const entry = Object.values(json.data)[0];
      if (entry) return { price: parseFloat(entry.price), symbol: entry.mintSymbol || symbol };
    }
  } catch { /* fall through */ }
  return null;
}

// --- Utility ---
function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function shortenAddress(addr: string): string {
  return addr.length > 8 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}

// Extract a Solana address (base58, 32-44 chars) from text
function extractAddress(text: string): string | null {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : null;
}

// Extract a transaction signature (base58, 64-88 chars)
function extractSignature(text: string): string | null {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{64,88}/);
  return match ? match[0] : null;
}

// =================================================================
// ACTION: Check Wallet Balance
// =================================================================
const checkWalletBalance: Action = {
  name: "CHECK_WALLET_BALANCE",
  description: "Look up the SOL balance and token holdings of a Solana wallet address",
  similes: ["WALLET_BALANCE", "CHECK_BALANCE", "BALANCE", "WALLET_LOOKUP", "HOW_MUCH_SOL"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text || "";
    return /balance|wallet|address|holdings|how much|check.*sol/i.test(text) && !!extractAddress(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback
  ) => {
    if (!callback) return;
    const addr = extractAddress(message.content?.text || "");
    if (!addr) {
      await callback({ text: "I need a Solana wallet address to check. Paste one and I'll look it up." });
      return;
    }

    try {
      const balResult = await solanaRpc("getBalance", [addr]) as { value: number };
      const solBalance = lamportsToSol(balResult.value);
      const priceData = await getTokenPrice("SOL");
      const usdValue = priceData ? `(~$${formatNumber(Math.round(priceData.price * parseFloat(solBalance)))})` : "";

      // Get token accounts
      const tokenResult = await solanaRpc("getTokenAccountsByOwner", [
        addr,
        { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { encoding: "jsonParsed" },
      ]) as { value: Array<{ account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number; decimals: number } } } } } }> };

      const tokens = tokenResult.value
        .map((t) => t.account.data.parsed.info)
        .filter((t) => t.tokenAmount.uiAmount > 0)
        .slice(0, 10);

      let tokenSummary = "";
      if (tokens.length > 0) {
        tokenSummary = `\n\nToken accounts (${tokens.length} with balance):\n` +
          tokens.map((t) => `• ${shortenAddress(t.mint)}: ${formatNumber(t.tokenAmount.uiAmount)}`).join("\n");
      }

      await callback({
        text: `**Wallet ${shortenAddress(addr)}**\n\nSOL Balance: ${solBalance} SOL ${usdValue}${tokenSummary}\n\n🔗 [View on Solscan](https://solscan.io/account/${addr})`,
      });
    } catch (err) {
      await callback({ text: `Failed to fetch wallet data: ${(err as Error).message}. Double-check the address and try again.` });
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "Check balance for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" } },
      { name: "SolScope", content: { text: "Wallet 7xKX...AsU holds 142.3801 SOL (~$26,682) with 3 token accounts." } },
    ],
  ],
};

// =================================================================
// ACTION: Token Price Lookup
// =================================================================
const tokenPriceLookup: Action = {
  name: "TOKEN_PRICE",
  description: "Get the current price of SOL or any Solana token via Jupiter",
  similes: ["PRICE", "SOL_PRICE", "TOKEN_PRICE", "HOW_MUCH_IS", "PRICE_CHECK", "WHAT_IS_PRICE"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text || "";
    return /price|worth|cost|trading at|how much is/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback
  ) => {
    if (!callback) return;
    const text = message.content?.text || "";

    // Try to extract token symbol or mint address
    let query = "SOL";
    const symbolMatch = text.match(/\b(SOL|JUP|JTO|BONK|WIF|USDC|USDT|RAY|ORCA|MNDE|JITO|HNT|PYTH|W|RENDER|JLP)\b/i);
    if (symbolMatch) {
      query = symbolMatch[1].toUpperCase();
    } else {
      const mintAddr = extractAddress(text);
      if (mintAddr) query = mintAddr;
    }

    // SOL uses the wrapped SOL mint
    const mintId = query === "SOL" ? "So11111111111111111111111111111111111111112" : query;

    try {
      const res = await fetch(`https://api.jup.ag/price/v2?ids=${mintId}`);
      const json = (await res.json()) as { data?: Record<string, { price: string }> };

      if (json.data) {
        const entry = Object.values(json.data)[0];
        if (entry) {
          const price = parseFloat(entry.price);
          await callback({
            text: `**${query}** is currently trading at **$${price < 0.01 ? price.toPrecision(4) : formatNumber(Math.round(price * 100) / 100)}**\n\n🔗 [View on DexScreener](https://dexscreener.com/solana/${mintId})`,
          });
          return;
        }
      }
      await callback({ text: `Couldn't find price data for ${query}. Try using the token's mint address instead.` });
    } catch (err) {
      await callback({ text: `Price lookup failed: ${(err as Error).message}` });
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "What's the SOL price?" } },
      { name: "SolScope", content: { text: "SOL is currently trading at $187.42" } },
    ],
  ],
};

// =================================================================
// ACTION: Transaction Lookup
// =================================================================
const transactionLookup: Action = {
  name: "TRANSACTION_LOOKUP",
  description: "Look up details of a Solana transaction by its signature",
  similes: ["TX_LOOKUP", "TRANSACTION", "CHECK_TX", "LOOKUP_TX", "TX_DETAILS"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text || "";
    return /transaction|tx|signature|look.*up/i.test(text) && !!extractSignature(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback
  ) => {
    if (!callback) return;
    const sig = extractSignature(message.content?.text || "");
    if (!sig) {
      await callback({ text: "I need a transaction signature to look up. Paste one and I'll fetch the details." });
      return;
    }

    try {
      const tx = await solanaRpc("getTransaction", [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]) as {
        slot: number;
        blockTime: number;
        meta: { fee: number; err: unknown; preBalances: number[]; postBalances: number[] };
        transaction: { message: { accountKeys: Array<{ pubkey: string }>; instructions: unknown[] } };
      } | null;

      if (!tx) {
        await callback({ text: `Transaction not found. It may be too old or on a different network. Signature: ${shortenAddress(sig)}` });
        return;
      }

      const date = new Date(tx.blockTime * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
      const fee = lamportsToSol(tx.meta.fee);
      const status = tx.meta.err ? "❌ Failed" : "✅ Confirmed";
      const signer = tx.transaction.message.accountKeys[0]?.pubkey || "unknown";
      const balChange = lamportsToSol(tx.meta.postBalances[0] - tx.meta.preBalances[0]);

      await callback({
        text: `**Transaction ${shortenAddress(sig)}**\n\n` +
          `Status: ${status}\n` +
          `Slot: ${formatNumber(tx.slot)}\n` +
          `Time: ${date}\n` +
          `Signer: ${shortenAddress(signer)}\n` +
          `Fee: ${fee} SOL\n` +
          `Balance change (signer): ${balChange} SOL\n` +
          `Instructions: ${tx.transaction.message.instructions.length}\n\n` +
          `🔗 [View on Solscan](https://solscan.io/tx/${sig})`,
      });
    } catch (err) {
      await callback({ text: `Transaction lookup failed: ${(err as Error).message}` });
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "Look up tx 4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi" } },
      { name: "SolScope", content: { text: "Transaction 4vJ9...bkLKi: Confirmed in slot 245,892,103. Signer: 7xKX...AsU. Fee: 0.0000 SOL." } },
    ],
  ],
};

// =================================================================
// ACTION: Network Health / Stats
// =================================================================
const networkHealth: Action = {
  name: "NETWORK_HEALTH",
  description: "Get current Solana network health metrics: TPS, slot, epoch, validator count",
  similes: ["NETWORK_STATUS", "SOLANA_STATUS", "TPS", "NETWORK_HEALTH", "HOW_IS_SOLANA", "CHAIN_STATUS"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text || "";
    return /network|tps|health|status|epoch|validator|solana.*doing|chain/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback
  ) => {
    if (!callback) return;
    try {
      const [perfSamples, epochInfo, voteAccounts] = await Promise.all([
        solanaRpc("getRecentPerformanceSamples", [1]) as Promise<Array<{ numTransactions: number; samplePeriodSecs: number; numSlots: number }>>,
        solanaRpc("getEpochInfo") as Promise<{ epoch: number; slotIndex: number; slotsInEpoch: number; absoluteSlot: number }>,
        solanaRpc("getVoteAccounts") as Promise<{ current: unknown[]; delinquent: unknown[] }>,
      ]);

      const sample = perfSamples[0];
      const tps = sample ? Math.round(sample.numTransactions / sample.samplePeriodSecs) : 0;
      const epochProgress = ((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(1);
      const activeValidators = voteAccounts.current.length;
      const delinquent = voteAccounts.delinquent.length;

      await callback({
        text: `**Solana Network Status**\n\n` +
          `⚡ TPS: ${formatNumber(tps)}\n` +
          `📦 Current Slot: ${formatNumber(epochInfo.absoluteSlot)}\n` +
          `🔄 Epoch: ${epochInfo.epoch} (${epochProgress}% complete)\n` +
          `✅ Active Validators: ${formatNumber(activeValidators)}\n` +
          `⚠️ Delinquent: ${delinquent}\n\n` +
          `Network is ${delinquent < 50 ? "healthy ✅" : "experiencing issues ⚠️"}`,
      });
    } catch (err) {
      await callback({ text: `Network health check failed: ${(err as Error).message}` });
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "How's the Solana network doing?" } },
      { name: "SolScope", content: { text: "Solana Network: TPS 3,847 | Epoch 612 (78% complete) | 1,847 validators | Network healthy ✅" } },
    ],
  ],
};

// =================================================================
// ACTION: Top Tokens by Volume
// =================================================================
const topTokens: Action = {
  name: "TOP_TOKENS",
  description: "Show trending or top tokens on Solana by trading volume",
  similes: ["TRENDING", "TOP_PAIRS", "POPULAR_TOKENS", "WHATS_HOT", "VOLUME"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text || "";
    return /top|trending|popular|hot|volume|best.*token/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: HandlerOptions,
    callback?: HandlerCallback
  ) => {
    if (!callback) return;
    try {
      const res = await fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
      const json = (await res.json()) as { pairs?: Array<{ baseToken: { symbol: string }; quoteToken: { symbol: string }; priceUsd: string; volume: { h24: number }; priceChange: { h24: number }; dexId: string }> };

      if (!json.pairs || json.pairs.length === 0) {
        await callback({ text: "Couldn't fetch trending pairs right now. Try again in a moment." });
        return;
      }

      const top = json.pairs
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 8);

      const lines = top.map((p, i) => {
        const vol = p.volume?.h24 ? `$${formatNumber(Math.round(p.volume.h24))}` : "N/A";
        const change = p.priceChange?.h24 ? `${p.priceChange.h24 > 0 ? "+" : ""}${p.priceChange.h24.toFixed(1)}%` : "";
        return `${i + 1}. **${p.baseToken.symbol}/${p.quoteToken.symbol}** — $${parseFloat(p.priceUsd).toFixed(4)} | Vol: ${vol} | ${change} | ${p.dexId}`;
      });

      await callback({
        text: `**Top Solana Pairs by 24h Volume**\n\n${lines.join("\n")}\n\n🔗 [View all on DexScreener](https://dexscreener.com/solana)`,
      });
    } catch (err) {
      await callback({ text: `Failed to fetch trending tokens: ${(err as Error).message}` });
    }
  },
  examples: [
    [
      { name: "{{user1}}", content: { text: "What's trending on Solana?" } },
      { name: "SolScope", content: { text: "Top Solana pairs by 24h volume: 1. SOL/USDC $892M 2. JUP/USDC $124M..." } },
    ],
  ],
};

// =================================================================
// PLUGIN EXPORT
// =================================================================
export const solscopePlugin: Plugin = {
  name: "solscope",
  description: "Solana blockchain intelligence — wallet balances, token prices, transactions, network health, trending tokens",
  actions: [checkWalletBalance, tokenPriceLookup, transactionLookup, networkHealth, topTokens],
  providers: [],
  evaluators: [],
};

export default solscopePlugin;
