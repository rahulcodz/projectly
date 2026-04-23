import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import User from "../models/User";
import Project from "../models/Project";
import Task from "../models/Task";
import Comment from "../models/Comment";

loadEnv({ path: ".env.local" });

async function main() {
  const uri = process.env.MONGODB_URI!;
  if (!uri) throw new Error("Missing MONGODB_URI");

  await mongoose.connect(uri);
  console.log("Connected");

  const users = await User.find({}).select("_id email role").lean();
  if (users.length === 0) {
    console.error("No users in DB — seed an admin first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const validIds = new Set(users.map((u) => String(u._id)));
  const admin =
    users.find((u) => u.role === "admin") ??
    users.find((u) => u.role === "project_manager") ??
    users[0];
  const adminId = new mongoose.Types.ObjectId(String(admin._id));
  console.log(`Fallback user: ${admin.email} (${String(admin._id)})`);

  function isOrphan(id: unknown): boolean {
    if (!id) return false;
    return !validIds.has(String(id));
  }

  let changes = 0;

  // Comments: author
  const comments = await Comment.find({}).lean();
  for (const c of comments) {
    if (isOrphan(c.author)) {
      await Comment.updateOne({ _id: c._id }, { $set: { author: adminId } });
      changes++;
      console.log(`  Comment ${c._id}: author → ${adminId}`);
    }
  }

  // Projects: createdBy, reportingTo, assignees[]
  const projects = await Project.find({}).lean();
  for (const p of projects) {
    const update: Record<string, unknown> = {};
    if (isOrphan(p.createdBy)) update.createdBy = adminId;
    const prevReporting = Array.isArray(p.reportingTo)
      ? p.reportingTo
      : p.reportingTo
      ? [p.reportingTo]
      : [];
    const cleanedReporting = prevReporting.filter((r) => !isOrphan(r));
    const nextReporting =
      cleanedReporting.length > 0 ? cleanedReporting : [adminId];
    const prevReportingKey = JSON.stringify(
      prevReporting.map((r) => String(r))
    );
    const nextReportingKey = JSON.stringify(
      nextReporting.map((r) => String(r))
    );
    if (prevReportingKey !== nextReportingKey) {
      update.reportingTo = nextReporting;
    }
    const assignees = (p.assignees ?? []).map((a) =>
      isOrphan(a) ? adminId : a
    );
    const deduped = Array.from(
      new Map(assignees.map((a) => [String(a), a])).values()
    );
    if (JSON.stringify(deduped) !== JSON.stringify(p.assignees ?? [])) {
      update.assignees = deduped;
    }
    if (Object.keys(update).length > 0) {
      await Project.updateOne({ _id: p._id }, { $set: update });
      changes++;
      console.log(`  Project ${p._id}: ${Object.keys(update).join(", ")}`);
    }
  }

  // Tasks: createdBy, assignees[], reportingPersons[]
  const tasks = await Task.find({}).lean();
  for (const t of tasks) {
    const update: Record<string, unknown> = {};
    if (isOrphan(t.createdBy)) update.createdBy = adminId;
    const assignees = (t.assignees ?? []).map((a) =>
      isOrphan(a) ? adminId : a
    );
    const dedupedA = Array.from(
      new Map(assignees.map((a) => [String(a), a])).values()
    );
    if (JSON.stringify(dedupedA) !== JSON.stringify(t.assignees ?? [])) {
      update.assignees = dedupedA;
    }
    const reporters = (t.reportingPersons ?? []).map((a) =>
      isOrphan(a) ? adminId : a
    );
    const dedupedR = Array.from(
      new Map(reporters.map((a) => [String(a), a])).values()
    );
    if (JSON.stringify(dedupedR) !== JSON.stringify(t.reportingPersons ?? [])) {
      update.reportingPersons = dedupedR;
    }
    if (Object.keys(update).length > 0) {
      await Task.updateOne({ _id: t._id }, { $set: update });
      changes++;
      console.log(`  Task ${t._id}: ${Object.keys(update).join(", ")}`);
    }
  }

  console.log(`\nDone. ${changes} documents updated.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
