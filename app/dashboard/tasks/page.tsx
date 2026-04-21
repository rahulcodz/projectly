"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TASK_STATUS_STYLES,
  TaskStatusBadge,
  type TaskStatusKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
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
  name: string;
  projectId: string;
};

type Task = {
  _id: string;
  title: string;
  status: TaskStatusKey;
  project: ProjectLite | null;
  createdBy: UserLite | null;
  assignees: UserLite[];
  createdAt?: string;
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const STATUS_OPTIONS: { value: "all" | TaskStatusKey; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "in_review", label: "In review" },
  { value: "qa", label: "QA" },
  { value: "done", label: "Done" },
];

const STATUS_ROW_BG: Record<TaskStatusKey, string> = {
  backlog: "bg-muted/30",
  todo: "bg-sky-500/5 dark:bg-sky-500/10",
  in_progress: "bg-amber-500/5 dark:bg-amber-500/10",
  in_review: "bg-violet-500/5 dark:bg-violet-500/10",
  qa: "bg-cyan-500/5 dark:bg-cyan-500/10",
  done: "bg-emerald-500/5 dark:bg-emerald-500/10",
};

const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

export default function TasksPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [projects, setProjects] = useState<ProjectLite[]>([]);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatusKey>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [projectFilter, statusFilter, limit]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/projects?limit=100");
        const data = await res.json();
        if (res.ok) setProjects(data.projects ?? []);
      } catch {}
    })();
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (projectFilter !== "all") params.set("project", projectFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tasks");
      setTasks(data.tasks ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedQuery, projectFilter, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);
  const hasFilters =
    Boolean(debouncedQuery) ||
    projectFilter !== "all" ||
    statusFilter !== "all";

  function clearFilters() {
    setQuery("");
    setProjectFilter("all");
    setStatusFilter("all");
  }

  const isUser = session?.role === "user";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">
            {isUser ? "My tasks" : "All tasks"}
          </h2>
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {loading ? "…" : `${total} total`}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <InputGroup className={`h-9 sm:w-72 ${controlClasses}`}>
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search task title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className={`w-full sm:w-48 ${controlClasses}`}>
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "all" | TaskStatusKey)}
          >
            <SelectTrigger className={`w-full sm:w-40 ${controlClasses}`}>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 size-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border/40 md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
              <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</TableHead>
              <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="h-10 w-56 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Project</TableHead>
              <TableHead className="h-10 w-36 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assignees</TableHead>
              <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created by</TableHead>
              <TableHead className="h-10 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
                <TableRow key={i} className="border-border/40 hover:bg-transparent">
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                </TableRow>
              ))
            ) : tasks.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-40">
                  <EmptyState
                    hasFilters={hasFilters}
                    onClear={clearFilters}
                    isUser={isUser}
                  />
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((t) => (
                <TableRow
                  key={t._id}
                  className={cn(
                    "border-border/40 hover:bg-transparent",
                    STATUS_ROW_BG[t.status]
                  )}
                >
                  <TableCell className="px-3 py-2.5 text-sm font-medium">
                    {t.project ? (
                      <Link
                        href={`/dashboard/projects/${t.project._id}?task=${t._id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {t.title}
                      </Link>
                    ) : (
                      <span>{t.title}</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <TaskStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    {t.project ? (
                      <Link
                        href={`/dashboard/projects/${t.project._id}`}
                        className="flex items-center gap-2 text-sm hover:text-primary hover:underline"
                      >
                        <span className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {t.project.projectId}
                        </span>
                        <span className="truncate">{t.project.name}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <AssigneeStack assignees={t.assignees} />
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                    {t.createdBy?.name ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatDate(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {loading ? (
          <div className="divide-y rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-lg border p-4">
            <EmptyState
              hasFilters={hasFilters}
              onClear={clearFilters}
              isUser={isUser}
            />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tasks.map((t) => (
              <li
                key={t._id}
                className={cn("flex flex-col gap-2 p-4", STATUS_ROW_BG[t.status])}
              >
                {t.project ? (
                  <Link
                    href={`/dashboard/projects/${t.project._id}?task=${t._id}`}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {t.title}
                  </Link>
                ) : (
                  <span className="font-medium">{t.title}</span>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <TaskStatusBadge status={t.status} />
                  {t.project && (
                    <Link
                      href={`/dashboard/projects/${t.project._id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {t.project.name}
                    </Link>
                  )}
                  <span>· {formatDate(t.createdAt)}</span>
                </div>
                <AssigneeStack assignees={t.assignees} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "No results"
              : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          </span>
          <span className="mx-1 hidden text-border sm:inline">·</span>
          <div className="hidden items-center gap-2 sm:flex">
            <span>Rows per page</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => setLimit(Number(v))}
            >
              <SelectTrigger
                className={`h-7 w-16 px-2 py-0 text-xs [&_svg]:size-3 ${controlClasses}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${controlClasses}`}
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-3.5" /> Previous
          </Button>
          <div className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of{" "}
            <span className="font-medium text-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 px-2 text-xs ${controlClasses}`}
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function AssigneeStack({ assignees }: { assignees: UserLite[] }) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const visible = assignees.slice(0, 3);
  const extra = assignees.length - visible.length;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u) => (
        <UserInitialsAvatar
          key={u._id}
          name={u.name}
          className="size-7 text-[10px] ring-2 ring-background"
        />
      ))}
      {extra > 0 && (
        <span className="flex size-7 items-center justify-center rounded-full border bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
  isUser,
}: {
  hasFilters: boolean;
  onClear: () => void;
  isUser: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
      <p className="text-sm font-medium">
        {hasFilters
          ? "No tasks match your filters"
          : isUser
          ? "No tasks assigned to you yet"
          : "No tasks yet"}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasFilters
          ? "Try clearing filters or adjusting your search."
          : "Tasks created under any project will appear here."}
      </p>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="mt-2 text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}
