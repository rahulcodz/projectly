export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { getSession } from "@/lib/auth";
import { validationResponse } from "@/lib/api-errors";

const schema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    await connectDB();
    const recipient = new mongoose.Types.ObjectId(session.sub);

    if (parsed.data.all) {
      await Notification.updateMany(
        { recipient, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
      return NextResponse.json({ success: true });
    }

    const ids = (parsed.data.ids ?? []).filter((i) =>
      mongoose.Types.ObjectId.isValid(i)
    );
    if (!ids.length) return NextResponse.json({ success: true });

    await Notification.updateMany(
      {
        _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
        recipient,
        read: false,
      },
      { $set: { read: true, readAt: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
