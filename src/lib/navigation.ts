import {
  Building2, CalendarDays, Calculator, CreditCard, FileText, LayoutDashboard, ListChecks, ReceiptText, Tags, Target, TrendingUp, Users, Wallet,
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
  { to: "/bills", label: "Contas a pagar", shortLabel: "Contas", icon: CalendarDays, level: "complete", description: "Vencimentos e lembretes" },
  { to: "/cards", label: "Cartões", shortLabel: "Cartões", icon: CreditCard, level: "complete", description: "Fatura, vencimento e parcelas" },
  { to: "/investments", label: "Investimentos", shortLabel: "Investimentos", icon: TrendingUp, level: "complete", description: "Carteira, rentabilidade e alocação" },
  { to: "/simulation", label: "Simulador", shortLabel: "Simulador", icon: Calculator, level: "complete", description: "Quanto juntar e em quanto tempo" },
  { to: "/reports", label: "Relatórios", shortLabel: "Relatórios", icon: FileText, level: "complete", description: "PDF do período" },
  { to: "/categorization", label: "Categorização", shortLabel: "Categorias", icon: Tags, level: "complete", description: "Revisar categorias sugeridas" },
  { to: "/rules", label: "Regras", shortLabel: "Regras", icon: ListChecks, level: "complete", description: "Categorias automáticas por palavra" },
  { to: "/taxes", label: "Imposto de Renda", shortLabel: "IR", icon: ReceiptText, level: "complete", description: "Resumo do ano para a declaração" },
  { to: "/family", label: "Família", shortLabel: "Família", icon: Users, level: "complete", description: "Convites e estado das conexões" },
];

export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  [...NAV_ITEMS.map((i) => [i.to, i.label]), ["/dashboard", "Início"], ["/account", "Conta e privacidade"]],
);

export const visibleNavItems = (complete: boolean) => NAV_ITEMS.filter((i) => complete || i.level === "simple");
