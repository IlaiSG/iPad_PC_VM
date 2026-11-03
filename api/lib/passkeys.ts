import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  dbRpc,
  ownerEmail,
  readTrustedDeviceId,
  requiredEnv,
  sendJson,
  verifySession,
} from "./auth.js";

export function rpConfig() {
  const origin = requiredEnv("APP_ORIGIN").replace(/\/$/, "");
  return { origin, rpID: new URL(origin).hostname, rpName: "VMConnect" };
}

export async function requireTrustedDevice(req: any, res: any): Promise<string | null> {
  if (!verifySession(req.cookies?.vmc_session ?? readCookieFallback(req, "vmc_session"))) {
    sendJson(res, 401, { error: "Please verify your email address first." });
    return null;
  }
  const deviceId = readTrustedDeviceId(req);
  if (!deviceId) {
    sendJson(res, 401, { error: "This device has not been trusted. Verify your email to continue." });
    return null;
  }
  const trusted = await dbRpc<boolean>("vmconnect_device_is_trusted", {
    p_device_id: deviceId,
    p_now: new Date().toISOString(),
  });
  if (!trusted) {
    sendJson(res, 401, { error: "This device has not been trusted. Verify your email to continue." });
    return null;
  }
  return deviceId;
}

function readCookieFallback(req: any, name: string): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== "string") return undefined;
  const item = header.split(";").map((part: string) => part.trim()).find((part: string) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
}

export async function createRegistrationOptions(deviceId: string) {
  const { rpID, rpName } = rpConfig();
  const passkeys = await dbRpc<any[]>("vmconnect_list_passkeys", { p_device_id: deviceId });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from("vmconnect-owner", "utf8")),
    userName: ownerEmail(),
    attestationType: "none",
    excludeCredentials: (passkeys || []).map((item) => ({
      id: item.credential_id,
      transports: item.transports || [],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });
  const saved = await dbRpc<boolean>("vmconnect_save_challenge", {
    p_purpose: "registration",
    p_device_id: deviceId,
    p_challenge: options.challenge,
    p_now: new Date().toISOString(),
  });
  if (!saved) throw new Error("Could not save the registration challenge.");
  return options;
}

export async function verifyAndSaveRegistration(deviceId: string, response: any) {
  const challenge = await dbRpc<string | null>("vmconnect_take_challenge", {
    p_purpose: "registration",
    p_device_id: deviceId,
    p_now: new Date().toISOString(),
  });
  if (!challenge) throw new Error("The registration request has expired. Please try again.");
  const { origin, rpID } = rpConfig();
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration could not be verified.");
  }
  const info: any = verification.registrationInfo;
  const credential = info.credential;
  const saved = await dbRpc<boolean>("vmconnect_save_passkey", {
    p_credential_id: credential.id,
    p_device_id: deviceId,
    p_public_key: Buffer.from(credential.publicKey).toString("base64url"),
    p_counter: credential.counter,
    p_transports: credential.transports || [],
    p_device_type: info.credentialDeviceType,
    p_backed_up: info.credentialBackedUp,
  });
  if (!saved) throw new Error("This passkey is already registered or could not be saved.");
  return true;
}

export async function createAuthenticationOptions(deviceId: string) {
  const { rpID } = rpConfig();
  const passkeys = await dbRpc<any[]>("vmconnect_list_passkeys", { p_device_id: deviceId });
  if (!passkeys?.length) throw new Error("No passkey is registered on this trusted device. Verify your email first.");
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((item) => ({
      id: item.credential_id,
      transports: item.transports || [],
    })),
    userVerification: "required",
  });
  const saved = await dbRpc<boolean>("vmconnect_save_challenge", {
    p_purpose: "authentication",
    p_device_id: deviceId,
    p_challenge: options.challenge,
    p_now: new Date().toISOString(),
  });
  if (!saved) throw new Error("Could not save the authentication challenge.");
  return options;
}

export async function verifyPasskeyAuthentication(deviceId: string, response: any) {
  const challenge = await dbRpc<string | null>("vmconnect_take_challenge", {
    p_purpose: "authentication",
    p_device_id: deviceId,
    p_now: new Date().toISOString(),
  });
  if (!challenge) throw new Error("The sign-in request has expired. Please try again.");
  const passkey = await dbRpc<any>("vmconnect_get_passkey", {
    p_credential_id: response?.id,
    p_device_id: deviceId,
  });
  if (!passkey) throw new Error("This passkey is not registered to this trusted device.");
  const { origin, rpID } = rpConfig();
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credential_id,
      publicKey: new Uint8Array(Buffer.from(passkey.public_key, "base64url")),
      counter: Number(passkey.counter),
      transports: passkey.transports || [],
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new Error("Passkey sign-in could not be verified.");
  await dbRpc<boolean>("vmconnect_update_passkey_counter", {
    p_credential_id: passkey.credential_id,
    p_device_id: deviceId,
    p_counter: verification.authenticationInfo.newCounter,
    p_now: new Date().toISOString(),
  });
  return true;
}
