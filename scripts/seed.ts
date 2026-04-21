import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import User from "../models/User";

loadEnv({ path: ".env.local" });
loadEnv();

const SEED_USERS = [
  {
    name: "Rahul",
    email: "rahul@codzgarage.com",
    password: "Admin@123",
    role: "admin" as const,
    status: "active" as const,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI. Add it to .env.local before seeding.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  for (const u of SEED_USERS) {
    const existing = await User.findOne({ email: u.email }).select("+password");
    if (existing) {
      existing.name = u.name;
      existing.role = u.role;
      existing.status = u.status;
      existing.password = u.password;
      await existing.save();
      console.log(`↻ Updated ${u.role}: ${u.email}`);
      continue;
    }
    await User.create(u);
    console.log(`✓ Created ${u.role}: ${u.email}`);
  }

  await mongoose.disconnect();
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
