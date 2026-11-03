import { checkOrigin, dbRpc, hashCode, newCode, ownerEmail, requiredEnv, sendJson, validEmail } from "../lib/auth";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
  try {
    if (!checkOrigin(req)) return sendJson(res, 403, { error: "Request origin not allowed" });
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!validEmail(email) || email !== ownerEmail()) {
      return sendJson(res, 200, { ok: true, message: "If the address is authorised, a code will be sent." });
    }

    const code = newCode();
    const accepted = await dbRpc<boolean>("vmconnect_issue_code", {
      p_code_hash: hashCode(code),
      p_now: new Date().toISOString(),
    });
    if (!accepted) return sendJson(res, 429, { error: "Please wait before requesting another code." });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "VMConnect <onboarding@resend.dev>",
        to: [email],
        subject: "Your VMConnect sign-in code",
        text: `Your VMConnect verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      }),
    });
    if (!response.ok) {
      console.error("Resend rejected verification email", response.status);
      return sendJson(res, 502, { error: "Email delivery is not available yet. Please try again later." });
    }
    return sendJson(res, 200, { ok: true, message: "If the address is authorised, a code will be sent." });
  } catch (error) {
    console.error("send-code failed", error instanceof Error ? error.message : "unknown");
    return sendJson(res, 503, { error: "Sign-in is temporarily unavailable." });
  }
}
