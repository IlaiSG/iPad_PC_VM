import { checkOrigin, clearSessionCookie, sendJson } from "../lib/auth";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}
