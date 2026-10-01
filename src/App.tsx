import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "@/components/ErrorBoundary";
import OfflineBanner from "@/components/OfflineBanner";
import { toast } from "@/hooks/use-toast";
import { friendlyErrorMessage, isMissingSchemaError, shouldRetry } from "@/lib/errors";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Investments = lazy(() => import("./pages/Investments"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Simulation = lazy(() => import("./pages/Simulation"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Reports = lazy(() => import("./pages/Reports"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OpenFinance = lazy(() => import("./pages/OpenFinance"));
const Categorization = lazy(() => import("./pages/Categorization"));
const Rules = lazy(() => import("./pages/Rules"));

// Aviso único por mensagem a cada 10s (várias consultas falhando juntas não viram uma pilha de avisos)
const recentErrors = new Map<string, number>();
const notifyError = (error: unknown) => {
  // Coluna/tabela ainda não migrada: as telas usam valores padrão, sem incomodar a pessoa
  if (isMissingSchemaError(error)) {
    console.warn("Banco desatualizado:", error);
    return;
  }
  const message = friendlyErrorMessage(error);
  const now = Date.now();
  if ((recentErrors.get(message) ?? 0) > now - 10_000) return;
  recentErrors.set(message, now);
  toast({ title: "Não foi possível carregar os dados", description: message, variant: "destructive" });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: notifyError }),
  // Mutações já mostram seus próprios avisos (onError em cada hook); aqui só registramos
  mutationCache: new MutationCache({ onError: (error) => console.error("Falha ao salvar:", error) }),
  defaultOptions: {
    queries: { retry: shouldRetry },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Wrapper component for routes with transitions
const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <PageTransition key={location.pathname}>
      <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/expenses" element={<Layout><Expenses /></Layout>} />
          <Route path="/investments" element={<Layout><Investments /></Layout>} />
          <Route path="/simulation" element={<Layout><Simulation /></Layout>} />
          <Route path="/budgets" element={<Layout><Budgets /></Layout>} />
          <Route path="/reports" element={<Layout><Reports /></Layout>} />
          <Route path="/open-finance" element={<Layout><OpenFinance /></Layout>} />
          <Route path="/categorization" element={<Layout><Categorization /></Layout>} />
          <Route path="/rules" element={<Layout><Rules /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </PageTransition>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="financehub-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
