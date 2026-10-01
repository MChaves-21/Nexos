// Credenciais Pluggy por usuário. Quem tiver a própria conta Pluggy (ex.: cada familiar)
// usa a dela; quem não tiver, usa a do app. Só o servidor (service role) lê a tabela.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { decryptText, deriveKey, encryptText } from "./crypto.ts";
import { appCredentials, getPluggyApiKey, type PluggyCredentials } from "./pluggy.ts";
import { isMissingRelation, PublicError } from "./validation.ts";

let keyPromise: Promise<CryptoKey> | null = null;

const MIGRATION_PENDING = new PublicError(
  "O banco ainda não tem a tabela de credenciais. Rode a migração 20261001140000_pluggy_credentials.sql e tente de novo.",
  503,
);

/** Chave de cifragem: PLUGGY_CREDENTIALS_KEY se definido; senão derivada da service role key. */
function credentialsKey(): Promise<CryptoKey> {
  keyPromise ??= deriveKey(Deno.env.get("PLUGGY_CREDENTIALS_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  return keyPromise;
}

export async function getUserCredentials(service: SupabaseClient, userId: string): Promise<PluggyCredentials | null> {
  const { data, error } = await service
    .from("pluggy_credentials")
    .select("client_id, secret_ciphertext, secret_iv")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Migração das credenciais ainda não aplicada: segue com a conta Pluggy do app
    if (isMissingRelation(error)) {
      console.warn("pluggy_credentials ausente; usando a conta Pluggy do app");
      return null;
    }
    throw error;
  }
  if (!data) return null;
  try {
    const clientSecret = await decryptText(await credentialsKey(), data.secret_ciphertext, data.secret_iv, userId);
    return { clientId: data.client_id, clientSecret };
  } catch {
    throw new PublicError("Não foi possível ler as credenciais da Pluggy salvas. Cadastre-as de novo em Conectar banco.", 409);
  }
}

export async function saveUserCredentials(service: SupabaseClient, userId: string, creds: PluggyCredentials): Promise<void> {
  const { ciphertext, iv } = await encryptText(await credentialsKey(), creds.clientSecret, userId);
  const { error } = await service.from("pluggy_credentials").upsert(
    { user_id: userId, client_id: creds.clientId, secret_ciphertext: ciphertext, secret_iv: iv, verified_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (error) {
    if (isMissingRelation(error)) throw MIGRATION_PENDING;
    throw error;
  }
}

export async function deleteUserCredentials(service: SupabaseClient, userId: string): Promise<void> {
  const { error } = await service.from("pluggy_credentials").delete().eq("user_id", userId);
  if (error && !isMissingRelation(error)) throw error;
}

/** Status para a tela: nunca o segredo. Sem a tabela, responde "não configurado". */
export async function getCredentialsStatus(service: SupabaseClient, userId: string): Promise<{ clientId: string; verifiedAt: string } | null> {
  const { data, error } = await service
    .from("pluggy_credentials")
    .select("client_id, verified_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data ? { clientId: data.client_id, verifiedAt: data.verified_at } : null;
}

/** API key da Pluggy para este usuário: a conta dele, se cadastrada; senão a do app. */
export async function getApiKeyForUser(service: SupabaseClient, userId: string): Promise<{ apiKey: string; source: "user" | "app" }> {
  const own = await getUserCredentials(service, userId);
  if (own) return { apiKey: await getPluggyApiKey(own), source: "user" };
  return { apiKey: await getPluggyApiKey(appCredentials()), source: "app" };
}
