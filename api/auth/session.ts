import { ownerEmail, readCookie, sendJson, verifySession } from "../lib/auth.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    const authenticated = verifySession(readCookie(req, "vmc_session"));
    return sendJson(res, 200, authenticated ? { authenticated: true, email: ownerEmail() } : { authenticated: false });
  } catch {
    return sendJson(res, 200, { authenticated: false });
  }
}
