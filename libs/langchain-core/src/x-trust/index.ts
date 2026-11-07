/**
 * X-Trust — Human presence attestation for LangChain
 * Zero KYC, Zero PII. Annotate, never block.
 * https://github.com/htl-syterme/htl-core
 */

export interface XTrustPayload {
  sub: string;
  score: number;
  iat: number;
  exp: number;
}

export interface XTrustResult {
  trusted: boolean;
  score: number;
  annotated: boolean;
}

function b64urlToBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyXTrust(token: string, secret: string): Promise<XTrustPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payloadB64, sigB64] = parts;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sigB64), new TextEncoder().encode(payloadB64));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64))) as XTrustPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.score < 0 || payload.score > 1) return null;
    if (now > payload.exp || now - payload.iat > 120) return null;
    return payload;
  } catch { return null; }
}

export async function requireXTrust(
  headers: Record<string, string | undefined>,
  secret: string,
  minScore = 0
): Promise<XTrustResult> {
  const token = headers["x-trust"] ?? "";
  if (!token) return { trusted: false, score: 0, annotated: true };
  const payload = await verifyXTrust(token, secret);
  if (!payload) return { trusted: false, score: 0, annotated: true };
  return { trusted: payload.score >= minScore, score: payload.score, annotated: true };
                       }
