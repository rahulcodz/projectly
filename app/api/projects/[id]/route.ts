import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import { getSession } from "@/lib/auth";
import { fieldError, validationResponse } from "@/lib/api-errors";

const updateSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters").optional(),
  status: z.enum(["active", "inactive"]).optional(),
  reportingTo: z.string().optional(),
  assignees: z.array(z.string()).optional(),
});

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  try {
    await connectDB();
    const project = await Project.findById(id)
      .populate("createdBy", "name email role")
      .populate("reportingTo", "name email role")
      .populate("assignees", "name email role")
      .lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (session.role === "user") {
      const assigneeIds = (project.assignees ?? []).map((a) =>
        String((a as unknown as { _id: unknown })._id ?? a)
      );
      if (!assigneeIds.includes(session.sub)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "project_manager") {
    return NextResponse.json(
      { error: "Only admins and project managers can edit projects" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    if (parsed.data.reportingTo && !isValidId(parsed.data.reportingTo)) {
      return fieldError("reportingTo", "Invalid reporting person");
    }
    if (parsed.data.assignees) {
      for (const a of parsed.data.assignees) {
        if (!isValidId(a)) return fieldError("assignees", "Invalid assignee");
      }
    }

    await connectDB();

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.reportingTo !== undefined)
      update.reportingTo = new mongoose.Types.ObjectId(parsed.data.reportingTo);
    if (parsed.data.assignees !== undefined)
      update.assignees = parsed.data.assignees.map(
        (x) => new mongoose.Types.ObjectId(x)
      );

    const project = await Project.findByIdAndUpdate(id, update, { new: true })
      .populate("createdBy", "name email role")
      .populate("reportingTo", "name email role")
      .populate("assignees", "name email role")
      .lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
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
  if (session.role !== "admin" && session.role !== "project_manager") {
    return NextResponse.json(
      { error: "Only admins and project managers can delete projects" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  try {
    await connectDB();
    const deleted = await Project.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
