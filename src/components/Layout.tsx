import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Wallet, TrendingUp, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/expenses", icon: Wallet, label: "Gastos" },
    { to: "/investments", icon: TrendingUp, label: "Investimentos" },
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
