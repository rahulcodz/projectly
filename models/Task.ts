import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "qa",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  qa: "QA",
  done: "Done",
};

const SubtaskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const TaskSchema = new Schema(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "todo",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reportingPersons: [{ type: Schema.Types.ObjectId, ref: "User" }],
    subtasks: { type: [SubtaskSchema], default: [] },
  },
  { timestamps: true }
);

export type TaskShape = InferSchemaType<typeof TaskSchema>;
export type TaskDoc = TaskShape & { _id: mongoose.Types.ObjectId };

const Task: Model<TaskDoc> =
  (mongoose.models.Task as Model<TaskDoc>) ||
  mongoose.model<TaskDoc>("Task", TaskSchema);

export default Task;
