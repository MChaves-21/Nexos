import { Wallet, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BudgetSection from "@/components/budgets/BudgetSection";
import GoalsSection from "@/components/budgets/GoalsSection";

const Budgets = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-8 w-8 text-primary" />
          Orçamentos e Metas
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie seus orçamentos mensais e acompanhe suas metas financeiras
        </p>
      </div>

      <Tabs defaultValue="budgets" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="budgets" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Orçamentos
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Metas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="budgets" className="mt-6">
          <BudgetSection />
        </TabsContent>
        <TabsContent value="goals" className="mt-6">
          <GoalsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Budgets;
