export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Task, { TASK_STATUSES, TASK_STATUS_LABELS } from "@/models/Task";
import { getSession } from "@/lib/auth";
import { getProjectForSession } from "@/lib/project-access";
import { fieldError, validationResponse } from "@/lib/api-errors";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { getAppUrl, sendTaskAssignedEmail } from "@/lib/mailer";

const createSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().default(""),
  status: z.enum(TASK_STATUSES).default("todo"),
  assignees: z.array(z.string()).default([]),
  reportingPersons: z.array(z.string()).default([]),
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
  try {
    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const tasks = await Task.find({ project: project._id })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .lean();

    return NextResponse.json({ tasks });
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

    for (const uid of [...parsed.data.assignees, ...parsed.data.reportingPersons]) {
      if (!isValidId(uid)) return fieldError("assignees", "Invalid user id");
    }

    await connectDB();
    const project = await getProjectForSession(id, session);
    if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const description = sanitizeRichHtml(parsed.data.description);

    const task = await Task.create({
      project: project._id,
      title: parsed.data.title,
      description,
      status: parsed.data.status,
      createdBy: new mongoose.Types.ObjectId(session.sub),
      assignees: parsed.data.assignees.map(
        (x) => new mongoose.Types.ObjectId(x)
      ),
      reportingPersons: parsed.data.reportingPersons.map(
        (x) => new mongoose.Types.ObjectId(x)
      ),
    });

    const populated = await Task.findById(task._id)
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .lean();

    if (populated) {
      try {
        const taskUrl = `${getAppUrl()}/dashboard/projects/${String(
          project._id
        )}?task=${String(populated._id)}`;
        const projectMeta = {
          _id: String(project._id),
          name: project.name,
          projectId: project.projectId,
        };
        const taskMeta = {
          title: populated.title,
          status: TASK_STATUS_LABELS[populated.status] ?? populated.status,
        };
        type U = { _id: unknown; name: string; email: string };
        const recipients: {
          user: U;
          role: "assignee" | "reportingPerson";
        }[] = [];
        for (const u of (populated.assignees ?? []) as unknown as U[]) {
          if (u && String(u._id) !== session.sub) {
            recipients.push({ user: u, role: "assignee" });
          }
        }
        for (const u of (populated.reportingPersons ??
          []) as unknown as U[]) {
          if (u && String(u._id) !== session.sub) {
            recipients.push({ user: u, role: "reportingPerson" });
          }
        }

        Promise.allSettled(
          recipients.map((r) =>
            sendTaskAssignedEmail({
              to: r.user.email,
              recipientName: r.user.name,
              actorName: session.name,
              task: taskMeta,
              project: projectMeta,
              taskUrl,
              role: r.role,
            })
          )
        ).catch(() => {});
      } catch {
        // swallow mail errors
      }
    }

    return NextResponse.json({ task: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

