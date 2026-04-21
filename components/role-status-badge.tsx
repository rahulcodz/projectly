import { cn } from "@/lib/utils";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const styles: Record<UserRole, string> = {
    admin:
      "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15 dark:text-primary-foreground/90 dark:ring-primary/30",
    project_manager:
      "bg-chart-1/15 text-chart-1 ring-chart-1/25 dark:bg-chart-1/20 dark:text-chart-1 dark:ring-chart-1/30",
    user:
      "bg-muted text-muted-foreground ring-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[role],
        className
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: "active" | "inactive";
  className?: string;
}) {
  const isActive = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        isActive
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30"
          : "bg-muted text-muted-foreground ring-border",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          isActive ? "bg-emerald-500" : "bg-muted-foreground/60"
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function UserInitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-primary text-sm font-semibold ring-1 ring-inset ring-primary/20",
        className
      )}
    >
      {initials || "U"}
    </span>
  );
}
