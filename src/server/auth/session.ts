const SESSION_COOKIE_NAME = "bw_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  email: string;
  exp: number;
};

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Falta AUTH_SESSION_SECRET en variables de entorno.");
  }
  return secret;
}

function encodeBase64Url(input: Uint8Array): string {
  const binary = Array.from(input)
    .map((byte) => String.fromCharCode(byte))
    .join("");
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(input).toString("base64");
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return encodeBase64Url(new Uint8Array(signature));
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function createSessionToken(input: { userId: string; email: string }): Promise<string> {
  const payload: SessionPayload = {
    userId: input.userId,
    email: input.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const payloadEncoded = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expected = await sign(payloadEncoded);
  const isValid = safeEqual(decodeBase64Url(signature), decodeBase64Url(expected));
  if (!isValid) {
    return null;
  }

  try {
    const payloadRaw = new TextDecoder().decode(decodeBase64Url(payloadEncoded));
    const payload = JSON.parse(payloadRaw) as SessionPayload;
    if (!payload.userId || !payload.email || !payload.exp) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieConfig() {
  return {
    name: SESSION_COOKIE_NAME,
    maxAge: SESSION_DURATION_SECONDS,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    },
  };
}
