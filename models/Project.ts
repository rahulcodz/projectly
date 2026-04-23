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
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: (v: unknown) => Array.isArray(v) && v.length > 0,
        message: "At least one reporting person required",
      },
    },
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export type ProjectShape = InferSchemaType<typeof ProjectSchema>;
export type ProjectDoc = ProjectShape & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Project) {
  delete mongoose.models.Project;
}

const Project: Model<ProjectDoc> = mongoose.model<ProjectDoc>(
  "Project",
  ProjectSchema
);

export default Project;
