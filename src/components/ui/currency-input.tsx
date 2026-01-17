import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

const formatCurrency = (value: string): string => {
  // Remove tudo que não é número ou vírgula
  const cleanValue = value.replace(/[^\d,]/g, "");
  
  // Separa parte inteira da decimal
  const parts = cleanValue.split(",");
  let integerPart = parts[0] || "";
  const decimalPart = parts[1];
  
  // Remove zeros à esquerda (exceto se for o único dígito)
  integerPart = integerPart.replace(/^0+/, "") || "0";
  
  // Adiciona pontos como separador de milhar
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  // Reconstrói o valor
  if (decimalPart !== undefined) {
    return `${integerPart},${decimalPart.slice(0, 2)}`;
  }
  
  return integerPart;
};

const parseCurrency = (formattedValue: string): string => {
  // Remove pontos e mantém vírgula para conversão
  return formattedValue.replace(/\./g, "").replace(",", ".");
};

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => {
      if (!value || value === "0") return "";
      // Converte de número para formato brasileiro
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return "";
      return formatCurrency(numValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
    });

    React.useEffect(() => {
      if (!value || value === "0") {
        setDisplayValue("");
        return;
      }
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        setDisplayValue("");
        return;
      }
      // Só atualiza se o valor real mudou (para não interferir durante digitação)
      const currentParsed = parseCurrency(displayValue);
      if (currentParsed !== value) {
        setDisplayValue(formatCurrency(numValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Se está vazio, limpa
      if (!inputValue) {
        setDisplayValue("");
        onChange("0");
        return;
      }
      
      const formatted = formatCurrency(inputValue);
      setDisplayValue(formatted);
      
      // Converte para número e passa o valor real
      const parsed = parseCurrency(formatted);
      onChange(parsed);
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput, formatCurrency, parseCurrency };
