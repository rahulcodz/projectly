import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import "../models/User";
import "../models/Project";
import "../models/Task";
import Comment from "../models/Comment";

loadEnv({ path: ".env.local" });

async function main() {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);

  const raw = await Comment.find({}).lean();
  console.log("\n=== Raw comments ===");
  for (const c of raw) {
    console.log({
      _id: String(c._id),
      author: c.author,
      authorType: typeof c.author,
      authorIsObjectId: c.author instanceof mongoose.Types.ObjectId,
      hasProject: !!c.project,
      hasTask: !!c.task,
      body: String(c.body).slice(0, 40),
    });
  }

  const populated = await Comment.find({})
    .populate("author", "name email role")
    .lean();
  console.log("\n=== Populated ===");
  for (const c of populated) {
    console.log({
      _id: String(c._id),
      author: c.author,
    });
  }

  const users = await mongoose.connection.collection("users").find({}).toArray();
  console.log("\n=== Users in DB ===");
  for (const u of users) console.log({ _id: String(u._id), email: u.email, name: u.name });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
