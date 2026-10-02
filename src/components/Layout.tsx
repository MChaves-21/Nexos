import { ReactNode, useState, useEffect, useTransition } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, LogIn, Moon, Sun, Loader2, MoreHorizontal, UserCog } from "lucide-react";
import nexosLogo from "@/assets/nexos-logo-optimized.webp";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import Breadcrumb from "@/components/Breadcrumb";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ModeToggle from "@/components/ModeToggle";
import InstallAppButton from "@/components/InstallAppButton";
import NotificationsBell from "@/components/NotificationsBell";
import OnboardingDialog from "@/components/OnboardingDialog";
import { usePreferences } from "@/hooks/usePreferences";
import { NAV_ITEMS, visibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { readPendingInvite } from "@/lib/family";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import type { User } from "@supabase/supabase-js";
import { friendlyErrorMessage } from "@/lib/errors";
interface LayoutProps {
  children: ReactNode;
}
const Layout = ({
  children
}: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    theme,
    setTheme
  } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Convite aberto antes do login: depois de entrar, volta para aceitar
  useEffect(() => {
    if (!user) return;
    const pending = readPendingInvite();
    if (pending) navigate(`/convite/${pending}`, { replace: true });
  }, [user, navigate]);

  // Clear pending route when location changes
  useEffect(() => {
    setPendingRoute(null);
  }, [location.pathname]);
  const handleLogout = async () => {
    const {
      error
    } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: friendlyErrorMessage(error),
        variant: "destructive"
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!"
      });
      navigate("/auth");
    }
  };

  // Prefetch map for lazy-loaded pages
  const prefetchMap: Record<string, () => Promise<unknown>> = {
    "/": () => import("@/pages/Index"),
    "/expenses": () => import("@/pages/Expenses"),
    "/investments": () => import("@/pages/Investments"),
    "/budgets": () => import("@/pages/Budgets"),
    "/simulation": () => import("@/pages/Simulation"),
    "/reports": () => import("@/pages/Reports"),
    "/open-finance": () => import("@/pages/OpenFinance"),
    "/categorization": () => import("@/pages/Categorization"),
    "/rules": () => import("@/pages/Rules")
  };
  const handlePrefetch = (to: string) => {
    const prefetch = prefetchMap[to];
    if (prefetch) {
      prefetch();
    }
  };
  const handleNavClick = (to: string) => {
    if (location.pathname !== to) {
      setPendingRoute(to);
      startTransition(() => {
        navigate(to);
      });
    }
  };
  const { isComplete } = usePreferences();
  const navItems = visibleNavItems(isComplete);
  const simpleItems = NAV_ITEMS.filter(i => i.level === "simple");
  const extraItems = NAV_ITEMS.filter(i => i.level === "complete");
  const [moreOpen, setMoreOpen] = useState(false);
  const isActivePath = (to: string) => location.pathname === to || (to === "/" && location.pathname === "/dashboard");

  const NavLinks = () => <>
      {navItems.map(({ to, icon: Icon, label }) => {
      const isLoading = isPending && pendingRoute === to;
      const isActive = isActivePath(to);
      return <Button key={to} variant={isActive ? "default" : "ghost"} className="w-full justify-start gap-3"
          onClick={() => handleNavClick(to)} onMouseEnter={() => handlePrefetch(to)} onFocus={() => handlePrefetch(to)}
          disabled={isLoading} aria-current={isActive ? "page" : undefined}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
            {label}
          </Button>;
    })}
    </>;

  return <div className="min-h-screen bg-muted/30 flex flex-col">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Pular para o conteúdo
      </a>
      <OnboardingDialog />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={nexosLogo} alt="" className="h-8 w-8 rounded" loading="eager" decoding="async" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              NEXOS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <InstallAppButton />
            {user && <NotificationsBell />}
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}>
              {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
            </Button>
            {user ? <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" aria-hidden />
                Sair
              </Button> : <Button onClick={() => navigate("/auth")} className="gap-2">
                <LogIn className="h-4 w-4" aria-hidden />
                Entrar
              </Button>}
          </div>
        </div>
      </header>

      <div className="container flex gap-6 py-6 flex-1 rounded-none">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 flex-col gap-4 sticky top-20 h-fit">
          <nav className="flex flex-col gap-2" aria-label="Menu principal">
            <NavLinks />
          </nav>
          <ModeToggle />
          <Button variant={location.pathname === "/account" ? "secondary" : "ghost"} className="w-full justify-start gap-3"
            onClick={() => handleNavClick("/account")} aria-current={location.pathname === "/account" ? "page" : undefined}>
            <UserCog className="h-5 w-5" aria-hidden />Conta e privacidade
          </Button>
        </aside>

        {/* Main Content (espaço extra embaixo no celular por causa da barra inferior) */}
        <main id="conteudo" tabIndex={-1} className="flex-1 min-w-0 pb-24 lg:pb-0 focus:outline-none">
          <Breadcrumb />
          {children}
        </main>
      </div>

      <div className="pb-20 lg:pb-0">
        <Footer />
      </div>

      {/* Barra inferior - Celular */}
      <nav aria-label="Menu principal" className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {simpleItems.map(({ to, icon: Icon, shortLabel }) => {
          const isActive = isActivePath(to);
          return <li key={to}>
                <button onClick={() => handleNavClick(to)} aria-current={isActive ? "page" : undefined}
                  className={cn("flex w-full min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                  <Icon className="h-5 w-5" aria-hidden />
                  {shortLabel}
                </button>
              </li>;
        })}
          <li>
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button className={cn("flex w-full min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  extraItems.some(i => isActivePath(i.to)) && "text-primary")}>
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                  Mais
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Mais opções</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  {isComplete ? <ul className="grid grid-cols-2 gap-2">
                      {extraItems.map(({ to, icon: Icon, label, description }) => <li key={to}>
                          <button onClick={() => { setMoreOpen(false); handleNavClick(to); }} aria-current={isActivePath(to) ? "page" : undefined}
                            className={cn("flex h-full w-full flex-col items-start gap-1 rounded-lg border p-3 text-left min-h-[72px]", isActivePath(to) && "border-primary bg-primary/5")}>
                            <Icon className="h-5 w-5 text-primary" aria-hidden />
                            <span className="text-sm font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">{description}</span>
                          </button>
                        </li>)}
                    </ul> : <p className="text-sm text-muted-foreground">
                      O modo simples mostra só o essencial. Ative o modo completo para ver contas a pagar, cartões, investimentos, Imposto de Renda e família.
                    </p>}
                  <ModeToggle />
                  <button onClick={() => { setMoreOpen(false); handleNavClick("/account"); }}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm font-medium min-h-[48px]">
                    <UserCog className="h-5 w-5 text-primary" aria-hidden />Conta e privacidade
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>;
};
export default Layout;
