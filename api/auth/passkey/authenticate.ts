import { checkOrigin, createSession, ownerEmail, sendJson, setSessionCookie } from "../../lib/auth.js";
import { requireTrustedDevice, verifyPasskeyAuthentication } from "../../lib/passkeys.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
    const deviceId = await requireTrustedDevice(req, res, false);
    if (!deviceId) return;
    await verifyPasskeyAuthentication(deviceId, req.body);
    setSessionCookie(res, createSession(ownerEmail()));
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("passkey authenticate failed", error instanceof Error ? error.message : "unknown");
    return sendJson(res, 401, { error: error instanceof Error ? error.message : "Passkey sign-in failed." });
  }
}
