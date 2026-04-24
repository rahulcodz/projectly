import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

const SystemMetaSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "status",
        "priority",
        "assignee_added",
        "assignee_removed",
        "reporting_added",
        "reporting_removed",
      ],
      required: true,
    },
    from: { type: String },
    to: { type: String },
    userIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const CommentSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: { type: String, default: "" },
    authorEmail: { type: String, default: "" },
    authorRole: { type: String, default: "" },
    body: { type: String, required: true },
    kind: {
      type: String,
      enum: ["comment", "system"],
      default: "comment",
      index: true,
    },
    system: { type: SystemMetaSchema, default: null },
  },
  { timestamps: true }
);

export type CommentShape = InferSchemaType<typeof CommentSchema>;
export type CommentDoc = CommentShape & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Comment) {
  delete mongoose.models.Comment;
}

const Comment: Model<CommentDoc> = mongoose.model<CommentDoc>(
  "Comment",
  CommentSchema
);

export default Comment;
