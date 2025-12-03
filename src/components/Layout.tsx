import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, TrendingUp, Menu, Calculator, LogOut, LogIn, Moon, Sun, Target, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import type { User } from "@supabase/supabase-js";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      navigate("/auth");
    }
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/expenses", icon: Wallet, label: "Gastos" },
    { to: "/investments", icon: TrendingUp, label: "Investimentos" },
    { to: "/goals", icon: Target, label: "Metas" },
    { to: "/budgets", icon: Receipt, label: "Orçamentos" },
    { to: "/simulation", icon: Calculator, label: "Simulador" },
    { to: "/reports", icon: FileText, label: "Relatórios" },
  ];

  const NavLinks = () => (
    <>
      {navItems.map(({ to, icon: Icon, label }) => (
        <Link key={to} to={to}>
          <Button
            variant={location.pathname === to ? "default" : "ghost"}
            className="w-full justify-start gap-3"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Button>
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <nav className="flex flex-col gap-2 mt-8">
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              FinanceHub
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
            {user ? (
              <Button variant="outline" onClick={handleLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            ) : (
              <Button onClick={() => navigate("/auth")} className="gap-2">
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container flex gap-6 py-6">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 flex-col gap-2 sticky top-20 h-fit">
          <nav className="flex flex-col gap-2">
            <NavLinks />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
