"use client";

import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskPriority,
} from "@/lib/task-priority";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PRIORITY_STYLES: Record<
  TaskPriority,
  { cls: string; dot: string; label: string }
> = {
  low: {
    cls: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    dot: "bg-slate-500",
    label: "Low",
  },
  medium: {
    cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    label: "Medium",
  },
  high: {
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    label: "High",
  },
  urgent: {
    cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
    label: "Urgent",
  },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority?: TaskPriority | null;
  className?: string;
}) {
  const s = PRIORITY_STYLES[priority ?? "medium"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        s.cls,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function PrioritySelect({
  value,
  onChange,
  triggerClassName,
  size = "sm",
}: {
  value?: TaskPriority | null;
  onChange: (v: TaskPriority) => void;
  triggerClassName?: string;
  size?: "sm" | "default";
}) {
  const safe = value ?? "medium";
  const s = PRIORITY_STYLES[safe];
  return (
    <Select value={safe} onValueChange={(v) => onChange(v as TaskPriority)}>
      <SelectTrigger
        size={size}
        className={cn(
          "h-7 gap-1.5 border-transparent px-2 text-xs font-medium shadow-none hover:border-border",
          s.cls,
          triggerClassName
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  PRIORITY_STYLES[p].dot
                )}
              />
              {TASK_PRIORITY_LABELS[p]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
