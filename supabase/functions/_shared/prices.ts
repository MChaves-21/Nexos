// Regras para buscar cotações dos investimentos cadastrados à mão. Módulo puro (testado com Vitest).

export const MAX_PRICED_ASSETS = 50;

const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano", XRP: "ripple", DOT: "polkadot",
  DOGE: "dogecoin", SHIB: "shiba-inu", MATIC: "polygon", LTC: "litecoin", AVAX: "avalanche-2",
  LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos", XLM: "stellar", BNB: "binancecoin",
  USDT: "tether", USDC: "usd-coin",
};

export type PriceSource =
  | { kind: "crypto"; coinId: string }
  | { kind: "yahoo"; symbol: string; inUsd: boolean };

/**
 * Onde buscar o preço de um ativo. Ticker da B3 (termina em número, ex.: PETR4, KNCR11, B3SA3) vai para a
 * Yahoo com ".SA"; outros tickers são tratados como ações dos EUA (em dólar). Nome que não parece
 * ticker (ex.: "CDB Banco X") não é buscado.
 */
export function priceSource(assetName: string, assetType: string): PriceSource | null {
  const symbol = assetName.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) return null;
  if (assetType === "Criptomoedas") return { kind: "crypto", coinId: CRYPTO_IDS[symbol] ?? symbol.toLowerCase() };
  if (/^[A-Z0-9]{3,6}\d$/.test(symbol) || assetType === "FIIs") return { kind: "yahoo", symbol: `${symbol}.SA`, inUsd: false };
  if (/^[A-Z.-]{1,6}$/.test(symbol)) return { kind: "yahoo", symbol, inUsd: true };
  return null;
}

/** Preço com até 8 casas (cripto pode valer frações de centavo). */
export function roundPrice(price: number): number {
  return Math.round(price * 1e8) / 1e8;
}

/** Vale gravar? Ignora variações menores que 0,01% (ou 1e-8 para preços minúsculos). */
export function priceChanged(oldPrice: number, newPrice: number): boolean {
  return Math.abs(newPrice - oldPrice) > Math.max(1e-8, Math.abs(oldPrice) * 1e-4);
}
