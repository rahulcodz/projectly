export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { verifyInviteToken } from "@/lib/invite-token";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = await verifyInviteToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Invite link is invalid or has expired" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const user = await User.findById(payload.sub).lean();
    if (!user) {
      return NextResponse.json(
        { error: "Account no longer exists" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
