import { checkOrigin, createSession, dbRpc, hashCode, ownerEmail, sendJson, setSessionCookie, validEmail } from "../lib/auth.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!validEmail(email) || email !== ownerEmail() || !/^\d{6}$/.test(code)) {
      return sendJson(res, 400, { error: "The code is invalid or has expired." });
    }

    const accepted = await dbRpc<boolean>("vmconnect_consume_code", {
      p_code_hash: hashCode(code),
      p_now: new Date().toISOString(),
    });
    if (!accepted) return sendJson(res, 400, { error: "The code is invalid or has expired." });

    setSessionCookie(res, createSession(email));
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("verify-code failed", error instanceof Error ? error.message : "unknown");
    return sendJson(res, 503, { error: "Sign-in is temporarily unavailable." });
  }
}
