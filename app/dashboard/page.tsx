"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FolderKanban,
  ListChecks,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import {
  RoleBadge,
  StatusBadge,
  TaskStatusBadge,
  TASK_STATUS_STYLES,
  type TaskStatusKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";

type UserLite = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

type ProjectLite = {
  _id: string;
  projectId: string;
  name: string;
  status: "active" | "inactive";
  updatedAt?: string;
  reportingTo?: UserLite | null;
  assignees?: UserLite[];
};

type TaskLite = {
  _id: string;
  title: string;
  status: TaskStatusKey;
  updatedAt?: string;
  project: { _id: string; name: string; projectId: string } | null;
  assignees?: UserLite[];
};

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt?: string;
};

type DashboardData = {
  role: UserRole;
  counts: Record<string, number>;
  statusBreakdown: Record<string, number>;
  roleBreakdown?: Record<string, number>;
  recentProjects: ProjectLite[];
  recentTasks: TaskLite[];
  recentUsers?: UserRow[];
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const POLL_MS = 30_000;

export default function DashboardHome() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (res.ok) setSession(d.user);
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setLastUpdated(new Date());
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const firstName = session?.name?.split(" ")[0] ?? "there";
  const role = data?.role ?? session?.role;
  const isUser = role === "user";
  const canManage = role === "admin" || role === "project_manager";

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-sm sm:p-8">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 size-56 rounded-full bg-white/15 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-10 size-56 rounded-full bg-black/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="size-3" /> Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {firstName}.
            </h1>
            <p className="text-primary-foreground/85 text-sm sm:text-base">
              {isUser
                ? "Here's what's assigned to you."
                : "Real-time pulse across your workspace."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary-foreground/90">
            <RefreshCw
              className={cn("size-3.5", loading && "animate-spin")}
            />
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Loading…"}
          </div>
        </div>
      </section>

      <section
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          canManage ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        <StatCard
          icon={FolderKanban}
          label={isUser ? "My projects" : "Projects"}
          value={data?.counts.projects}
          sub={
            canManage
              ? `${data?.counts.projectsActive ?? 0} active`
              : "Assigned to you"
          }
          href="/dashboard/projects"
          loading={loading}
        />
        <StatCard
          icon={ListChecks}
          label={isUser ? "My tasks" : "Tasks"}
          value={data?.counts.tasks}
          sub={
            isUser
              ? `${data?.counts.tasksOpen ?? 0} open · ${data?.counts.tasksDone ?? 0} done`
              : "All tasks"
          }
          href="/dashboard/tasks"
          loading={loading}
        />
        {canManage && (
          <StatCard
            icon={Users}
            label="Users"
            value={data?.counts.users}
            sub={`${data?.counts.usersActive ?? 0} active`}
            href="/dashboard/users"
            loading={loading}
          />
        )}
        <StatusMiniCard
          breakdown={data?.statusBreakdown}
          loading={loading}
        />
      </section>

      <section
        className={cn(
          "grid gap-4",
          canManage ? "lg:grid-cols-2" : "lg:grid-cols-1"
        )}
      >
        <Panel
          title={isUser ? "My projects" : "Recent projects"}
          href="/dashboard/projects"
          empty="No projects yet"
          loading={loading}
          items={data?.recentProjects ?? []}
          render={(p) => (
            <Link
              key={p._id}
              href={`/dashboard/projects/${p._id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50"
            >
              <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {p.projectId}
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {p.name}
              </span>
              <StatusBadge status={p.status} />
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {relTime(p.updatedAt)}
              </span>
            </Link>
          )}
        />
        <Panel
          title={isUser ? "My tasks" : "Recent tasks"}
          href="/dashboard/tasks"
          empty="No tasks yet"
          loading={loading}
          items={data?.recentTasks ?? []}
          render={(t) => (
            <Link
              key={t._id}
              href={
                t.project
                  ? `/dashboard/projects/${t.project._id}?task=${t._id}`
                  : "#"
              }
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50"
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium">
                  {t.title}
                </span>
                {t.project && (
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {t.project.name}
                  </span>
                )}
              </span>
              <TaskStatusBadge status={t.status} />
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {relTime(t.updatedAt)}
              </span>
            </Link>
          )}
        />
      </section>

      {canManage && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Team breakdown</h2>
              <Link
                href="/dashboard/users"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                View all
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <RoleChip
                role="admin"
                count={data?.roleBreakdown?.admin ?? 0}
                loading={loading}
              />
              <RoleChip
                role="project_manager"
                count={data?.roleBreakdown?.project_manager ?? 0}
                loading={loading}
              />
              <RoleChip
                role="user"
                count={data?.roleBreakdown?.user ?? 0}
                loading={loading}
              />
            </div>
            <div className="mt-4 border-t border-border/40 pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recently added
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (data?.recentUsers?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No users yet.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {data?.recentUsers?.map((u) => (
                    <li
                      key={u._id}
                      className="flex items-center gap-3 py-2"
                    >
                      <UserInitialsAvatar
                        name={u.name}
                        className="size-8 text-[11px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {u.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email}
                        </div>
                      </div>
                      <RoleBadge role={u.role} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <StatusDistributionCard
            breakdown={data?.statusBreakdown}
            loading={loading}
          />
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  sub: string;
  href: string;
  loading: boolean;
}) {
  return (
    <Link href={href} className="group">
      <div className="h-full rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-4">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-3xl font-bold tracking-tight">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              (value ?? 0).toLocaleString()
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </Link>
  );
}

function StatusMiniCard({
  breakdown,
  loading,
}: {
  breakdown: Record<string, number> | undefined;
  loading: boolean;
}) {
  const keys: TaskStatusKey[] = [
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "qa",
    "done",
  ];
  return (
    <div className="h-full rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Task status</div>
        <ListChecks className="size-4 text-muted-foreground" />
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {keys.map((k) => (
            <li
              key={k}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    TASK_STATUS_STYLES[k].dot
                  )}
                />
                <span className="text-muted-foreground">
                  {TASK_STATUS_STYLES[k].label}
                </span>
              </span>
              <span className="font-medium">{breakdown?.[k] ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDistributionCard({
  breakdown,
  loading,
}: {
  breakdown: Record<string, number> | undefined;
  loading: boolean;
}) {
  const keys: TaskStatusKey[] = [
    "backlog",
    "todo",
    "in_progress",
    "in_review",
    "qa",
    "done",
  ];
  const total = keys.reduce((sum, k) => sum + (breakdown?.[k] ?? 0), 0) || 1;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Task pipeline</h2>
        <Link
          href="/dashboard/tasks"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {keys.map((k) => {
            const n = breakdown?.[k] ?? 0;
            const pct = Math.round((n / total) * 100);
            return (
              <li key={k} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        TASK_STATUS_STYLES[k].dot
                      )}
                    />
                    <span>{TASK_STATUS_STYLES[k].label}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {n} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      TASK_STATUS_STYLES[k].dot
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RoleChip({
  role,
  count,
  loading,
}: {
  role: UserRole;
  count: number;
  loading: boolean;
}) {
  const labels: Record<UserRole, string> = {
    admin: "Admin",
    project_manager: "Project managers",
    user: "Users",
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
      <RoleBadge role={role} />
      <span className="text-xs text-muted-foreground">{labels[role]}</span>
      <span className="text-sm font-semibold">
        {loading ? "…" : count}
      </span>
    </div>
  );
}

function Panel<T extends { _id: string }>({
  title,
  href,
  items,
  empty,
  loading,
  render,
}: {
  title: string;
  href: string;
  items: T[];
  empty: string;
  loading: boolean;
  render: (item: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={href}
          className="text-xs text-muted-foreground hover:text-primary"
        >
          View all
        </Link>
      </div>
      <div className="p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col">{items.map(render)}</ul>
        )}
      </div>
    </div>
  );
}

function relTime(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
