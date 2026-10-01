// Criptografia das credenciais Pluggy de cada usuário (AES-GCM 256).
// Módulo puro com WebCrypto: roda no Deno (Edge Functions) e no Node (testes).

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const buffer = new ArrayBuffer(s.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return buffer;
}

/**
 * Deriva a chave de criptografia de um segredo do servidor (HKDF-SHA256).
 * Mudar o segredo torna as credenciais salvas ilegíveis (a pessoa cadastra de novo).
 */
export async function deriveKey(serverSecret: string): Promise<CryptoKey> {
  if (!serverSecret || serverSecret.length < 16) throw new Error("Segredo do servidor ausente ou curto demais");
  const material = await crypto.subtle.importKey("raw", enc.encode(serverSecret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("nexos-pluggy-credentials"), info: enc.encode("v1") },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** `aad` amarra o texto cifrado ao dono: copiar a linha para outro usuário faz a decifragem falhar. */
export async function encryptText(key: CryptoKey, plain: string, aad: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, enc.encode(plain));
  return { ciphertext: toBase64(new Uint8Array(data)), iv: toBase64(iv) };
}

export async function decryptText(key: CryptoKey, ciphertext: string, iv: string, aad: string): Promise<string> {
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv), additionalData: enc.encode(aad) },
    key,
    fromBase64(ciphertext),
  );
  return dec.decode(data);
}

/** "abcd1234-...-9f0e" -> "••••9f0e": para mostrar qual credencial está em uso sem expô-la. */
export function maskId(id: string): string {
  return id.length <= 4 ? "••••" : `••••${id.slice(-4)}`;
}
