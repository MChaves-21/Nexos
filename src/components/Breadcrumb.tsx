import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/expenses": "Gastos",
  "/investments": "Investimentos",
  "/goals": "Metas",
  "/budgets": "Orçamentos",
  "/simulation": "Simulador",
  "/reports": "Relatórios",
};

const Breadcrumb = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Don't show breadcrumb on Dashboard
  if (currentPath === "/") {
    return null;
  }

  const currentLabel = routeLabels[currentPath] || currentPath.slice(1);

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link 
            to="/" 
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </li>
        <li>
          <ChevronRight className="h-4 w-4" />
        </li>
        <li>
          <span className="text-foreground font-medium">{currentLabel}</span>
        </li>
      </ol>
    </nav>
  );
};

export default Breadcrumb;
