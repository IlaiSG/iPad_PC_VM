import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const OWNER_ID = "owner";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function ownerEmail(): string {
  return requiredEnv("VMCONNECT_OWNER_EMAIL").trim().toLowerCase();
}

export function hashCode(code: string): string {
  return createHmac("sha256", requiredEnv("OTP_HASH_SECRET")).update(code).digest("hex");
}

export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function checkOrigin(req: any): boolean {
  const allowed = requiredEnv("APP_ORIGIN").replace(/\/$/, "");
  const origin = req.headers.origin;
  return typeof origin === "string" && origin.replace(/\/$/, "") === allowed;
}

export async function dbRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const base = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error("Database RPC failed", name, response.status);
    throw new Error("Database operation failed");
  }
  return response.json() as Promise<T>;
}

export function createSession(email: string): string {
  const expires = Date.now() + 12 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ email, expires })).toString("base64url");
  const signature = createHmac("sha256", requiredEnv("SESSION_SECRET")).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", requiredEnv("SESSION_SECRET")).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.email === ownerEmail() && Number.isFinite(data.expires) && data.expires > Date.now();
  } catch {
    return false;
  }
}

export function readCookie(req: any, name: string): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== "string") return undefined;
  const item = header.split(";").map((part: string) => part.trim()).find((part: string) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

export function setSessionCookie(res: any, token: string): void {
  res.setHeader("Set-Cookie", `vmc_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`);
}

export function newDeviceId(): string {
  return randomBytes(24).toString("base64url");
}

export function createDeviceToken(deviceId: string): string {
  const signature = createHmac("sha256", requiredEnv("SESSION_SECRET")).update(`device:${deviceId}`).digest("base64url");
  return `${deviceId}.${signature}`;
}

export function readTrustedDeviceId(req: any): string | undefined {
  const token = readCookie(req, "vmc_device");
  if (!token) return undefined;
  const [deviceId, signature, extra] = token.split(".");
  if (!deviceId || !signature || extra) return undefined;
  const expected = createHmac("sha256", requiredEnv("SESSION_SECRET")).update(`device:${deviceId}`).digest("base64url");
  return safeEqual(signature, expected) ? deviceId : undefined;
}

export function setDeviceCookie(res: any, deviceId: string): void {
  res.setHeader("Set-Cookie", [
    `vmc_session=${encodeURIComponent(createSession(ownerEmail()))}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`,
    `vmc_device=${encodeURIComponent(createDeviceToken(deviceId))}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=31536000`,
  ]);
}

export function clearSessionCookie(res: any): void {
  res.setHeader("Set-Cookie", "vmc_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0");
}

export function sendJson(res: any, status: number, body: Record<string, unknown>): void {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
