import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const IPCA_PLUS_SPREAD = 5;

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
    onChange(newValue);
  };

  const getDisplayValue = () => {
    switch (selectedType) {
      case "selic":
        return `SELIC (${rates.selic}% a.a.)`;
      case "ipca_plus":
        return `IPCA+ (${ipcaPlusRate.toFixed(2)}% a.a.)`;
      case "custom":
        return "Personalizado";
      default:
        return "Selecione...";
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Taxa Anual (%)</Label>

      <Select value={selectedType} onValueChange={(val) => handleTypeChange(val as RateType)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione a taxa">{getDisplayValue()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="selic">
            <div className="flex items-center justify-between w-full gap-4">
              <span>SELIC</span>
              <span className="text-muted-foreground text-sm">{rates.selic}% a.a.</span>
            </div>
          </SelectItem>
          <SelectItem value="ipca_plus">
            <div className="flex items-center justify-between w-full gap-4">
              <span>IPCA+</span>
              <span className="text-muted-foreground text-sm">{ipcaPlusRate.toFixed(2)}% a.a.</span>
            </div>
          </SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent>
      </Select>

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