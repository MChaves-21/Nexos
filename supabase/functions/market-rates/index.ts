// Taxas de referência (Selic, CDI e IPCA 12 meses) da API pública do Banco Central (SGS).
// Sem dados do usuário. Guarda em memória por 6 horas e cai para valores de reserva se a API falhar.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const SERIES = { selic: 432, cdi: 4389, ipca: 13522 } as const;
// Reserva aproximada caso a API do BCB esteja fora do ar
const FALLBACK = { selic: 15, cdi: 14.9, ipca: 5 };
const TTL_MS = 6 * 60 * 60 * 1000;

let cache: { at: number; body: Record<string, unknown> } | null = null;

async function lastValue(series: number): Promise<{ value: number; date: string }> {
  const resp = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series}/dados/ultimos/1?formato=json`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`BCB ${series} [${resp.status}]`);
  const [row] = (await resp.json()) as Array<{ data: string; valor: string }>;
  const value = Number(String(row.valor).replace(",", "."));
  if (!Number.isFinite(value)) throw new Error(`BCB ${series}: valor inválido`);
  const [d, m, y] = row.data.split("/");
  return { value, date: `${y}-${m}-${d}` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (cache && Date.now() - cache.at < TTL_MS) return jsonResponse(cache.body);

  try {
    const [selic, cdi, ipca] = await Promise.all([lastValue(SERIES.selic), lastValue(SERIES.cdi), lastValue(SERIES.ipca)]);
    const body = { selic: selic.value, cdi: cdi.value, ipca: ipca.value, updatedAt: cdi.date, source: "bcb" };
    cache = { at: Date.now(), body };
    return jsonResponse(body);
  } catch (e) {
    console.error("market-rates error:", e instanceof Error ? e.message : e);
    return jsonResponse({ ...FALLBACK, updatedAt: null, source: "fallback" });
  }
});
