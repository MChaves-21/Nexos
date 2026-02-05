 import { useState, useEffect } from "react";
 import { Label } from "@/components/ui/label";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
 import { TrendingUp, Info, RefreshCw, Loader2 } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 export type RateType = "custom" | "selic" | "ipca" | "ipca_plus";
 
 interface MarketRates {
   selic: number;
   ipca: number;
   updatedAt: string;
 }
 
 interface MarketRateSelectorProps {
   value: string;
   onChange: (value: string) => void;
   error?: string;
   id?: string;
 }
 
 // Taxas reais atualizadas (Janeiro 2025)
 const DEFAULT_RATES: MarketRates = {
   selic: 13.25, // Taxa SELIC atual
   ipca: 4.87,   // IPCA acumulado 12 meses
   updatedAt: new Date().toISOString(),
 };
 
 const IPCA_PLUS_SPREADS = [4, 5, 6, 7]; // Spreads comuns de IPCA+
 
 export function MarketRateSelector({ value, onChange, error, id }: MarketRateSelectorProps) {
   const [selectedType, setSelectedType] = useState<RateType>("custom");
   const [ipcaSpread, setIpcaSpread] = useState(5);
   const [rates, setRates] = useState<MarketRates>(DEFAULT_RATES);
   const [isLoading, setIsLoading] = useState(false);
 
   // Detectar tipo baseado no valor atual
   useEffect(() => {
     const numValue = parseFloat(value);
     if (isNaN(numValue)) return;
     
     const ipcaPlusValue = rates.ipca + ipcaSpread;
     
     if (Math.abs(numValue - rates.selic) < 0.01) {
       setSelectedType("selic");
     } else if (Math.abs(numValue - rates.ipca) < 0.01) {
       setSelectedType("ipca");
     } else if (IPCA_PLUS_SPREADS.some(spread => Math.abs(numValue - (rates.ipca + spread)) < 0.01)) {
       setSelectedType("ipca_plus");
       const matchedSpread = IPCA_PLUS_SPREADS.find(spread => Math.abs(numValue - (rates.ipca + spread)) < 0.01);
       if (matchedSpread) setIpcaSpread(matchedSpread);
     }
   }, []);
 
   const handleTypeChange = (type: RateType) => {
     setSelectedType(type);
     
     switch (type) {
       case "selic":
         onChange(rates.selic.toString());
         break;
       case "ipca":
         onChange(rates.ipca.toString());
         break;
       case "ipca_plus":
         onChange((rates.ipca + ipcaSpread).toString());
         break;
       case "custom":
         // Mantém o valor atual
         break;
     }
   };
 
   const handleSpreadChange = (spread: number) => {
     setIpcaSpread(spread);
     if (selectedType === "ipca_plus") {
       onChange((rates.ipca + spread).toString());
     }
   };
 
   const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setSelectedType("custom");
     onChange(e.target.value);
   };
 
   const refreshRates = async () => {
     setIsLoading(true);
     // Simula busca de taxas atualizadas
     // Em produção, isso chamaria uma API real
     await new Promise(resolve => setTimeout(resolve, 800));
     setRates({
       ...DEFAULT_RATES,
       updatedAt: new Date().toISOString(),
     });
     setIsLoading(false);
   };
 
   const formatDate = (dateString: string) => {
     return new Date(dateString).toLocaleDateString("pt-BR", {
       day: "2-digit",
       month: "short",
       year: "numeric",
     });
   };
 
   return (
     <div className="space-y-3">
       <div className="flex items-center justify-between">
         <Label htmlFor={id}>Taxa Anual (%)</Label>
         <div className="flex items-center gap-1">
           <span className="text-xs text-muted-foreground">
             Atualizado: {formatDate(rates.updatedAt)}
           </span>
           <Button
             type="button"
             variant="ghost"
             size="icon"
             className="h-6 w-6"
             onClick={refreshRates}
             disabled={isLoading}
           >
             {isLoading ? (
               <Loader2 className="h-3 w-3 animate-spin" />
             ) : (
               <RefreshCw className="h-3 w-3" />
             )}
           </Button>
         </div>
       </div>
 
       {/* Botões de seleção rápida */}
       <div className="flex flex-wrap gap-2">
         <Button
           type="button"
           variant={selectedType === "selic" ? "default" : "outline"}
           size="sm"
           className="gap-1.5"
           onClick={() => handleTypeChange("selic")}
         >
           <TrendingUp className="h-3 w-3" />
           SELIC
           <Badge variant="secondary" className="ml-1 text-xs">
             {rates.selic}%
           </Badge>
         </Button>
 
         <Tooltip>
           <TooltipTrigger asChild>
             <Button
               type="button"
               variant={selectedType === "ipca" ? "default" : "outline"}
               size="sm"
               className="gap-1.5"
               onClick={() => handleTypeChange("ipca")}
             >
               IPCA
               <Badge variant="secondary" className="ml-1 text-xs">
                 {rates.ipca}%
               </Badge>
               <Info className="h-3 w-3 ml-1" />
             </Button>
           </TooltipTrigger>
           <TooltipContent>
             <p>Índice de Preços ao Consumidor Amplo - Inflação oficial</p>
           </TooltipContent>
         </Tooltip>
 
         <Tooltip>
           <TooltipTrigger asChild>
             <Button
               type="button"
               variant={selectedType === "ipca_plus" ? "default" : "outline"}
               size="sm"
               className="gap-1.5"
               onClick={() => handleTypeChange("ipca_plus")}
             >
               IPCA+
               <Badge variant="secondary" className="ml-1 text-xs">
                 {(rates.ipca + ipcaSpread).toFixed(2)}%
               </Badge>
               <Info className="h-3 w-3 ml-1" />
             </Button>
           </TooltipTrigger>
           <TooltipContent>
             <p>IPCA + taxa fixa - Comum em títulos do Tesouro Direto</p>
           </TooltipContent>
         </Tooltip>
 
         <Button
           type="button"
           variant={selectedType === "custom" ? "default" : "outline"}
           size="sm"
           onClick={() => handleTypeChange("custom")}
         >
           Personalizado
         </Button>
       </div>
 
       {/* Seletor de spread para IPCA+ */}
       {selectedType === "ipca_plus" && (
         <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
           <span className="text-sm text-muted-foreground whitespace-nowrap">IPCA + </span>
           <div className="flex gap-1">
             {IPCA_PLUS_SPREADS.map((spread) => (
               <Button
                 key={spread}
                 type="button"
                 variant={ipcaSpread === spread ? "default" : "ghost"}
                 size="sm"
                 className="h-7 px-2"
                 onClick={() => handleSpreadChange(spread)}
               >
                 {spread}%
               </Button>
             ))}
           </div>
           <span className="text-sm font-medium ml-auto">
             = {(rates.ipca + ipcaSpread).toFixed(2)}% a.a.
           </span>
         </div>
       )}
 
       {/* Input numérico */}
       <div className="relative">
         <Input
           id={id}
           type="number"
           step="0.01"
           placeholder="10"
           value={value}
           onChange={handleCustomChange}
           className={cn(
             "pr-8",
             error ? "border-destructive" : "",
             selectedType !== "custom" ? "bg-muted/30" : ""
           )}
         />
         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
           %
         </span>
       </div>
 
       {error && <p className="text-xs text-destructive">{error}</p>}
 
       {/* Dica contextual */}
       {selectedType === "selic" && (
         <p className="text-xs text-muted-foreground">
           💡 A SELIC é a taxa básica de juros da economia. Investimentos como Tesouro Selic e CDBs geralmente rendem próximo a essa taxa.
         </p>
       )}
       {selectedType === "ipca" && (
         <p className="text-xs text-muted-foreground">
           💡 O IPCA é o índice oficial de inflação. Usar apenas o IPCA significa manter o poder de compra sem ganho real.
         </p>
       )}
       {selectedType === "ipca_plus" && (
         <p className="text-xs text-muted-foreground">
           💡 IPCA+ é comum em títulos do Tesouro Direto. Você protege contra inflação e ainda ganha uma taxa fixa.
         </p>
       )}
     </div>
   );
 }