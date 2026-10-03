// O app publicado fica na Vercel. O login do Lovable Cloud ainda manda os links de e-mail
// (confirmação de cadastro, troca de senha) para o site antigo no lovable.app: quem chega lá
// é levado ao mesmo endereço na Vercel, com o token do link junto (fica no # ou no ?code=).

export const CANONICAL_ORIGIN = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") || "https://nexos-sage.vercel.app";

/** Endereço na Vercel para onde ir, ou null para ficar (Vercel, editor/preview do Lovable, localhost). */
export function canonicalRedirect(loc: { hostname: string; pathname: string; search: string; hash: string }, framed: boolean, canonical = CANONICAL_ORIGIN): string | null {
  if (framed) return null; // dentro do editor do Lovable
  const host = loc.hostname.toLowerCase();
  if (!host.endsWith(".lovable.app")) return null;
  // Prévias do editor: id-preview--<uuid>, preview--<nome>, project--<uuid>
  if (/^(id-preview|preview|project)(-[a-z0-9]+)?--/.test(host)) return null;
  if (new URL(canonical).hostname === host) return null;
  return `${canonical}${loc.pathname}${loc.search}${loc.hash}`;
}
