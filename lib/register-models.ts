import User from "@/models/User";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Comment from "@/models/Comment";

export function registerModels() {
  return { User, Project, Task, Comment };
}

void User;
void Project;
void Task;
void Comment;
