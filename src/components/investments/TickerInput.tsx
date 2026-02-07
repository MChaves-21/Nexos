 import { useState, useEffect, useRef, useCallback } from "react";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Badge } from "@/components/ui/badge";
 import { cn } from "@/lib/utils";
 import { Check, AlertCircle, Search, X } from "lucide-react";
 import { searchAssets, validateTicker, B3Asset } from "@/data/b3-tickers";
 
 interface TickerInputProps {
   value: string;
   onChange: (value: string, isValid: boolean, asset?: B3Asset) => void;
   assetType?: string;
   id?: string;
   placeholder?: string;
   disabled?: boolean;
 }
 
 export function TickerInput({
   value,
   onChange,
   assetType,
   id,
   placeholder = "Ex: PETR4, VALE3",
   disabled = false,
 }: TickerInputProps) {
   const [inputValue, setInputValue] = useState(value);
   const [suggestions, setSuggestions] = useState<B3Asset[]>([]);
   const [isOpen, setIsOpen] = useState(false);
   const [isValid, setIsValid] = useState<boolean | null>(null);
   const [validatedAsset, setValidatedAsset] = useState<B3Asset | null>(null);
   const [highlightedIndex, setHighlightedIndex] = useState(-1);
   const inputRef = useRef<HTMLInputElement>(null);
   const containerRef = useRef<HTMLDivElement>(null);
   const debounceRef = useRef<NodeJS.Timeout | null>(null);
 
   // Sincronizar com valor externo
   useEffect(() => {
     if (value !== inputValue) {
       setInputValue(value);
       // Validar valor externo
       if (value.length >= 2) {
         const asset = validateTicker(value, assetType);
         setIsValid(asset !== null);
         setValidatedAsset(asset);
       }
     }
   }, [value, assetType]);
 
   // Buscar sugestões com debounce
   const searchWithDebounce = useCallback((query: string) => {
     if (debounceRef.current) {
       clearTimeout(debounceRef.current);
     }
 
     debounceRef.current = setTimeout(() => {
       if (query.length >= 2) {
         const results = searchAssets(query, assetType);
         setSuggestions(results);
         setIsOpen(results.length > 0);
       } else {
         setSuggestions([]);
         setIsOpen(false);
       }
     }, 150);
   }, [assetType]);
 
   // Validar input quando terminar de digitar
   const validateInput = useCallback((ticker: string) => {
     if (ticker.length < 2) {
       setIsValid(null);
       setValidatedAsset(null);
       return;
     }
 
     const asset = validateTicker(ticker, assetType);
     setIsValid(asset !== null);
     setValidatedAsset(asset);
     onChange(ticker, asset !== null, asset || undefined);
   }, [assetType, onChange]);
 
   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const newValue = e.target.value.toUpperCase();
     setInputValue(newValue);
     setHighlightedIndex(-1);
     searchWithDebounce(newValue);
     
     // Validar após um delay maior para não interferir na digitação
     if (debounceRef.current) {
       clearTimeout(debounceRef.current);
     }
     debounceRef.current = setTimeout(() => {
       validateInput(newValue);
     }, 500);
   };
 
   const handleSelectSuggestion = (asset: B3Asset) => {
     setInputValue(asset.ticker);
     setIsValid(true);
     setValidatedAsset(asset);
     setIsOpen(false);
     setSuggestions([]);
     onChange(asset.ticker, true, asset);
     inputRef.current?.focus();
   };
 
   const handleKeyDown = (e: React.KeyboardEvent) => {
     if (!isOpen) return;
 
     switch (e.key) {
       case "ArrowDown":
         e.preventDefault();
         setHighlightedIndex(prev => 
           prev < suggestions.length - 1 ? prev + 1 : prev
         );
         break;
       case "ArrowUp":
         e.preventDefault();
         setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
         break;
       case "Enter":
         e.preventDefault();
         if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
           handleSelectSuggestion(suggestions[highlightedIndex]);
         }
         break;
       case "Escape":
         setIsOpen(false);
         break;
     }
   };
 
   const handleBlur = (e: React.FocusEvent) => {
     // Delay para permitir clique nas sugestões
     setTimeout(() => {
       if (!containerRef.current?.contains(document.activeElement)) {
         setIsOpen(false);
         validateInput(inputValue);
       }
     }, 150);
   };
 
   const handleClear = () => {
     setInputValue("");
     setIsValid(null);
     setValidatedAsset(null);
     setSuggestions([]);
     setIsOpen(false);
     onChange("", false);
     inputRef.current?.focus();
   };
 
   // Fechar ao clicar fora
   useEffect(() => {
     const handleClickOutside = (e: MouseEvent) => {
       if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
         setIsOpen(false);
       }
     };
 
     document.addEventListener("mousedown", handleClickOutside);
     return () => document.removeEventListener("mousedown", handleClickOutside);
   }, []);
 
   return (
     <div className="space-y-2">
       <Label htmlFor={id}>Nome/Ticker</Label>
       <div ref={containerRef} className="relative">
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             ref={inputRef}
             id={id}
             value={inputValue}
             onChange={handleInputChange}
             onKeyDown={handleKeyDown}
             onFocus={() => inputValue.length >= 2 && searchWithDebounce(inputValue)}
             onBlur={handleBlur}
             placeholder={placeholder}
             disabled={disabled}
             autoComplete="off"
             className={cn(
               "pl-9 pr-16",
               isValid === true && "border-success focus-visible:ring-success",
               isValid === false && "border-destructive focus-visible:ring-destructive"
             )}
           />
           <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
             {inputValue && (
               <button
                 type="button"
                 onClick={handleClear}
                 className="p-1 rounded hover:bg-muted transition-colors"
               >
                 <X className="h-3 w-3 text-muted-foreground" />
               </button>
             )}
             {isValid === true && (
               <Check className="h-4 w-4 text-success" />
             )}
             {isValid === false && (
               <AlertCircle className="h-4 w-4 text-destructive" />
             )}
           </div>
         </div>
 
        {/* Dropdown de sugestões */}
        {isOpen && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg overflow-hidden">
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b bg-muted/50">
              {assetType && assetType !== "" 
                ? `Mostrando resultados para "${assetType}"` 
                : "Todos os tipos de ativos"
              }
            </div>
            <ul className="max-h-60 overflow-auto py-1">
              {suggestions.map((asset, index) => {
                // Highlight matching text
                const tickerMatches = asset.ticker.toUpperCase().includes(inputValue.toUpperCase());
                const nameMatches = asset.name.toUpperCase().includes(inputValue.toUpperCase());
                
                return (
                  <li
                    key={asset.ticker}
                    onClick={() => handleSelectSuggestion(asset)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors",
                      highlightedIndex === index
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono font-semibold",
                          tickerMatches && "text-primary"
                        )}>
                          {asset.ticker}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {asset.type}
                        </Badge>
                      </div>
                      <span className={cn(
                        "text-sm text-muted-foreground truncate",
                        nameMatches && !tickerMatches && "text-primary"
                      )}>
                        {asset.name}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
       </div>
 
       {/* Mensagens de feedback */}
       {isValid === false && inputValue.length >= 2 && (
         <p className="text-xs text-destructive flex items-center gap-1">
           <AlertCircle className="h-3 w-3" />
           Ativo não encontrado na base de dados
         </p>
       )}
       {validatedAsset && isValid === true && (
         <p className="text-xs text-success flex items-center gap-1">
           <Check className="h-3 w-3" />
           {validatedAsset.name} ({validatedAsset.type})
         </p>
       )}
     </div>
   );
 }