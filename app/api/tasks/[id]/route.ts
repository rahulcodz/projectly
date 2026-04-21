import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Task, { TASK_STATUSES, TASK_STATUS_LABELS } from "@/models/Task";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { getProjectForSession, canManageProject } from "@/lib/project-access";
import { fieldError, validationResponse } from "@/lib/api-errors";
import { sanitizeRichHtml } from "@/lib/sanitize";
import {
  getAppUrl,
  sendTaskAssignedEmail,
  sendTaskUnassignedEmail,
} from "@/lib/mailer";

const subtaskSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1, "Subtask title required"),
  completed: z.boolean().default(false),
});

const updateSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").optional(),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assignees: z.array(z.string()).optional(),
  reportingPersons: z.array(z.string()).optional(),
  subtasks: z.array(subtaskSchema).optional(),
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
    const isAssignee = (task.assignees ?? []).some(
      (a) => String(a) === session.sub
    );

    const requested = Object.keys(parsed.data);
    const collaborativeOnly = requested.every(
      (k) => k === "subtasks" || k === "status"
    );
    const canCollaborate = isAssignee || isCreator || canManageProject(session);

    if (collaborativeOnly) {
      if (!canCollaborate) {
        return NextResponse.json(
          { error: "You do not have access to this task" },
          { status: 403 }
        );
      }
    } else if (!isCreator && !canManageProject(session)) {
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

    const nextSubtasks =
      parsed.data.subtasks !== undefined
        ? parsed.data.subtasks
        : ((task.subtasks ?? []) as Array<{ title: string; completed: boolean }>);

    if (parsed.data.subtasks !== undefined) {
      update.subtasks = parsed.data.subtasks.map((s) => ({
        ...(s._id && isValidId(s._id)
          ? { _id: new mongoose.Types.ObjectId(s._id) }
          : {}),
        title: s.title,
        completed: s.completed,
      }));
    }

    if (parsed.data.status !== undefined) {
      if (parsed.data.status === "done" && nextSubtasks.length > 0) {
        const allDone = nextSubtasks.every((s) => s.completed);
        if (!allDone) {
          return NextResponse.json(
            { error: "Complete all subtasks before marking task done" },
            { status: 400 }
          );
        }
      }
      update.status = parsed.data.status;
    }

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

    const prevAssignees = new Set(
      (task.assignees ?? []).map((x) => String(x))
    );
    const prevReporting = new Set(
      (task.reportingPersons ?? []).map((x) => String(x))
    );

    const updated = await Task.findByIdAndUpdate(id, update, { new: true })
      .populate("createdBy", "name email role")
      .populate("assignees", "name email role")
      .populate("reportingPersons", "name email role")
      .populate({ path: "project", select: "name projectId" })
      .lean();

    // Diff assignees + reporting, email recipients.
    if (updated) {
      try {
        type U = { _id: unknown; name: string; email: string };

        const addedAss: string[] = [];
        const removedAss: string[] = [];
        if (parsed.data.assignees !== undefined) {
          const next = new Set(parsed.data.assignees);
          for (const u of next)
            if (!prevAssignees.has(u)) addedAss.push(u);
          for (const u of prevAssignees)
            if (!next.has(u)) removedAss.push(u);
        }

        const addedRep: string[] = [];
        const removedRep: string[] = [];
        if (parsed.data.reportingPersons !== undefined) {
          const next = new Set(parsed.data.reportingPersons);
          for (const u of next)
            if (!prevReporting.has(u)) addedRep.push(u);
          for (const u of prevReporting)
            if (!next.has(u)) removedRep.push(u);
        }

        const allIds = Array.from(
          new Set(
            [...addedAss, ...removedAss, ...addedRep, ...removedRep].filter(
              Boolean
            )
          )
        );

        if (allIds.length > 0) {
          const users = await User.find({ _id: { $in: allIds } })
            .select("name email")
            .lean();
          const byId = new Map(users.map((u) => [String(u._id), u]));

          const proj = updated.project as unknown as {
            _id: unknown;
            name: string;
            projectId: string;
          } | null;
          if (proj) {
            const taskUrl = `${getAppUrl()}/dashboard/projects/${String(
              proj._id
            )}?task=${String(updated._id)}`;
            const taskMeta = {
              title: updated.title,
              status:
                TASK_STATUS_LABELS[updated.status] ?? updated.status,
            };
            const projectMeta = {
              _id: String(proj._id),
              name: proj.name,
              projectId: proj.projectId,
            };

            const tasks: Promise<unknown>[] = [];
            const pushAssigned = (
              uid: string,
              role: "assignee" | "reportingPerson"
            ) => {
              if (uid === session.sub) return;
              const u = byId.get(uid) as U | undefined;
              if (!u) return;
              tasks.push(
                sendTaskAssignedEmail({
                  to: u.email,
                  recipientName: u.name,
                  actorName: session.name,
                  task: taskMeta,
                  project: projectMeta,
                  taskUrl,
                  role,
                })
              );
            };
            const pushUnassigned = (
              uid: string,
              role: "assignee" | "reportingPerson"
            ) => {
              if (uid === session.sub) return;
              const u = byId.get(uid) as U | undefined;
              if (!u) return;
              tasks.push(
                sendTaskUnassignedEmail({
                  to: u.email,
                  recipientName: u.name,
                  actorName: session.name,
                  task: taskMeta,
                  project: projectMeta,
                  taskUrl,
                  role,
                })
              );
            };
            addedAss.forEach((u) => pushAssigned(u, "assignee"));
            removedAss.forEach((u) => pushUnassigned(u, "assignee"));
            addedRep.forEach((u) => pushAssigned(u, "reportingPerson"));
            removedRep.forEach((u) =>
              pushUnassigned(u, "reportingPerson")
            );

            Promise.allSettled(tasks).catch(() => {});
          }
        }
      } catch {
        // swallow
      }
    }

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
