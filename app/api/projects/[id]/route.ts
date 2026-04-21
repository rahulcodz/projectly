import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import User from "@/models/User";
import { getSession } from "@/lib/auth";
import { fieldError, validationResponse } from "@/lib/api-errors";
import {
  getAppUrl,
  sendProjectAssignedEmail,
  sendProjectUnassignedEmail,
} from "@/lib/mailer";

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
      const reportingToId = project.reportingTo
        ? String(
            (project.reportingTo as unknown as { _id: unknown })._id ??
              project.reportingTo
          )
        : null;
      const isAssignee = assigneeIds.includes(session.sub);
      const isReportingTo = reportingToId === session.sub;
      if (!isAssignee && !isReportingTo) {
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

    const prev = await Project.findById(id).lean();
    if (!prev) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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

    // Diff assignees + reportingTo, email recipients.
    try {
      const prevAssignees = new Set(
        (prev.assignees ?? []).map((a) => String(a))
      );
      const nextAssigneesArr = parsed.data.assignees ?? null;
      const nextAssignees = nextAssigneesArr
        ? new Set(nextAssigneesArr)
        : prevAssignees;

      const addedAssignees: string[] = [];
      const removedAssignees: string[] = [];
      if (nextAssigneesArr) {
        for (const id of nextAssignees)
          if (!prevAssignees.has(id)) addedAssignees.push(id);
        for (const id of prevAssignees)
          if (!nextAssignees.has(id)) removedAssignees.push(id);
      }

      const prevRt = prev.reportingTo ? String(prev.reportingTo) : null;
      const nextRt =
        parsed.data.reportingTo !== undefined
          ? parsed.data.reportingTo
          : prevRt;
      const rtAdded = nextRt && nextRt !== prevRt ? nextRt : null;
      const rtRemoved = prevRt && prevRt !== nextRt ? prevRt : null;

      const ids = Array.from(
        new Set(
          [...addedAssignees, ...removedAssignees, rtAdded, rtRemoved].filter(
            Boolean
          ) as string[]
        )
      );

      if (ids.length > 0) {
        const users = await User.find({ _id: { $in: ids } })
          .select("name email")
          .lean();
        const byId = new Map(users.map((u) => [String(u._id), u]));

        const projectUrl = `${getAppUrl()}/dashboard/projects/${String(
          project._id
        )}`;
        const projectMeta = {
          name: project.name,
          projectId: project.projectId,
          status: project.status,
        };
        const actorName = session.name;

        const tasks: Promise<unknown>[] = [];

        for (const uid of addedAssignees) {
          if (uid === session.sub) continue;
          const u = byId.get(uid);
          if (!u) continue;
          tasks.push(
            sendProjectAssignedEmail({
              to: u.email,
              recipientName: u.name,
              actorName,
              project: projectMeta,
              projectUrl,
              role: "assignee",
            })
          );
        }
        for (const uid of removedAssignees) {
          if (uid === session.sub) continue;
          const u = byId.get(uid);
          if (!u) continue;
          tasks.push(
            sendProjectUnassignedEmail({
              to: u.email,
              recipientName: u.name,
              actorName,
              project: projectMeta,
              projectUrl,
              role: "assignee",
            })
          );
        }
        if (rtAdded && rtAdded !== session.sub) {
          const u = byId.get(rtAdded);
          if (u) {
            tasks.push(
              sendProjectAssignedEmail({
                to: u.email,
                recipientName: u.name,
                actorName,
                project: projectMeta,
                projectUrl,
                role: "reportingTo",
              })
            );
          }
        }
        if (rtRemoved && rtRemoved !== session.sub) {
          const u = byId.get(rtRemoved);
          if (u) {
            tasks.push(
              sendProjectUnassignedEmail({
                to: u.email,
                recipientName: u.name,
                actorName,
                project: projectMeta,
                projectUrl,
                role: "reportingTo",
              })
            );
          }
        }

        Promise.allSettled(tasks).catch(() => {});
      }
    } catch {
      // swallow mail diff errors
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
