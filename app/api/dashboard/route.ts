import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import Project from "@/models/Project";
import Task, { TASK_STATUSES } from "@/models/Task";
import User from "@/models/User";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    const role = session.role;
    const userObjectId = new mongoose.Types.ObjectId(session.sub);

    if (role === "user") {
      const [
        projectsAssigned,
        tasksTotal,
        statusAgg,
        recentProjects,
        recentTasks,
      ] = await Promise.all([
        Project.countDocuments({ assignees: userObjectId }),
        Task.countDocuments({ assignees: userObjectId }),
        Task.aggregate([
          { $match: { assignees: userObjectId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Project.find({ assignees: userObjectId })
          .sort({ updatedAt: -1 })
          .limit(5)
          .select("name projectId status updatedAt")
          .lean(),
        Task.find({ assignees: userObjectId })
          .sort({ updatedAt: -1 })
          .limit(8)
          .populate({ path: "project", select: "name projectId" })
          .select("title status project updatedAt")
          .lean(),
      ]);

      const statusBreakdown = Object.fromEntries(
        TASK_STATUSES.map((s) => [s, 0])
      ) as Record<string, number>;
      for (const row of statusAgg) {
        statusBreakdown[row._id as string] = row.count as number;
      }

      const doneCount = statusBreakdown.done ?? 0;
      const openCount = tasksTotal - doneCount;

      return NextResponse.json({
        role,
        counts: {
          projects: projectsAssigned,
          tasks: tasksTotal,
          tasksOpen: openCount,
          tasksDone: doneCount,
        },
        statusBreakdown,
        recentProjects,
        recentTasks,
      });
    }

    const [
      projectsTotal,
      projectsActive,
      tasksTotal,
      usersTotal,
      usersActive,
      statusAgg,
      roleAgg,
      recentProjects,
      recentTasks,
      recentUsers,
    ] = await Promise.all([
      Project.countDocuments({}),
      Project.countDocuments({ status: "active" }),
      Task.countDocuments({}),
      User.countDocuments({}),
      User.countDocuments({ status: "active" }),
      Task.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      Project.find({})
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("reportingTo", "name email role")
        .select("name projectId status updatedAt reportingTo assignees")
        .lean(),
      Task.find({})
        .sort({ updatedAt: -1 })
        .limit(8)
        .populate({ path: "project", select: "name projectId" })
        .populate("assignees", "name email role")
        .select("title status project updatedAt assignees")
        .lean(),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email role status createdAt")
        .lean(),
    ]);

    const statusBreakdown = Object.fromEntries(
      TASK_STATUSES.map((s) => [s, 0])
    ) as Record<string, number>;
    for (const row of statusAgg) {
      statusBreakdown[row._id as string] = row.count as number;
    }

    const roleBreakdown: Record<string, number> = {
      admin: 0,
      project_manager: 0,
      user: 0,
    };
    for (const row of roleAgg) {
      roleBreakdown[row._id as string] = row.count as number;
    }

    return NextResponse.json({
      role,
      counts: {
        projects: projectsTotal,
        projectsActive,
        tasks: tasksTotal,
        users: usersTotal,
        usersActive,
      },
      statusBreakdown,
      roleBreakdown,
      recentProjects,
      recentTasks,
      recentUsers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
