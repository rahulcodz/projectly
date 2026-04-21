import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Comment from "@/models/Comment";
import { getSession } from "@/lib/auth";
import { canManageProject } from "@/lib/project-access";

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
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
