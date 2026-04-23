import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI. Add it to .env.local before running.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("No active mongoose connection database handle.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const coll = db.collection("projects");

  const toWrap = await coll.countDocuments({
    reportingTo: { $exists: true, $not: { $type: "array" } },
  });
  console.log(`Projects with scalar reportingTo: ${toWrap}`);

  if (toWrap > 0) {
    const wrapRes = await coll.updateMany(
      { reportingTo: { $exists: true, $not: { $type: "array" } } },
      [{ $set: { reportingTo: ["$reportingTo"] } }]
    );
    console.log(
      `Wrapped ${wrapRes.modifiedCount} project(s) reportingTo into array.`
    );
  }

  const nullCount = await coll.countDocuments({
    $or: [{ reportingTo: { $exists: false } }, { reportingTo: null }],
  });
  if (nullCount > 0) {
    console.log(
      `Note: ${nullCount} project(s) have missing/null reportingTo — these were left untouched.`
    );
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
