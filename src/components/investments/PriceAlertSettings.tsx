import { useState } from "react";
import { Bell, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { Investment } from "@/hooks/useInvestments";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PriceAlertSettingsProps {
  investments: Investment[];
}

export const PriceAlertSettings = ({ investments }: PriceAlertSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [globalThresholdInput, setGlobalThresholdInput] = useState("");
  const [selectedInvestment, setSelectedInvestment] = useState("");
  const [assetThresholdInput, setAssetThresholdInput] = useState("");

  const {
    alertSettings,
    assetThresholds,
    globalThreshold,
    upsertSettings,
    upsertAssetThreshold,
    deleteAssetThreshold,
    isLoading,
  } = usePriceAlerts();

  const handleSaveGlobalThreshold = () => {
    const threshold = parseFloat(globalThresholdInput);
    if (!isNaN(threshold) && threshold > 0 && threshold <= 100) {
      upsertSettings(threshold);
      setGlobalThresholdInput("");
    }
  };

  const handleSaveAssetThreshold = () => {
    const threshold = parseFloat(assetThresholdInput);
    if (selectedInvestment && !isNaN(threshold) && threshold > 0 && threshold <= 100) {
      upsertAssetThreshold({ investment_id: selectedInvestment, threshold });
      setSelectedInvestment("");
      setAssetThresholdInput("");
    }
  };

  const getInvestmentName = (investmentId: string) => {
    const investment = investments.find(i => i.id === investmentId);
    return investment ? investment.asset_name : "Desconhecido";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bell className="h-4 w-4" />
          Alertas de Preço
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configurar Alertas de Preço
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Global Threshold */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Limite Global
                </CardTitle>
                <CardDescription>
                  Receba alertas quando qualquer ativo variar mais que este percentual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Limite atual:</span>
                  <Badge variant="secondary" className="text-base font-semibold">
                    {globalThreshold}%
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Novo limite (%)"
                      value={globalThresholdInput}
                      onChange={(e) => setGlobalThresholdInput(e.target.value)}
                      min={0.1}
                      max={100}
                      step={0.1}
                    />
                  </div>
                  <Button 
                    onClick={handleSaveGlobalThreshold}
                    disabled={!globalThresholdInput || isLoading}
                  >
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Asset-specific Thresholds */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Limites Personalizados</CardTitle>
                <CardDescription>
                  Configure limites específicos para ativos individuais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <Label>Selecionar Ativo</Label>
                    <Select
                      value={selectedInvestment}
                      onValueChange={setSelectedInvestment}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um ativo" />
                      </SelectTrigger>
                      <SelectContent>
                        {investments.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.asset_name} ({inv.asset_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        placeholder="Limite (%)"
                        value={assetThresholdInput}
                        onChange={(e) => setAssetThresholdInput(e.target.value)}
                        min={0.1}
                        max={100}
                        step={0.1}
                        disabled={!selectedInvestment}
                      />
                    </div>
                    <Button 
                      onClick={handleSaveAssetThreshold}
                      disabled={!selectedInvestment || !assetThresholdInput || isLoading}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>

                {assetThresholds.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-muted-foreground">Limites configurados:</Label>
                    <div className="space-y-2">
                      {assetThresholds.map((threshold) => (
                        <div 
                          key={threshold.id} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {getInvestmentName(threshold.investment_id)}
                            </span>
                            <Badge variant="outline">
                              {threshold.threshold}%
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteAssetThreshold(threshold.investment_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assetThresholds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum limite personalizado configurado.
                    <br />
                    Todos os ativos usam o limite global de {globalThreshold}%.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
