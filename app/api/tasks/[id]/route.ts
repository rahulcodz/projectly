import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Task, { TASK_STATUSES } from "@/models/Task";
import { getSession } from "@/lib/auth";
import { getProjectForSession, canManageProject } from "@/lib/project-access";
import { fieldError, validationResponse } from "@/lib/api-errors";
import { sanitizeRichHtml } from "@/lib/sanitize";

const updateSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assignees: z.array(z.string()).optional(),
  reportingPersons: z.array(z.string()).optional(),
});

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function loadTaskWithAccess(taskId: string, session: Awaited<ReturnType<typeof getSession>>) {
  if (!session || !isValidId(taskId)) return null;
  await connectDB();
  const task = await Task.findById(taskId);
  if (!task) return null;
  const project = await getProjectForSession(String(task.project), session);
  if (!project) return null;
  return { task, project };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const access = await loadTaskWithAccess(id, session);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const populated = await Task.findById(id)
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .populate({ path: "project", select: "name projectId" })
      .lean();

    return NextResponse.json({ task: populated });
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

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    if (parsed.data.assignees) {
      for (const uid of parsed.data.assignees) {
        if (!isValidId(uid)) return fieldError("assignees", "Invalid user id");
      }
    }
    if (parsed.data.reportingPersons) {
      for (const uid of parsed.data.reportingPersons) {
        if (!isValidId(uid)) return fieldError("reportingPersons", "Invalid user id");
      }
    }

    const access = await loadTaskWithAccess(id, session);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { task } = access;
    const isCreator = String(task.createdBy) === session.sub;
    if (!isCreator && !canManageProject(session)) {
      return NextResponse.json(
        { error: "Only the task creator, admins, or project managers can edit" },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) update.title = parsed.data.title;
    if (parsed.data.description !== undefined) {
      update.description = sanitizeRichHtml(parsed.data.description);
    }
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.assignees !== undefined) {
      update.assignees = parsed.data.assignees.map(
        (x) => new mongoose.Types.ObjectId(x)
      );
    }
    if (parsed.data.reportingPersons !== undefined) {
      update.reportingPersons = parsed.data.reportingPersons.map(
        (x) => new mongoose.Types.ObjectId(x)
      );
    }

    const updated = await Task.findByIdAndUpdate(id, update, { new: true })
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .populate({ path: "project", select: "name projectId" })
      .lean();

    return NextResponse.json({ task: updated });
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
  try {
    const access = await loadTaskWithAccess(id, session);
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { task } = access;
    const isCreator = String(task.createdBy) === session.sub;
    if (!isCreator && !canManageProject(session)) {
      return NextResponse.json(
        { error: "Only the task creator, admins, or project managers can delete" },
        { status: 403 }
      );
    }

    await Task.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
