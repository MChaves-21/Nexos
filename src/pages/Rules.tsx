import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, Trash2, Play } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUndoableDelete } from "@/hooks/useUndoableDelete";
import { CATEGORIES } from "@shared/categorization";
import type { Tables } from "@/integrations/supabase/types";

type Rule = Tables<"categorization_rules">;

/** Regras "descrição contém X => categoria Y", usadas na sincronização e na importação. */
const Rules = () => {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<string>("");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["categorization-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorization_rules").select("*").order("keyword");
      if (error) throw error;
      return data as Rule[];
    },
  });

  const applyRule = async (kw: string, cat: string) => {
    const { data, error } = await supabase
      .from("synced_transactions")
      .update({ ai_category: cat, ai_confidence: 1, category_source: "rule" })
      .ilike("description", `%${kw}%`)
      .or("category_source.is.null,category_source.neq.user")
      .select("id");
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["synced-transactions"] });
    return data?.length ?? 0;
  };

  const save = useMutation({
    mutationFn: async () => {
      const kw = keyword.trim().toLowerCase();
      if (!kw || !category) throw new Error("Informe o texto e a categoria");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("categorization_rules")
        .upsert({ user_id: user.id, keyword: kw, category }, { onConflict: "user_id,keyword" });
      if (error) throw error;
      return applyRule(kw, category);
    },
    onSuccess: (n) => {
      setKeyword(""); setCategory("");
      qc.invalidateQueries({ queryKey: ["categorization-rules"] });
      toast({ title: "Regra salva", description: `Aplicada a ${n} transações.` });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const run = useMutation({
    mutationFn: (r: Rule) => applyRule(r.keyword, r.category),
    onSuccess: (n) => toast({ title: "Regra aplicada", description: `${n} transações atualizadas.` }),
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const { deleteWithUndo } = useUndoableDelete<Rule>({
    tableName: "categorization_rules",
    queryKey: ["categorization-rules"],
    itemLabel: "Regra",
    getItemDescription: (r) => r.keyword,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Regras de categoria</h1>
        <p className="text-muted-foreground text-sm mt-1">Quando a descrição contiver o texto, a transação recebe a categoria. Suas escolhas manuais nunca são sobrescritas.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base sm:text-lg">Nova regra</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input placeholder="Descrição contém… (ex.: ifood)" value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Texto da descrição" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-48" aria-label="Categoria"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="submit" disabled={save.isPending}><Plus className="h-4 w-4 mr-1" />Salvar e aplicar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{rules.length} regras</CardTitle>
          <CardDescription>Inclui as aprendidas quando você corrige uma categoria</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : rules.length === 0 ? (
            <div className="text-center py-8">
              <ListChecks className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma regra ainda.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-2">
                  <span className="flex-1 font-medium truncate">"{r.keyword}"</span>
                  <span className="text-sm text-muted-foreground">→ {r.category}</span>
                  <Button size="icon" variant="ghost" onClick={() => run.mutate(r)} aria-label="Aplicar regra"><Play className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteWithUndo(r)} aria-label="Excluir regra"><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Rules;
