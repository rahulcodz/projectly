import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

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
    body: { type: String, required: true },
  },
  { timestamps: true }
);

export type CommentShape = InferSchemaType<typeof CommentSchema>;
export type CommentDoc = CommentShape & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Comment) {
  mongoose.deleteModel("Comment");
}

const Comment: Model<CommentDoc> = mongoose.model<CommentDoc>(
  "Comment",
  CommentSchema
);

export default Comment;
