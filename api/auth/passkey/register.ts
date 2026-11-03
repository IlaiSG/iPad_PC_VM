import { checkOrigin, sendJson } from "../../lib/auth.js";
import { requireTrustedDevice, verifyAndSaveRegistration } from "../../lib/passkeys.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
    const deviceId = await requireTrustedDevice(req, res, true);
    if (!deviceId) return;
    await verifyAndSaveRegistration(deviceId, req.body);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("passkey register failed", error instanceof Error ? error.message : "unknown");
    return sendJson(res, 400, { error: error instanceof Error ? error.message : "Passkey registration failed." });
  }
}
