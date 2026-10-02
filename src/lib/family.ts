// Família: links de convite e leitura do estado das conexões de cada membro.

export const PENDING_INVITE_KEY = "nexos:pending-invite";
const PENDING_INVITE_TTL_MS = 7 * 86_400_000;

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const browserStore = (): KeyValueStore | null => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

/**
 * Guarda o convite aberto antes do login. Fica no localStorage (e não só na aba),
 * porque o link de confirmação do e-mail abre o app em outra aba.
 */
export function savePendingInvite(token: string, now = Date.now(), store = browserStore()): void {
  try { store?.setItem(PENDING_INVITE_KEY, JSON.stringify({ token, at: now })); } catch { /* sem armazenamento: abre o link de novo */ }
}

export function readPendingInvite(now = Date.now(), store = browserStore()): string | null {
  try {
    const raw = store?.getItem(PENDING_INVITE_KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) as { token?: string; at?: number };
    if (isInviteToken(token) && typeof at === "number" && now - at < PENDING_INVITE_TTL_MS) return token;
    store?.removeItem(PENDING_INVITE_KEY);
  } catch { /* valor corrompido ou sem acesso */ }
  return null;
}

export function clearPendingInvite(store = browserStore()): void {
  try { store?.removeItem(PENDING_INVITE_KEY); } catch { /* ignore */ }
}

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
