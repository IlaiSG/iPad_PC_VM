import { checkOrigin, sendJson } from "../../lib/auth.js";
import { createRegistrationOptions, requireTrustedDevice } from "../../lib/passkeys.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
    const deviceId = await requireTrustedDevice(req, res, true);
    if (!deviceId) return;
    const options = await createRegistrationOptions(deviceId);
    return sendJson(res, 200, options as any);
  } catch (error) {
    console.error("passkey register-options failed", error instanceof Error ? error.message : "unknown");
    return sendJson(res, 503, { error: error instanceof Error ? error.message : "Passkey setup is temporarily unavailable." });
  }
}
