import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = [
  "project_assigned",
  "project_unassigned",
  "task_assigned",
  "task_unassigned",
  "task_status_changed",
  "mention_project",
  "mention_task",
  "mention_subtask",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

export type NotificationShape = InferSchemaType<typeof NotificationSchema>;
export type NotificationDoc = NotificationShape & {
  _id: mongoose.Types.ObjectId;
};

if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}

const Notification: Model<NotificationDoc> = mongoose.model<NotificationDoc>(
  "Notification",
  NotificationSchema
);

export default Notification;
