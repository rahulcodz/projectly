import mongoose from "mongoose";
import Notification, { type NotificationType } from "@/models/Notification";

export type NotifyInput = {
  recipient: string | mongoose.Types.ObjectId;
  actor?: string | mongoose.Types.ObjectId | null;
  type: NotificationType;
  project?: string | mongoose.Types.ObjectId | null;
  task?: string | mongoose.Types.ObjectId | null;
  comment?: string | mongoose.Types.ObjectId | null;
  message: string;
  data?: Record<string, unknown>;
};

function toOid(
  v: string | mongoose.Types.ObjectId | null | undefined
): mongoose.Types.ObjectId | null {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (typeof v === "string" && mongoose.Types.ObjectId.isValid(v)) {
    return new mongoose.Types.ObjectId(v);
  }
  return null;
}

export async function createNotifications(items: NotifyInput[]): Promise<void> {
  if (!items.length) return;
  const actorStr = (v: NotifyInput["actor"]) => (v ? String(v) : null);

  const docs = items
    .filter((it) => {
      const r = toOid(it.recipient);
      if (!r) return false;
      // skip self notifications
      if (it.actor && String(it.recipient) === actorStr(it.actor)) return false;
      return true;
    })
    .map((it) => ({
      recipient: toOid(it.recipient)!,
      actor: toOid(it.actor),
      type: it.type,
      project: toOid(it.project),
      task: toOid(it.task),
      comment: toOid(it.comment),
      message: it.message,
      data: it.data ?? {},
      read: false,
      readAt: null,
    }));

  if (!docs.length) return;

  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch {
    // swallow — notify failure must not break user action
  }
}
