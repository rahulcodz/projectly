import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import "../models/User";
import User from "../models/User";
import Comment from "../models/Comment";

loadEnv({ path: ".env.local" });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  await mongoose.connect(uri);

  const missing = await Comment.find({
    $or: [
      { authorName: { $exists: false } },
      { authorName: "" },
      { authorName: null },
    ],
  }).lean();

  console.log(`Found ${missing.length} comments without snapshot`);

  const authorIds = Array.from(
    new Set(
      missing.map((c) => (c.author ? String(c.author) : null)).filter(Boolean)
    )
  ) as string[];

  const users = authorIds.length
    ? await User.find({ _id: { $in: authorIds } })
        .select("name email role")
        .lean()
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));

  let resolved = 0;
  let orphaned = 0;

  for (const c of missing) {
    const key = c.author ? String(c.author) : null;
    const u = key ? byId.get(key) : null;
    let update;
    if (u) {
      update = {
        authorName: (u as { name: string }).name ?? "Unknown",
        authorEmail: (u as { email: string }).email ?? "",
        authorRole: (u as { role: string }).role ?? "user",
      };
      resolved++;
    } else {
      update = {
        authorName: "Deleted user",
        authorEmail: "",
        authorRole: "user",
      };
      orphaned++;
    }
    await Comment.updateOne({ _id: c._id }, { $set: update });
  }

  console.log(`Resolved: ${resolved}, Orphaned (deleted user): ${orphaned}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
