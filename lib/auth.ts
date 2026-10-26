import type { UserRole } from "@/lib/roles";
import {
  SESSION_COOKIE,
  type SessionPayload,
  createSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/session";

export async function getSession(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  try {
    const { connectDB } = await import("@/lib/mongodb");
    const User = (await import("@/models/User")).default;
    await connectDB();
    const fresh = await User.findById(payload.sub)
      .select("name email role status")
      .lean();
    if (!fresh || fresh.status === "inactive") {
      return null;
    }
    const drifted =
      fresh.role !== payload.role ||
      fresh.name !== payload.name ||
      fresh.email !== payload.email;
    if (drifted) {
      const refreshed: SessionPayload = {
        ...payload,
        name: fresh.name,
        email: fresh.email,
        role: fresh.role as UserRole,
      };
      try {
        const newToken = await createSessionToken({
          sub: payload.sub,
          email: fresh.email,
          name: fresh.name,
          role: fresh.role as UserRole,
        });
        await setSessionCookie(newToken);
      } catch {
        // cookie can't be set in some contexts (e.g. RSC reads); fall through
      }
      return refreshed;
    }
    return payload;
  } catch {
    return payload;
  }
}

export {
  SESSION_COOKIE,
  type SessionPayload,
  createSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
};
