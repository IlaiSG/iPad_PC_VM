import { checkOrigin, sendJson } from "../../lib/auth.js";
import { createAuthenticationOptions, requireTrustedDevice } from "../../lib/passkeys.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
    const deviceId = await requireTrustedDevice(req, res, false);
    if (!deviceId) return;
    const options = await createAuthenticationOptions(deviceId);
    return sendJson(res, 200, options as any);
  } catch (error) {
    console.error("passkey options failed", error instanceof Error ? error.message : "unknown");
    return sendJson(res, 401, { error: error instanceof Error ? error.message : "Passkey sign-in is unavailable on this device. Verify your email first." });
  }
}
