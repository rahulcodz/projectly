export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Comment from "@/models/Comment";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";
import { validationResponse } from "@/lib/api-errors";
import { sanitizeRichHtml, stripHtml } from "@/lib/sanitize";

const createSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const comments = await Comment.find({ project: project._id })
      .sort({ createdAt: 1 })
      .populate("author", "name email role")
      .lean();

    return NextResponse.json({ comments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

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

    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const comment = await Comment.create({
      project: project._id,
      author: new mongoose.Types.ObjectId(session.sub),
      body: sanitized,
    });

    const populated = await Comment.findById(comment._id)
      .populate("author", "name email role")
      .lean();

    return NextResponse.json({ comment: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
