import User from "@/models/User";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Comment from "@/models/Comment";
import Notification from "@/models/Notification";

export function registerModels() {
  return { User, Project, Task, Comment, Notification };
}

void User;
void Project;
void Task;
void Comment;
void Notification;
