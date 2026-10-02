// Atualiza o preço atual dos investimentos cadastrados à mão (ações, FIIs e cripto).
// Usa o cliente do usuário (RLS): só lê e altera os investimentos da própria pessoa.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, getUserClient, jsonResponse } from "../_shared/http.ts";
import { MAX_PRICED_ASSETS, priceChanged, priceSource, roundPrice, type PriceSource } from "../_shared/prices.ts";

const FALLBACK_USD_BRL = 5.8;
const TIMEOUT_MS = 8_000;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function yahooPrice(symbol: string): Promise<number | null> {
  const data = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`) as
    { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> } } | null;
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return typeof price === "number" && price > 0 ? price : null;
}

async function cryptoPrice(coinId: string): Promise<number | null> {
  const data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=brl`) as
    Record<string, { brl?: number }> | null;
  const price = data?.[coinId]?.brl;
  return typeof price === "number" && price > 0 ? price : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getUserClient(req);
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);
    const { supabase } = auth;

    const { data: investments, error } = await supabase
      .from("investments")
      .select("id, asset_name, asset_type, current_price")
      .order("updated_at", { ascending: true })
      // Limite por chamada: cada ativo é uma consulta externa
      .limit(MAX_PRICED_ASSETS);
    if (error) throw error;
    if (!investments?.length) return jsonResponse({ message: "Nenhum investimento cadastrado.", updated: 0, results: [] });

    // Cotação do dólar: uma vez por chamada, só se houver ativo dos EUA
    let usdBrl: Promise<number> | null = null;
    const toBrl = (price: number, source: PriceSource) => {
      if (source.kind !== "yahoo" || !source.inUsd) return Promise.resolve(price);
      usdBrl ??= getJson("https://api.exchangerate-api.com/v4/latest/USD").then((d) => {
        const rate = (d as { rates?: { BRL?: number } } | null)?.rates?.BRL;
        return typeof rate === "number" && rate > 0 ? rate : FALLBACK_USD_BRL;
      });
      return usdBrl.then((rate) => price * rate);
    };

    const results: Array<{ symbol: string; price: number | null; error?: string }> = [];
    let updated = 0;

    for (const inv of investments) {
      const source = priceSource(inv.asset_name, inv.asset_type);
      const raw = !source ? null : source.kind === "crypto" ? await cryptoPrice(source.coinId) : await yahooPrice(source.symbol);
      if (raw === null || !source) {
        results.push({ symbol: inv.asset_name, price: null, error: "Preço não encontrado" });
        continue;
      }
      const price = roundPrice(await toBrl(raw, source));
      if (!priceChanged(Number(inv.current_price), price)) {
        results.push({ symbol: inv.asset_name, price: Number(inv.current_price) });
        continue;
      }
      const { error: updateError } = await supabase
        .from("investments")
        .update({ current_price: price, updated_at: new Date().toISOString() })
        .eq("id", inv.id);
      if (updateError) {
        results.push({ symbol: inv.asset_name, price: null, error: "Não foi possível salvar" });
      } else {
        updated++;
        results.push({ symbol: inv.asset_name, price });
      }
      // Pequena pausa para não estourar o limite das APIs gratuitas
      await new Promise((r) => setTimeout(r, 300));
    }

    return jsonResponse({ message: `${updated} de ${investments.length} investimentos atualizados.`, updated, results });
  } catch (e) {
    return errorResponse("fetch-stock-prices error", e);
  }
});
