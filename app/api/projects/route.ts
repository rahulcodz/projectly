import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import { nextSeq, peekSeq } from "@/models/Counter";
import { getSession } from "@/lib/auth";
import { fieldError, validationResponse } from "@/lib/api-errors";

const createSchema = z.object({
  name: z.string().min(2, "Project name must be at least 2 characters"),
  status: z.enum(["active", "inactive"]).default("active"),
  reportingTo: z.string().min(1, "Reporting person is required"),
  assignees: z.array(z.string()).default([]),
});

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const status = searchParams.get("status") ?? "all";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "10") || 10)
    );
    const peek = searchParams.get("peekId") === "1";

    if (peek) {
      const n = await peekSeq("projectId");
      return NextResponse.json({ nextId: pad4(n) });
    }

    const filter: Record<string, unknown> = {};

    if (session.role === "user") {
      filter.assignees = new mongoose.Types.ObjectId(session.sub);
    }

    if (status === "active" || status === "inactive") {
      filter.status = status;
    }

    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { projectId: rx }];
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "name email role")
        .populate("reportingTo", "name email role")
        .populate("assignees", "name email role")
        .lean(),
      Project.countDocuments(filter),
    ]);

    return NextResponse.json({
      projects,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "project_manager") {
    return NextResponse.json(
      { error: "Only admins and project managers can create projects" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationResponse(parsed.error);

    if (!isValidId(parsed.data.reportingTo)) {
      return fieldError("reportingTo", "Invalid reporting person");
    }
    for (const id of parsed.data.assignees) {
      if (!isValidId(id)) {
        return fieldError("assignees", "Invalid assignee");
      }
    }

    await connectDB();

    const seq = await nextSeq("projectId");
    const projectId = pad4(seq);

    const created = await Project.create({
      projectId,
      name: parsed.data.name,
      status: parsed.data.status,
      createdBy: new mongoose.Types.ObjectId(session.sub),
      reportingTo: new mongoose.Types.ObjectId(parsed.data.reportingTo),
      assignees: parsed.data.assignees.map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    });

    const populated = await Project.findById(created._id)
      .populate("createdBy", "name email role")
      .populate("reportingTo", "name email role")
      .populate("assignees", "name email role")
      .lean();

    return NextResponse.json({ project: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
