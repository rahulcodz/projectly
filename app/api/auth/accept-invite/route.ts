export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { verifyInviteToken } from "@/lib/invite-token";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { validationResponse } from "@/lib/api-errors";

const acceptSchema = z.object({
  token: z.string().min(1, "Missing token"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    const payload = await verifyInviteToken(parsed.data.token);
    if (!payload) {
      return NextResponse.json(
        { error: "Invite link is invalid or has expired" },
        { status: 400 }
      );
    }

    await connectDB();
    const user = await User.findById(payload.sub).select("+password");
    if (!user) {
      return NextResponse.json(
        { error: "Account no longer exists" },
        { status: 404 }
      );
    }

    user.password = parsed.data.password; // Pre-save hook hashes it.
    if (user.status === "inactive") user.status = "active";
    await user.save();

    const sessionToken = await createSessionToken({
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await setSessionCookie(sessionToken);

    return NextResponse.json({
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
