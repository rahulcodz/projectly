export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { getSession } from "@/lib/auth";
import { registerModels } from "@/lib/register-models";

registerModels();

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = req.nextUrl;
    const unreadOnly = searchParams.get("unreadOnly") === "1";
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "20") || 20)
    );
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

    const recipient = new mongoose.Types.ObjectId(session.sub);
    const filter: Record<string, unknown> = { recipient };
    if (unreadOnly) filter.read = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("actor", "name email role")
        .populate("project", "name projectId")
        .populate("task", "title taskId")
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient, read: false }),
    ]);

    return NextResponse.json({
      notifications: items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
