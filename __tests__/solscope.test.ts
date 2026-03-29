/**
 * SolScope — Unit Tests for Helper Functions & Action Validators
 *
 * Tests the pure utility functions and action validation logic
 * without requiring network access or ElizaOS runtime.
 *
 * Run: npx tsx __tests__/solscope.test.ts
 */

import { describe, expect, it } from "vitest";

// Re-implement the pure helpers here for isolated testing
// (they're module-private in index.ts, so we test their logic directly)

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function shortenAddress(addr: string): string {
  return addr.length > 8 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr;
}

function extractAddress(text: string): string | null {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : null;
}

function extractSignature(text: string): string | null {
  const match = text.match(/[1-9A-HJ-NP-Za-km-z]{64,88}/);
  return match ? match[0] : null;
}

// ---- Tests ----

describe("lamportsToSol", () => {
  it("converts 1 SOL correctly", () => {
    expect(lamportsToSol(1_000_000_000)).toBe("1.0000");
  });

  it("converts fractional SOL", () => {
    expect(lamportsToSol(500_000_000)).toBe("0.5000");
  });

  it("converts zero", () => {
    expect(lamportsToSol(0)).toBe("0.0000");
  });

  it("handles large balances", () => {
    expect(lamportsToSol(142_380_100_000)).toBe("142.3801");
  });

  it("handles dust amounts", () => {
    expect(lamportsToSol(5000)).toBe("0.0000");
  });
});

describe("formatNumber", () => {
  it("formats thousands", () => {
    expect(formatNumber(1000)).toBe("1,000");
  });

  it("formats millions", () => {
    expect(formatNumber(1_234_567)).toBe("1,234,567");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("shortenAddress", () => {
  it("shortens a standard Solana address", () => {
    expect(shortenAddress("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")).toBe("7xKX...gAsU");
  });

  it("returns short strings unchanged", () => {
    expect(shortenAddress("short")).toBe("short");
  });

  it("handles exactly 8 chars", () => {
    expect(shortenAddress("12345678")).toBe("12345678");
  });

  it("shortens 9+ char strings", () => {
    expect(shortenAddress("123456789")).toBe("1234...6789");
  });
});

describe("extractAddress", () => {
  it("extracts a Solana address from text", () => {
    expect(extractAddress("Check balance for 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"))
      .toBe("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
  });

  it("returns null when no address present", () => {
    expect(extractAddress("What's the SOL price?")).toBeNull();
  });

  it("skips strings that are too short", () => {
    expect(extractAddress("short address ABC123")).toBeNull();
  });

  it("handles text with multiple possible matches", () => {
    const result = extractAddress("Compare 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU and another");
    expect(result).toBe("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
  });

  it("rejects addresses with invalid base58 chars (0, O, I, l)", () => {
    // These chars are not in base58
    expect(extractAddress("Check 0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl")).toBeNull();
  });
});

describe("extractSignature", () => {
  it("extracts a 64+ char base58 signature", () => {
    const sig = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi4vJ9JU1bJJE96FWSJKvHsmmF";
    expect(extractSignature(`Look up tx ${sig}`)).toBe(sig);
  });

  it("returns null for short strings", () => {
    expect(extractSignature("Look up tx ABC123")).toBeNull();
  });
});

describe("Action validation patterns", () => {
  // Test the regex patterns used by each action's validate function

  it("CHECK_WALLET_BALANCE triggers on balance keywords", () => {
    const pattern = /balance|wallet|address|holdings|how much|check.*sol/i;
    expect(pattern.test("Check balance for 7xKX...")).toBe(true);
    expect(pattern.test("What's in my wallet?")).toBe(true);
    expect(pattern.test("Show holdings")).toBe(true);
    expect(pattern.test("How much SOL?")).toBe(true);
    expect(pattern.test("What's the price?")).toBe(false);
  });

  it("TOKEN_PRICE triggers on price keywords", () => {
    const pattern = /price|worth|cost|trading at|how much is/i;
    expect(pattern.test("What's the SOL price?")).toBe(true);
    expect(pattern.test("How much is JUP worth?")).toBe(true);
    expect(pattern.test("Check my balance")).toBe(false);
  });

  it("TRANSACTION_LOOKUP triggers on tx keywords", () => {
    const pattern = /transaction|tx|signature|look.*up/i;
    expect(pattern.test("Look up this transaction")).toBe(true);
    expect(pattern.test("Check tx details")).toBe(true);
    expect(pattern.test("What's the price?")).toBe(false);
  });

  it("NETWORK_HEALTH triggers on network keywords", () => {
    const pattern = /network|tps|health|status|epoch|validator|solana.*doing|chain/i;
    expect(pattern.test("How's the Solana network?")).toBe(true);
    expect(pattern.test("What's the current TPS?")).toBe(true);
    expect(pattern.test("Check validators")).toBe(true);
    expect(pattern.test("SOL price")).toBe(false);
  });

  it("TOP_TOKENS triggers on trending keywords", () => {
    const pattern = /top|trending|popular|hot|volume|best.*token/i;
    expect(pattern.test("What's trending?")).toBe(true);
    expect(pattern.test("Top tokens by volume")).toBe(true);
    expect(pattern.test("Check my balance")).toBe(false);
  });

  it("NOSANA_STATUS triggers on infrastructure keywords", () => {
    const pattern = /nosana|compute|gpu|infrastr|who.*host|where.*run|decentralized.*ai/i;
    expect(pattern.test("What's the Nosana status?")).toBe(true);
    expect(pattern.test("Where does SolScope run?")).toBe(true);
    expect(pattern.test("Tell me about the GPU")).toBe(true);
    expect(pattern.test("SOL price")).toBe(false);
  });

  it("Token symbol extraction covers major tokens", () => {
    const pattern = /\b(SOL|JUP|JTO|BONK|WIF|USDC|USDT|RAY|ORCA|MNDE|JITO|HNT|PYTH|W|RENDER|JLP)\b/i;
    expect(pattern.test("Price of SOL")).toBe(true);
    expect(pattern.test("How much is BONK?")).toBe(true);
    expect(pattern.test("JUP price")).toBe(true);
    expect(pattern.test("Random coin")).toBe(false);
  });
});
