import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const INVITE_MAX_AGE_HOURS = 48;
export const INVITE_EXPIRES_HOURS = INVITE_MAX_AGE_HOURS;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET. Add a long random string to .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export type InvitePayload = JWTPayload & {
  sub: string;
  email: string;
  name: string;
  type: "invite";
};

export async function createInviteToken(payload: {
  sub: string;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({ ...payload, type: "invite" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${INVITE_MAX_AGE_HOURS}h`)
    .sign(getSecretKey());
}

export async function verifyInviteToken(
  token: string
): Promise<InvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if ((payload as InvitePayload).type !== "invite") return null;
    return payload as InvitePayload;
  } catch {
    return null;
  }
}
