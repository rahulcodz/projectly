import mongoose, { Schema, Model, InferSchemaType } from "mongoose";

const ProjectSchema = new Schema(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportingTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export type ProjectShape = InferSchemaType<typeof ProjectSchema>;
export type ProjectDoc = ProjectShape & { _id: mongoose.Types.ObjectId };

const Project: Model<ProjectDoc> =
  (mongoose.models.Project as Model<ProjectDoc>) ||
  mongoose.model<ProjectDoc>("Project", ProjectSchema);

export default Project;
