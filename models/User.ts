import mongoose, { Schema, Model, InferSchemaType } from "mongoose";
import bcrypt from "bcryptjs";
import { USER_ROLES } from "@/lib/roles";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

type UserShape = InferSchemaType<typeof UserSchema>;

UserSchema.pre<mongoose.HydratedDocument<UserShape>>("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export type UserDoc = UserShape & { _id: mongoose.Types.ObjectId };

const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ||
  mongoose.model<UserDoc>("User", UserSchema);

export default User;
