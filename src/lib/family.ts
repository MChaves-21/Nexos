// Família: links de convite e leitura do estado das conexões de cada membro.

export const PENDING_INVITE_KEY = "nexos:pending-invite";

export function inviteLink(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/convite/${token}`;
}

/** Token de convite: 64 caracteres hexadecimais (gerado no banco). */
export function isInviteToken(value: string | undefined | null): value is string {
  return !!value && /^[0-9a-f]{64}$/.test(value);
}

export interface MemberOverview {
  user_id: string;
  display_name: string;
  role: string;
  connections: number;
  pluggy_connections: number;
  last_sync_at: string | null;
  problem_connections: number;
  reauth_connections: number;
  next_consent_expiry: string | null;
  has_own_pluggy: boolean;
}

export type MemberHealth = "ok" | "attention" | "problem" | "no-bank";

/** Resumo do estado de um membro para o painel (sem dados financeiros). */
export function memberHealth(m: MemberOverview, now: Date = new Date()): { level: MemberHealth; message: string } {
  if (m.reauth_connections > 0) return { level: "problem", message: "Precisa reconectar o banco (aprovar de novo no app do banco)." };
  if (m.problem_connections > 0) return { level: "problem", message: "A sincronização está com erro." };
  if (m.connections === 0) return { level: "no-bank", message: "Nenhum banco conectado nem extrato importado." };
  if (m.next_consent_expiry) {
    const days = Math.ceil((new Date(m.next_consent_expiry).getTime() - now.getTime()) / 86_400_000);
    if (days <= 30) return { level: "attention", message: `O consentimento do banco vence em ${days} dia${days === 1 ? "" : "s"}.` };
  }
  if (m.pluggy_connections > 0 && m.last_sync_at) {
    const hours = (now.getTime() - new Date(m.last_sync_at).getTime()) / 3_600_000;
    if (hours > 48) return { level: "attention", message: "Sem sincronizar há mais de 2 dias." };
  }
  return { level: "ok", message: "Tudo certo." };
}
