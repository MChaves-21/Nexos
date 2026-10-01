import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { ROUTE_LABELS } from "@/lib/navigation";

const Breadcrumb = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Don't show breadcrumb on Dashboard
  if (currentPath === "/" || currentPath === "/dashboard") {
    return null;
  }

  const currentLabel = ROUTE_LABELS[currentPath] || currentPath.slice(1);

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-2 text-sm text-muted-foreground">
        <li>
          <Link 
            to="/"
            aria-label="Início"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Início</span>
          </Link>
        </li>
        <li>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </li>
        <li>
          <span className="text-foreground font-medium">{currentLabel}</span>
        </li>
      </ol>
    </nav>
  );
};

export default Breadcrumb;
