export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Comment from "@/models/Comment";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { canManageProject } from "@/lib/project-access";
import { sanitizeRichHtml, stripHtml } from "@/lib/sanitize";
import { validationResponse } from "@/lib/api-errors";

const updateSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
});

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    await connectDB();
    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.kind === "system") {
      return NextResponse.json(
        { error: "System entries can't be edited" },
        { status: 400 }
      );
    }
    const isAuthor = String(comment.author) === session.sub;
    if (!isAuthor && !canManageProject(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sanitized = sanitizeRichHtml(parsed.data.body);
    if (stripHtml(sanitized).length === 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fieldErrors: { body: "Comment cannot be empty" },
        },
        { status: 400 }
      );
    }

    comment.body = sanitized;
    await comment.save();

    const raw = await Comment.findById(id).lean();
    let author:
      | { _id: unknown; name: string; email: string; role: string }
      | null = null;
    if (raw?.author) {
      const u = await User.findById(raw.author)
        .select("name email role")
        .lean();
      if (u)
        author = {
          _id: (u as { _id: unknown })._id,
          name: (u as { name: string }).name,
          email: (u as { email: string }).email,
          role: (u as { role: string }).role,
        };
    }
    return NextResponse.json({
      comment: raw ? { ...raw, author: author ?? null } : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  try {
    await connectDB();
    const comment = await Comment.findById(id);
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const isAuthor = String(comment.author) === session.sub;
    if (!isAuthor && !canManageProject(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Comment.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
