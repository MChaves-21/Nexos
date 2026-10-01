import {
  Building2, Calculator, FileText, LayoutDashboard, ListChecks, Tags, Target, TrendingUp, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  /** Texto curto para a barra inferior do celular */
  shortLabel: string;
  icon: LucideIcon;
  /** "simple" aparece sempre; "complete" só no modo completo */
  level: "simple" | "complete";
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Início", shortLabel: "Início", icon: LayoutDashboard, level: "simple", description: "Resumo do seu mês" },
  { to: "/expenses", label: "Transações", shortLabel: "Transações", icon: Wallet, level: "simple", description: "Entradas e saídas" },
  { to: "/budgets", label: "Metas e limites", shortLabel: "Metas", icon: Target, level: "simple", description: "Quanto gastar e quanto guardar" },
  { to: "/open-finance", label: "Conectar banco", shortLabel: "Conectar", icon: Building2, level: "simple", description: "Banco ou arquivo do extrato" },
  { to: "/investments", label: "Investimentos", shortLabel: "Investimentos", icon: TrendingUp, level: "complete", description: "Carteira, rentabilidade e alocação" },
  { to: "/simulation", label: "Simulador", shortLabel: "Simulador", icon: Calculator, level: "complete", description: "Quanto juntar e em quanto tempo" },
  { to: "/reports", label: "Relatórios", shortLabel: "Relatórios", icon: FileText, level: "complete", description: "PDF do período" },
  { to: "/categorization", label: "Categorização", shortLabel: "Categorias", icon: Tags, level: "complete", description: "Revisar categorias sugeridas" },
  { to: "/rules", label: "Regras", shortLabel: "Regras", icon: ListChecks, level: "complete", description: "Categorias automáticas por palavra" },
];

export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  [...NAV_ITEMS.map((i) => [i.to, i.label]), ["/dashboard", "Início"]],
);

export const visibleNavItems = (complete: boolean) => NAV_ITEMS.filter((i) => complete || i.level === "simple");
