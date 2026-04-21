import mongoose from "mongoose";
import Project, { type ProjectDoc } from "@/models/Project";
import { type SessionPayload } from "@/lib/auth";

export async function getProjectForSession(
  projectId: string,
  session: SessionPayload
): Promise<ProjectDoc | null> {
  if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
  const project = await Project.findById(projectId);
  if (!project) return null;

  if (session.role === "admin" || session.role === "project_manager") {
    return project;
  }

  const userId = session.sub;
  const assignees = (project.assignees ?? []).map((a) => String(a));
  if (assignees.includes(userId)) return project;

  return null;
}

export function canManageProject(session: SessionPayload) {
  return session.role === "admin" || session.role === "project_manager";
}
