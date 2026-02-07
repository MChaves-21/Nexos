 // Base de dados de tickers da B3
 // Atualizada com as principais ações, FIIs e ETFs
 
 export interface B3Asset {
   ticker: string;
   name: string;
   type: "Ações" | "FIIs" | "Tesouro Direto" | "Renda Fixa" | "Criptomoedas" | "ETF";
 }
 
 export const B3_ASSETS: B3Asset[] = [
   // Ações - Blue Chips
   { ticker: "PETR4", name: "Petrobras PN", type: "Ações" },
   { ticker: "PETR3", name: "Petrobras ON", type: "Ações" },
   { ticker: "VALE3", name: "Vale ON", type: "Ações" },
   { ticker: "ITUB4", name: "Itaú Unibanco PN", type: "Ações" },
   { ticker: "ITUB3", name: "Itaú Unibanco ON", type: "Ações" },
   { ticker: "BBDC4", name: "Bradesco PN", type: "Ações" },
   { ticker: "BBDC3", name: "Bradesco ON", type: "Ações" },
   { ticker: "BBAS3", name: "Banco do Brasil ON", type: "Ações" },
   { ticker: "ABEV3", name: "Ambev ON", type: "Ações" },
   { ticker: "WEGE3", name: "WEG ON", type: "Ações" },
   { ticker: "RENT3", name: "Localiza ON", type: "Ações" },
   { ticker: "SUZB3", name: "Suzano ON", type: "Ações" },
   { ticker: "ELET3", name: "Eletrobras ON", type: "Ações" },
   { ticker: "ELET6", name: "Eletrobras PNB", type: "Ações" },
   { ticker: "B3SA3", name: "B3 ON", type: "Ações" },
   { ticker: "JBSS3", name: "JBS ON", type: "Ações" },
   { ticker: "GGBR4", name: "Gerdau PN", type: "Ações" },
   { ticker: "GGBR3", name: "Gerdau ON", type: "Ações" },
   { ticker: "CSNA3", name: "CSN ON", type: "Ações" },
   { ticker: "USIM5", name: "Usiminas PNA", type: "Ações" },
   { ticker: "CMIN3", name: "CSN Mineração ON", type: "Ações" },
   { ticker: "RAIL3", name: "Rumo ON", type: "Ações" },
   { ticker: "EMBR3", name: "Embraer ON", type: "Ações" },
   { ticker: "CCRO3", name: "CCR ON", type: "Ações" },
   { ticker: "EQTL3", name: "Equatorial ON", type: "Ações" },
   { ticker: "ENGI11", name: "Energisa UNT", type: "Ações" },
   { ticker: "CPFE3", name: "CPFL Energia ON", type: "Ações" },
   { ticker: "TAEE11", name: "Taesa UNT", type: "Ações" },
   { ticker: "CMIG4", name: "Cemig PN", type: "Ações" },
   { ticker: "CMIG3", name: "Cemig ON", type: "Ações" },
   { ticker: "CPLE6", name: "Copel PNB", type: "Ações" },
   { ticker: "CPLE3", name: "Copel ON", type: "Ações" },
   { ticker: "SBSP3", name: "Sabesp ON", type: "Ações" },
   { ticker: "SAPR11", name: "Sanepar UNT", type: "Ações" },
   { ticker: "VIVT3", name: "Telefônica Brasil ON", type: "Ações" },
   { ticker: "TIMS3", name: "TIM ON", type: "Ações" },
   { ticker: "MGLU3", name: "Magazine Luiza ON", type: "Ações" },
   { ticker: "LREN3", name: "Lojas Renner ON", type: "Ações" },
   { ticker: "VIIA3", name: "Via ON", type: "Ações" },
   { ticker: "AMER3", name: "Americanas ON", type: "Ações" },
   { ticker: "PCAR3", name: "GPA ON", type: "Ações" },
   { ticker: "CRFB3", name: "Carrefour Brasil ON", type: "Ações" },
   { ticker: "ASAI3", name: "Assaí ON", type: "Ações" },
   { ticker: "RADL3", name: "Raia Drogasil ON", type: "Ações" },
   { ticker: "PETZ3", name: "Petz ON", type: "Ações" },
   { ticker: "FLRY3", name: "Fleury ON", type: "Ações" },
   { ticker: "RDOR3", name: "Rede D'Or ON", type: "Ações" },
   { ticker: "HAPV3", name: "Hapvida ON", type: "Ações" },
   { ticker: "HYPE3", name: "Hypera ON", type: "Ações" },
   { ticker: "CYRE3", name: "Cyrela ON", type: "Ações" },
   { ticker: "MRVE3", name: "MRV ON", type: "Ações" },
   { ticker: "EZTC3", name: "EZTEC ON", type: "Ações" },
   { ticker: "EVEN3", name: "Even ON", type: "Ações" },
   { ticker: "MULT3", name: "Multiplan ON", type: "Ações" },
   { ticker: "BRML3", name: "BR Malls ON", type: "Ações" },
   { ticker: "IGTI11", name: "Iguatemi UNT", type: "Ações" },
   { ticker: "CVCB3", name: "CVC Brasil ON", type: "Ações" },
   { ticker: "COGN3", name: "Cogna ON", type: "Ações" },
   { ticker: "YDUQ3", name: "Yduqs ON", type: "Ações" },
   { ticker: "TOTS3", name: "TOTVS ON", type: "Ações" },
   { ticker: "LWSA3", name: "Locaweb ON", type: "Ações" },
   { ticker: "CASH3", name: "Méliuz ON", type: "Ações" },
   { ticker: "PRIO3", name: "PetroRio ON", type: "Ações" },
   { ticker: "RRRP3", name: "3R Petroleum ON", type: "Ações" },
   { ticker: "RECV3", name: "PetroReconcavo ON", type: "Ações" },
   { ticker: "UGPA3", name: "Ultrapar ON", type: "Ações" },
   { ticker: "CSAN3", name: "Cosan ON", type: "Ações" },
   { ticker: "VBBR3", name: "Vibra Energia ON", type: "Ações" },
   { ticker: "BRAP4", name: "Bradespar PN", type: "Ações" },
   { ticker: "GOAU4", name: "Metalúrgica Gerdau PN", type: "Ações" },
   { ticker: "KLBN11", name: "Klabin UNT", type: "Ações" },
   { ticker: "SLCE3", name: "SLC Agrícola ON", type: "Ações" },
   { ticker: "BEEF3", name: "Minerva ON", type: "Ações" },
   { ticker: "BRFS3", name: "BRF ON", type: "Ações" },
   { ticker: "MRFG3", name: "Marfrig ON", type: "Ações" },
   { ticker: "SMTO3", name: "São Martinho ON", type: "Ações" },
   { ticker: "NTCO3", name: "Natura ON", type: "Ações" },
   { ticker: "SOMA3", name: "Grupo Soma ON", type: "Ações" },
   { ticker: "ARZZ3", name: "Arezzo ON", type: "Ações" },
   { ticker: "GUAR3", name: "Guararapes ON", type: "Ações" },
   { ticker: "ALPA4", name: "Alpargatas PN", type: "Ações" },
   { ticker: "CIEL3", name: "Cielo ON", type: "Ações" },
   { ticker: "STBP3", name: "Santos Brasil ON", type: "Ações" },
   { ticker: "AZUL4", name: "Azul PN", type: "Ações" },
   { ticker: "GOLL4", name: "Gol PN", type: "Ações" },
   { ticker: "ITSA4", name: "Itaúsa PN", type: "Ações" },
   { ticker: "ITSA3", name: "Itaúsa ON", type: "Ações" },
   { ticker: "SANB11", name: "Santander Brasil UNT", type: "Ações" },
   { ticker: "BPAC11", name: "BTG Pactual UNT", type: "Ações" },
   { ticker: "BBSE3", name: "BB Seguridade ON", type: "Ações" },
   { ticker: "PSSA3", name: "Porto Seguro ON", type: "Ações" },
   { ticker: "SULA11", name: "SulAmérica UNT", type: "Ações" },
   { ticker: "IRBR3", name: "IRB Brasil ON", type: "Ações" },
 
   // FIIs - Fundos Imobiliários
   { ticker: "HGLG11", name: "CSHG Logística FII", type: "FIIs" },
   { ticker: "XPLG11", name: "XP Log FII", type: "FIIs" },
   { ticker: "VILG11", name: "Vinci Logística FII", type: "FIIs" },
   { ticker: "BRCO11", name: "Bresco Logística FII", type: "FIIs" },
   { ticker: "BTLG11", name: "BTG Logística FII", type: "FIIs" },
   { ticker: "KNRI11", name: "Kinea Renda FII", type: "FIIs" },
   { ticker: "BRCR11", name: "BC Fund FII", type: "FIIs" },
   { ticker: "HGRE11", name: "CSHG Real Estate FII", type: "FIIs" },
   { ticker: "RBRP11", name: "RBR Properties FII", type: "FIIs" },
   { ticker: "PVBI11", name: "VBI Prime Properties FII", type: "FIIs" },
   { ticker: "JSRE11", name: "JS Real Estate FII", type: "FIIs" },
   { ticker: "MALL11", name: "Malls Brasil Plural FII", type: "FIIs" },
   { ticker: "XPML11", name: "XP Malls FII", type: "FIIs" },
   { ticker: "VISC11", name: "Vinci Shopping Centers FII", type: "FIIs" },
   { ticker: "HSML11", name: "HSI Malls FII", type: "FIIs" },
   { ticker: "HGBS11", name: "Hedge Brasil Shopping FII", type: "FIIs" },
   { ticker: "MXRF11", name: "Maxi Renda FII", type: "FIIs" },
   { ticker: "KNCR11", name: "Kinea Rendimentos FII", type: "FIIs" },
   { ticker: "HGCR11", name: "CSHG Recebíveis FII", type: "FIIs" },
   { ticker: "CPTS11", name: "Capitânia Securities FII", type: "FIIs" },
   { ticker: "VRTA11", name: "Fator Verita FII", type: "FIIs" },
   { ticker: "IRDM11", name: "Iridium Recebíveis FII", type: "FIIs" },
   { ticker: "RECR11", name: "REC Recebíveis FII", type: "FIIs" },
   { ticker: "RBRR11", name: "RBR Rendimento High Grade FII", type: "FIIs" },
   { ticker: "BCFF11", name: "BTG Fundo de Fundos FII", type: "FIIs" },
   { ticker: "RBRF11", name: "RBR Alpha Multiestratégia FII", type: "FIIs" },
   { ticker: "HFOF11", name: "Hedge Top FOFII 3 FII", type: "FIIs" },
   { ticker: "KNHY11", name: "Kinea High Yield CRI FII", type: "FIIs" },
   { ticker: "KNIP11", name: "Kinea Índice de Preços FII", type: "FIIs" },
   { ticker: "VGIR11", name: "Valora RE III FII", type: "FIIs" },
   { ticker: "HABT11", name: "Habitat II FII", type: "FIIs" },
   { ticker: "TGAR11", name: "TG Ativo Real FII", type: "FIIs" },
   { ticker: "RZAK11", name: "Riza Akin FII", type: "FIIs" },
   { ticker: "DEVA11", name: "Devant Recebíveis FII", type: "FIIs" },
   { ticker: "HCTR11", name: "Hectare CE FII", type: "FIIs" },
   { ticker: "VINO11", name: "Vinci Offices FII", type: "FIIs" },
   { ticker: "TEPP11", name: "Tellus Properties FII", type: "FIIs" },
   { ticker: "PATL11", name: "Pátria Logística FII", type: "FIIs" },
   { ticker: "TRXF11", name: "TRX Real Estate FII", type: "FIIs" },
   { ticker: "LVBI11", name: "VBI Logístico FII", type: "FIIs" },
   { ticker: "GTWR11", name: "Green Towers FII", type: "FIIs" },
 
   // Criptomoedas (códigos comuns usados em corretoras)
   { ticker: "BTC", name: "Bitcoin", type: "Criptomoedas" },
   { ticker: "ETH", name: "Ethereum", type: "Criptomoedas" },
   { ticker: "BNB", name: "Binance Coin", type: "Criptomoedas" },
   { ticker: "SOL", name: "Solana", type: "Criptomoedas" },
   { ticker: "ADA", name: "Cardano", type: "Criptomoedas" },
   { ticker: "XRP", name: "Ripple", type: "Criptomoedas" },
   { ticker: "DOT", name: "Polkadot", type: "Criptomoedas" },
   { ticker: "DOGE", name: "Dogecoin", type: "Criptomoedas" },
   { ticker: "SHIB", name: "Shiba Inu", type: "Criptomoedas" },
   { ticker: "MATIC", name: "Polygon", type: "Criptomoedas" },
   { ticker: "LINK", name: "Chainlink", type: "Criptomoedas" },
   { ticker: "UNI", name: "Uniswap", type: "Criptomoedas" },
   { ticker: "AVAX", name: "Avalanche", type: "Criptomoedas" },
   { ticker: "ATOM", name: "Cosmos", type: "Criptomoedas" },
   { ticker: "LTC", name: "Litecoin", type: "Criptomoedas" },
 
   // ETFs brasileiros
   { ticker: "BOVA11", name: "iShares Ibovespa ETF", type: "Ações" },
   { ticker: "IVVB11", name: "iShares S&P 500 ETF", type: "Ações" },
   { ticker: "SMAL11", name: "iShares Small Cap ETF", type: "Ações" },
   { ticker: "HASH11", name: "Hashdex Crypto ETF", type: "Ações" },
   { ticker: "QBTC11", name: "QR Bitcoin ETF", type: "Ações" },
   { ticker: "BITH11", name: "Hashdex Bitcoin ETF", type: "Ações" },
   { ticker: "ETHE11", name: "Hashdex Ethereum ETF", type: "Ações" },
   { ticker: "DIVO11", name: "It Now IDIV ETF", type: "Ações" },
   { ticker: "FIND11", name: "It Now IFNC ETF", type: "Ações" },
   { ticker: "MATB11", name: "It Now IMAT ETF", type: "Ações" },
   { ticker: "GOVE11", name: "It Now IGOV ETF", type: "Ações" },
 
   // Tesouro Direto (códigos comuns)
   { ticker: "TESOURO SELIC", name: "Tesouro Selic", type: "Tesouro Direto" },
   { ticker: "TESOURO IPCA+", name: "Tesouro IPCA+", type: "Tesouro Direto" },
   { ticker: "TESOURO PREFIXADO", name: "Tesouro Prefixado", type: "Tesouro Direto" },
   { ticker: "TESOURO RENDA+", name: "Tesouro RendA+", type: "Tesouro Direto" },
   { ticker: "TESOURO EDUCA+", name: "Tesouro Educa+", type: "Tesouro Direto" },
 
   // Renda Fixa (exemplos genéricos)
   { ticker: "CDB", name: "Certificado de Depósito Bancário", type: "Renda Fixa" },
   { ticker: "LCI", name: "Letra de Crédito Imobiliário", type: "Renda Fixa" },
   { ticker: "LCA", name: "Letra de Crédito Agronegócio", type: "Renda Fixa" },
   { ticker: "CRI", name: "Certificado Recebíveis Imobiliário", type: "Renda Fixa" },
   { ticker: "CRA", name: "Certificado Recebíveis Agronegócio", type: "Renda Fixa" },
   { ticker: "DEBENTURE", name: "Debênture", type: "Renda Fixa" },
   { ticker: "POUPANÇA", name: "Poupança", type: "Renda Fixa" },
 ];
 
// Função para buscar ativos por ticker ou nome com filtragem por tipo
export function searchAssets(query: string, assetType?: string): B3Asset[] {
  const normalizedQuery = query.toUpperCase().trim();
  
  if (normalizedQuery.length < 2) return [];
  
  let assets = B3_ASSETS;
  
  // Filtrar por tipo se especificado (e não for vazio ou "all")
  if (assetType && assetType !== "all" && assetType !== "") {
    assets = assets.filter(a => a.type === assetType);
  }
  
  // Busca híbrida: pesquisa tanto no ticker quanto no nome
  // Também remove acentos para busca mais flexível
  const removeAccents = (str: string) => 
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const normalizedQueryNoAccents = removeAccents(normalizedQuery);
  
  return assets.filter(asset => {
    const tickerMatch = asset.ticker.toUpperCase().includes(normalizedQuery);
    const nameMatch = asset.name.toUpperCase().includes(normalizedQuery);
    const nameNoAccentsMatch = removeAccents(asset.name.toUpperCase()).includes(normalizedQueryNoAccents);
    
    return tickerMatch || nameMatch || nameNoAccentsMatch;
  }).slice(0, 10); // Limitar a 10 resultados
}
 
// Função para validar se um ticker existe
export function validateTicker(ticker: string, assetType?: string): B3Asset | null {
  const normalizedTicker = ticker.toUpperCase().trim();
  
  let assets = B3_ASSETS;
  
  // Filtrar por tipo se especificado (e não for vazio ou "all")
  if (assetType && assetType !== "all" && assetType !== "") {
    assets = assets.filter(a => a.type === assetType);
  }
  
  return assets.find(a => a.ticker === normalizedTicker) || null;
}

// Função para obter o tipo de ativo pelo ticker
export function getAssetTypeByTicker(ticker: string): string | null {
  const asset = B3_ASSETS.find(a => a.ticker.toUpperCase() === ticker.toUpperCase().trim());
  return asset ? asset.type : null;
}