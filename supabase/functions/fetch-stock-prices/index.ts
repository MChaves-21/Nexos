import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Investment {
  id: string;
  asset_name: string;
  asset_type: string;
  current_price: number;
}

interface PriceResult {
  symbol: string;
  price: number | null;
  error?: string;
}

// Fetch stock prices from Yahoo Finance API
async function fetchYahooPrice(symbol: string, isBrazilian: boolean): Promise<number | null> {
  try {
    // Brazilian stocks need .SA suffix for B3
    const yahooSymbol = isBrazilian ? `${symbol}.SA` : symbol;
    
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!response.ok) {
      console.log(`Yahoo API error for ${yahooSymbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (
      data.chart &&
      data.chart.result &&
      data.chart.result[0] &&
      data.chart.result[0].meta &&
      data.chart.result[0].meta.regularMarketPrice
    ) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      
      // If it's a US stock, convert to BRL
      if (!isBrazilian) {
        const fxResponse = await fetch(
          "https://api.exchangerate-api.com/v4/latest/USD"
        );
        if (fxResponse.ok) {
          const fxData = await fxResponse.json();
          if (fxData.rates && fxData.rates.BRL) {
            return price * fxData.rates.BRL;
          }
        }
        return price * 5.8; // Fallback rate
      }
      
      return price;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching Yahoo price for ${symbol}:`, error);
    return null;
  }
}

// Fetch cryptocurrency prices from CoinGecko API (free, no key required)
async function fetchCryptoPrice(symbol: string): Promise<number | null> {
  try {
    // Map common crypto symbols to CoinGecko IDs
    const cryptoMap: Record<string, string> = {
      "BTC": "bitcoin",
      "ETH": "ethereum",
      "SOL": "solana",
      "ADA": "cardano",
      "XRP": "ripple",
      "DOT": "polkadot",
      "DOGE": "dogecoin",
      "SHIB": "shiba-inu",
      "MATIC": "polygon",
      "LTC": "litecoin",
      "AVAX": "avalanche-2",
      "LINK": "chainlink",
      "UNI": "uniswap",
      "ATOM": "cosmos",
      "XLM": "stellar",
      "BNB": "binancecoin",
      "USDT": "tether",
      "USDC": "usd-coin",
    };
    
    const coinId = cryptoMap[symbol.toUpperCase()] || symbol.toLowerCase();
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=brl`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.log(`CoinGecko API error for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data[coinId] && data[coinId].brl) {
      return data[coinId].brl;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching crypto price for ${symbol}:`, error);
    return null;
  }
}

async function fetchPrice(asset_name: string, asset_type: string): Promise<number | null> {
  const symbol = asset_name.toUpperCase();
  
  // Cryptocurrencies
  if (asset_type === "Criptomoedas") {
    return await fetchCryptoPrice(symbol);
  }
  
  // Check if it's a Brazilian stock (ends with number like BBAS3, PETR4, KNSC11)
  const isBrazilianStock = /^\w+\d+$/.test(symbol);
  
  // Brazilian stocks, FIIs, or explicitly marked as "Ações"
  if (isBrazilianStock || asset_type === "FIIs") {
    const price = await fetchYahooPrice(symbol, true);
    if (price) return price;
  }
  
  // US stocks or fallback
  if (!isBrazilianStock) {
    return await fetchYahooPrice(symbol, false);
  }
  
  // Try as Brazilian stock if it's marked as "Ações" but didn't match pattern
  if (asset_type === "Ações") {
    return await fetchYahooPrice(symbol, true);
  }
  
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get authorization header to identify the user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Fetch user's investments
    const { data: investments, error: investmentsError } = await supabase
      .from("investments")
      .select("id, asset_name, asset_type, current_price")
      .eq("user_id", user.id);
    
    if (investmentsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch investments" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!investments || investments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No investments found", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Fetch prices for each investment
    const results: PriceResult[] = [];
    let updatedCount = 0;
    
    for (const investment of investments) {
      const newPrice = await fetchPrice(investment.asset_name, investment.asset_type);
      
      if (newPrice !== null && Math.abs(newPrice - investment.current_price) > 0.01) {
        // Update the investment with new price
        const { error: updateError } = await supabase
          .from("investments")
          .update({ 
            current_price: Math.round(newPrice * 100) / 100,
            updated_at: new Date().toISOString()
          })
          .eq("id", investment.id);
        
        if (!updateError) {
          updatedCount++;
          results.push({ 
            symbol: investment.asset_name, 
            price: Math.round(newPrice * 100) / 100 
          });
          console.log(`Updated ${investment.asset_name}: ${investment.current_price} -> ${Math.round(newPrice * 100) / 100}`);
        } else {
          results.push({ 
            symbol: investment.asset_name, 
            price: null, 
            error: "Failed to update" 
          });
          console.error(`Failed to update ${investment.asset_name}:`, updateError);
        }
      } else if (newPrice === null) {
        results.push({ 
          symbol: investment.asset_name, 
          price: null, 
          error: "Price not found" 
        });
        console.log(`Price not found for ${investment.asset_name}`);
      } else {
        results.push({ 
          symbol: investment.asset_name, 
          price: investment.current_price,
          error: "Price unchanged"
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return new Response(
      JSON.stringify({ 
        message: `Updated ${updatedCount} of ${investments.length} investments`,
        updated: updatedCount,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in fetch-stock-prices:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
