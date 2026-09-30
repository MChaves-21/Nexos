import SyncedInvestmentsCard from "@/components/openfinance/SyncedInvestmentsCard";

/** Carteira lida do banco via Open Finance. */
const Investments = () => (
  <main className="space-y-6">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Investimentos</h1>
      <p className="text-muted-foreground text-sm mt-1">Posições sincronizadas das suas contas conectadas</p>
    </div>
    <SyncedInvestmentsCard />
  </main>
);

export default Investments;
