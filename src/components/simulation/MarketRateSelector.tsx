import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type RateType = "custom" | "selic" | "ipca_plus";

interface MarketRates {
  selic: number;
  ipca: number;
}

interface MarketRateSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
}

// Taxas reais atualizadas (Janeiro 2025)
const DEFAULT_RATES: MarketRates = {
  selic: 13.25,
  ipca: 4.87,
};

const IPCA_PLUS_SPREAD = 5; // Spread padrão IPCA+

export function MarketRateSelector({ value, onChange, error, id }: MarketRateSelectorProps) {
  const [selectedType, setSelectedType] = useState<RateType>("custom");
  const [customValue, setCustomValue] = useState(value);
  const [rates] = useState<MarketRates>(DEFAULT_RATES);

  const ipcaPlusRate = rates.ipca + IPCA_PLUS_SPREAD;

  // Detectar tipo baseado no valor atual
  useEffect(() => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    if (Math.abs(numValue - rates.selic) < 0.01) {
      setSelectedType("selic");
    } else if (Math.abs(numValue - ipcaPlusRate) < 0.01) {
      setSelectedType("ipca_plus");
    } else {
      setSelectedType("custom");
      setCustomValue(value);
    }
  }, []);

  const handleTypeChange = (type: RateType) => {
    setSelectedType(type);
    
    switch (type) {
      case "selic":
        onChange(rates.selic.toString());
        break;
      case "ipca_plus":
        onChange(ipcaPlusRate.toString());
        break;
      case "custom":
        onChange(customValue || "10");
        break;
    }
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCustomValue(newValue);
    setSelectedType("custom");
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      <Label htmlFor={id}>Taxa Anual (%)</Label>

      <RadioGroup
        value={selectedType}
        onValueChange={(value) => handleTypeChange(value as RateType)}
        className="grid grid-cols-3 gap-2"
      >
        {/* SELIC */}
        <div>
          <RadioGroupItem
            value="selic"
            id="rate-selic"
            className="peer sr-only"
          />
          <Label
            htmlFor="rate-selic"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-all",
              "hover:bg-accent hover:text-accent-foreground",
              selectedType === "selic"
                ? "border-primary bg-primary/5"
                : "border-muted"
            )}
          >
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm">SELIC</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Taxa básica de juros da economia. Investimentos como Tesouro Selic e CDBs geralmente rendem próximo a essa taxa.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-lg font-bold text-primary">{rates.selic}%</span>
          </Label>
        </div>

        {/* IPCA+ */}
        <div>
          <RadioGroupItem
            value="ipca_plus"
            id="rate-ipca-plus"
            className="peer sr-only"
          />
          <Label
            htmlFor="rate-ipca-plus"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-all",
              "hover:bg-accent hover:text-accent-foreground",
              selectedType === "ipca_plus"
                ? "border-primary bg-primary/5"
                : "border-muted"
            )}
          >
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm">IPCA+</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">IPCA ({rates.ipca}%) + {IPCA_PLUS_SPREAD}% fixo. Comum em títulos do Tesouro Direto. Protege contra inflação.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-lg font-bold text-primary">{ipcaPlusRate.toFixed(2)}%</span>
          </Label>
        </div>

        {/* Personalizado */}
        <div>
          <RadioGroupItem
            value="custom"
            id="rate-custom"
            className="peer sr-only"
          />
          <Label
            htmlFor="rate-custom"
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-all",
              "hover:bg-accent hover:text-accent-foreground",
              selectedType === "custom"
                ? "border-primary bg-primary/5"
                : "border-muted"
            )}
          >
            <span className="font-semibold text-sm">Personalizado</span>
            <span className="text-lg font-bold text-primary">
              {selectedType === "custom" && customValue ? `${customValue}%` : "—"}
            </span>
          </Label>
        </div>
      </RadioGroup>

      {/* Input para valor personalizado */}
      {selectedType === "custom" && (
        <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
          <Input
            id={id}
            type="number"
            step="0.01"
            placeholder="Digite a taxa desejada"
            value={customValue}
            onChange={handleCustomChange}
            className={cn("pr-8", error ? "border-destructive" : "")}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            %
          </span>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}