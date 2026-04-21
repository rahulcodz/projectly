"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  ListChecks,
  MessageSquare,
  Plus,
  Search,
  Send,
  RefreshCw,
  ShieldAlert,
  UserPlus,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RoleBadge,
  TASK_STATUS_STYLES,
  TaskStatusBadge,
  type TaskStatusKey,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { cn } from "@/lib/utils";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { RichTextEditor, RichTextViewer } from "@/components/rich-text-editor";
import { type UserLite as PickerUser } from "@/components/user-pickers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { type UserRole } from "@/lib/roles";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";

type UserLite = PickerUser;

type Project = {
  _id: string;
  projectId: string;
  name: string;
  status: "active" | "inactive";
  createdBy: UserLite | null;
  reportingTo: UserLite | null;
  assignees: UserLite[];
  createdAt?: string;
  updatedAt?: string;
};

type Task = {
  _id: string;
  title: string;
  description: string;
  status: TaskStatusKey;
  createdBy: UserLite | null;
  assignees: UserLite[];
  reportingPersons: UserLite[];
  createdAt?: string;
  updatedAt?: string;
};

const chromeTabClasses = cn(
  "group relative -mb-[2px] h-10 flex-none items-center gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none",
  "hover:text-foreground",
  "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
);

const BOARD_COLUMNS: TaskStatusKey[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "qa",
  "done",
];

const STATUS_TAB_ACTIVE: Record<TaskStatusKey, string> = {
  backlog: "data-[state=active]:bg-muted/70",
  todo: "data-[state=active]:bg-sky-500/20",
  in_progress: "data-[state=active]:bg-amber-500/20",
  in_review: "data-[state=active]:bg-violet-500/20",
  qa: "data-[state=active]:bg-cyan-500/20",
  done: "data-[state=active]:bg-emerald-500/20",
};

const STATUS_ROW_BG: Record<TaskStatusKey, string> = {
  backlog: "bg-muted/30",
  todo: "bg-sky-500/5 dark:bg-sky-500/10",
  in_progress: "bg-amber-500/5 dark:bg-amber-500/10",
  in_review: "bg-violet-500/5 dark:bg-violet-500/10",
  qa: "bg-cyan-500/5 dark:bg-cyan-500/10",
  done: "bg-emerald-500/5 dark:bg-emerald-500/10",
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

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

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const taskParam = searchParams?.get("task") ?? null;
  const id = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatusKey>("todo");
  const [view, setView] = useState<"list" | "board">("list");
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 10;
  const [tab, setTab] = useState<string>("tasks");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatusKey | null>(null);

  type CommentT = {
    _id: string;
    body: string;
    createdAt?: string;
    author: UserLite | null;
  };

  const [projComments, setProjComments] = useState<CommentT[]>([]);
  const [projCommentsLoading, setProjCommentsLoading] = useState(true);
  const [newProjComment, setNewProjComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentAlert, setCommentAlert] = useState<string | null>(null);
  const [projComposerOpen, setProjComposerOpen] = useState(false);

  type TaskTabState = {
    comments: CommentT[];
    loading: boolean;
    draft: string;
    composerOpen: boolean;
    alert: string | null;
    posting: boolean;
  };
  const [openTaskIds, setOpenTaskIds] = useState<string[]>([]);
  const [taskTabs, setTaskTabs] = useState<Record<string, TaskTabState>>({});

  function updateTaskTab(id: string, patch: Partial<TaskTabState>) {
    setTaskTabs((prev) => {
      const curr: TaskTabState = prev[id] ?? {
        comments: [],
        loading: false,
        draft: "",
        composerOpen: false,
        alert: null,
        posting: false,
      };
      return { ...prev, [id]: { ...curr, ...patch } };
    });
  }
  const [taskAssignees, setTaskAssignees] = useState<UserLite[]>([]);
  const [taskReporting, setTaskReporting] = useState<UserLite[]>([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskErrors, setTaskErrors] = useState<FieldErrors>({});
  const [taskAlert, setTaskAlert] = useState<string | null>(null);

  const canEdit =
    session?.role === "admin" || session?.role === "project_manager";

  async function addAssignee(userId: string) {
    if (!project) return;
    const existing = project.assignees.map((a) => a._id);
    if (existing.includes(userId)) return;
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: [...existing, userId] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add assignee");
      setProject(data.project);
      toast.success("Assignee added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add assignee");
    }
  }

  async function removeAssignee(userId: string) {
    if (!project) return;
    const next = project.assignees
      .filter((a) => a._id !== userId)
      .map((a) => a._id);
    try {
      const res = await fetch(`/api/projects/${project._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove assignee");
      setProject(data.project);
      toast.success("Assignee removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove assignee");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load project");
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadTasks = useCallback(async () => {
    if (!id) return;
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/tasks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tasks");
      setTasks(data.tasks ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (project) loadTasks();
  }, [project, loadTasks]);

  const loadProjComments = useCallback(async () => {
    if (!id) return;
    setProjCommentsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load discussion");
      setProjComments(data.comments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load discussion");
    } finally {
      setProjCommentsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (project) loadProjComments();
  }, [project, loadProjComments]);

  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!project || hydratedRef.current) return;
    hydratedRef.current = true;
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(`projectly:tabs:${project._id}`);
    } catch {}
    if (taskParam) {
      setOpenTaskIds([taskParam]);
      setTaskTabs({
        [taskParam]: {
          comments: [],
          loading: true,
          draft: "",
          composerOpen: false,
          alert: null,
          posting: false,
        },
      });
      setTab(`task:${taskParam}`);
      loadTaskComments(taskParam);
    } else {
      setOpenTaskIds([]);
      setTaskTabs({});
      setTab("tasks");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (!project || !hydratedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const drafts: Record<string, { draft: string; composerOpen: boolean }> = {};
      openTaskIds.forEach((tid) => {
        const s = taskTabs[tid];
        if (s) {
          drafts[tid] = { draft: s.draft, composerOpen: s.composerOpen };
        }
      });
      sessionStorage.setItem(
        `projectly:tabs:${project._id}`,
        JSON.stringify({ openTaskIds, tab, drafts })
      );
    } catch {}
  }, [project, openTaskIds, tab, taskTabs]);

  async function loadTaskComments(taskId: string) {
    updateTaskTab(taskId, { loading: true });
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load discussion");
      updateTaskTab(taskId, { comments: data.comments ?? [], loading: false });
    } catch (err) {
      updateTaskTab(taskId, { loading: false });
      toast.error(err instanceof Error ? err.message : "Failed to load discussion");
    }
  }

  function openTaskTab(taskId: string) {
    setOpenTaskIds((prev) =>
      prev.includes(taskId) ? prev : [...prev, taskId]
    );
    setTaskTabs((prev) =>
      prev[taskId]
        ? prev
        : {
            ...prev,
            [taskId]: {
              comments: [],
              loading: true,
              draft: "",
              composerOpen: false,
              alert: null,
              posting: false,
            },
          }
    );
    setTab(`task:${taskId}`);
    if (!taskTabs[taskId]) loadTaskComments(taskId);
  }

  function closeTaskTab(taskId: string) {
    setOpenTaskIds((prev) => {
      const next = prev.filter((id) => id !== taskId);
      if (tab === `task:${taskId}`) {
        const idx = prev.indexOf(taskId);
        const fallback =
          next[idx] ?? next[idx - 1] ?? (next.length > 0 ? next[0] : null);
        setTab(fallback ? `task:${fallback}` : "tasks");
      }
      return next;
    });
    setTaskTabs((prev) => {
      const { [taskId]: _, ...rest } = prev;
      void _;
      return rest;
    });
  }

  async function postTaskComment(e: React.FormEvent, taskId: string) {
    e.preventDefault();
    const state = taskTabs[taskId];
    if (!state) return;
    const plain = state.draft.replace(/<[^>]+>/g, "").trim();
    if (plain.length === 0) {
      updateTaskTab(taskId, { alert: "Comment cannot be empty" });
      return;
    }
    updateTaskTab(taskId, { posting: true, alert: null });
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: state.draft }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        const errs = fieldErrors as FieldErrors;
        updateTaskTab(taskId, {
          alert: errs.body || message,
          posting: false,
        });
        return;
      }
      updateTaskTab(taskId, {
        draft: "",
        composerOpen: false,
        posting: false,
      });
      await loadTaskComments(taskId);
    } catch (err) {
      updateTaskTab(taskId, {
        alert: err instanceof Error ? err.message : "Failed to post",
        posting: false,
      });
    }
  }

  async function postProjComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentAlert(null);
    const plain = newProjComment.replace(/<[^>]+>/g, "").trim();
    if (plain.length === 0) {
      setCommentAlert("Comment cannot be empty");
      return;
    }
    setPostingComment(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newProjComment }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        const errs = fieldErrors as FieldErrors;
        setCommentAlert(errs.body || message);
        return;
      }
      setNewProjComment("");
      setProjComposerOpen(false);
      await loadProjComments();
    } catch (err) {
      setCommentAlert(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPostingComment(false);
    }
  }

  async function updateTaskAssignees(
    taskId: string,
    nextAssignees: UserLite[]
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, assignees: nextAssignees } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: nextAssignees.map((u) => u._id) }),
      });
      if (!res.ok) {
        setTasks(prev);
        const data = await res.json();
        toast.error(data.error || "Failed to update assignees");
      }
    } catch (err) {
      setTasks(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update assignees"
      );
    }
  }

  async function moveTask(taskId: string, newStatus: TaskStatusKey) {
    const existing = tasks.find((t) => t._id === taskId);
    if (!existing || existing.status === newStatus) return;
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks(prev);
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
      }
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  function openCreateTask() {
    setTaskTitle("");
    setTaskDesc("");
    setTaskStatus("todo");
    setTaskAssignees([]);
    setTaskReporting([]);
    setTaskErrors({});
    setTaskAlert(null);
    setTaskDialogOpen(true);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setTaskAlert(null);
    const errs: FieldErrors = {};
    if (taskTitle.trim().length < 2)
      errs.title = "Title must be at least 2 characters";
    if (Object.keys(errs).length > 0) {
      setTaskErrors(errs);
      return;
    }
    setTaskErrors({});
    setTaskSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          status: taskStatus,
          assignees: taskAssignees.map((u) => u._id),
          reportingPersons: taskReporting.map((u) => u._id),
        }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) setTaskErrors(fieldErrors);
        else setTaskAlert(message);
        return;
      }
      toast.success("Task created");
      setTaskDialogOpen(false);
      await loadTasks();
    } catch (err) {
      setTaskAlert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setTaskSubmitting(false);
    }
  }

  if (loading) return <DetailSkeleton />;
  if (error || !project)
    return <DetailError message={error ?? "Project not found"} />;

  const openTaskTabs = openTaskIds
    .map((id) => tasks.find((t) => t._id === id))
    .filter((t): t is Task => Boolean(t));

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-mx-6 sm:-my-8">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="min-w-0"
        >
          <div className="relative">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b-2 border-border/60 bg-transparent px-4 py-0 shadow-none sm:px-6">
              <TabsTrigger
                value="overview"
                className={cn(chromeTabClasses, "bg-primary/10 data-[state=active]:bg-primary/15")}
              >
                <FolderKanban className="size-4 text-muted-foreground group-data-[state=active]:text-primary" />
                <span>Overview</span>
                <span className="ml-0.5 rounded-full border bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                  {projCommentsLoading ? "…" : projComments.length}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className={cn(chromeTabClasses, "bg-primary/10 data-[state=active]:bg-primary/15")}
              >
                <ListChecks className="size-4 text-muted-foreground group-data-[state=active]:text-primary" />
                <span>Tasks</span>
                <span className="ml-0.5 rounded-full border bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                  {tasksLoading ? "…" : tasks.length}
                </span>
              </TabsTrigger>
              {openTaskTabs.map((t) => (
                <TabsTrigger
                  key={t._id}
                  value={`task:${t._id}`}
                  className={cn(
                    chromeTabClasses,
                    "pr-1.5",
                    TASK_STATUS_STYLES[t.status].card,
                    STATUS_TAB_ACTIVE[t.status]
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      TASK_STATUS_STYLES[t.status].dot
                    )}
                  />
                  <span className="max-w-[160px] truncate">{t.title}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Close ${t.title}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeTaskTab(t._id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="ml-1 flex size-5 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 px-4 pb-4 text-base sm:px-6">
                <span>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-semibold">{project.name}</span>
                </span>
                <span className="text-muted-foreground">|</span>
                <span>
                  <span className="text-muted-foreground">ID:</span>{" "}
                  <span className="font-mono text-sm">{project.projectId}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 border-b border-border/40 px-4 pb-3 pt-4 sm:px-6">
                <MessageSquare className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Project thread</h2>
                <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {projCommentsLoading ? "…" : projComments.length}
                </span>
              </div>

              {projCommentsLoading ? (
                <div className="space-y-4 p-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
                  <MessageSquare className="size-5 text-muted-foreground" />
                  <p className="text-sm font-medium">No posts yet</p>
                  <p className="text-xs text-muted-foreground">
                    Share updates, context, or questions for the whole project.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {projComments.map((c) => (
                    <li key={c._id} className="flex items-start gap-3 px-4 py-4 sm:px-6">
                      <UserInitialsAvatar
                        name={c.author?.name ?? "?"}
                        className="size-8 text-[10px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.author?.name ?? "Unknown"}
                          </span>
                          {c.author?.role && (
                            <RoleBadge role={c.author.role} />
                          )}
                          <span>· {formatDate(c.createdAt)}</span>
                        </div>
                        <div className="mt-2">
                          <RichTextViewer html={c.body} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-border/40 px-4 py-3 sm:px-6">
                {!projComposerOpen ? (
                  <button
                    type="button"
                    onClick={() => setProjComposerOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <MessageSquare className="size-4 text-muted-foreground" />
                    Post an update, question, or note for everyone…
                  </button>
                ) : (
                  <form onSubmit={postProjComment} className="space-y-3">
                    <FormAlert message={commentAlert} />
                    <RichTextEditor
                      value={newProjComment}
                      onChange={(v) => {
                        setNewProjComment(v);
                        if (commentAlert) setCommentAlert(null);
                      }}
                      placeholder="Post an update, question, or note for everyone on the project…"
                      minHeight="min-h-24"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewProjComment("");
                          setCommentAlert(null);
                          setProjComposerOpen(false);
                        }}
                        disabled={postingComment}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={postingComment} size="sm">
                        <Send className="mr-2 size-4" />
                        {postingComment ? "Posting…" : "Post to project"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 pb-3 sm:px-6">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Tasks</h2>
            <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tasksLoading ? "…" : tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => setView("board")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs",
                  view === "board"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <LayoutGrid className="size-3.5" /> Board
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 border-l px-2.5 py-1.5 text-xs",
                  view === "list"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <ListIcon className="size-3.5" /> List
              </button>
            </div>
            <Button size="sm" onClick={openCreateTask}>
              <Plus className="mr-2 size-4" /> Add task
            </Button>
          </div>
        </div>

        {tasksLoading ? (
          view === "board" ? (
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-md" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="space-y-2 p-4">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-40" />
                </li>
              ))}
            </ul>
          )
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
            <ListChecks className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">No tasks yet</p>
            <p className="text-xs text-muted-foreground">
              Create the first task to start tracking work.
            </p>
          </div>
        ) : view === "board" ? (
          <div className="overflow-x-auto">
            <div className="flex gap-4 px-4 py-3 min-w-max sm:px-6">
              {BOARD_COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col);
                const style = TASK_STATUS_STYLES[col];
                const isOver = dragOverCol === col;
                return (
                  <div
                    key={col}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverCol(col);
                    }}
                    onDragLeave={() =>
                      setDragOverCol((c) => (c === col ? null : c))
                    }
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingId) moveTask(draggingId, col);
                      setDraggingId(null);
                      setDragOverCol(null);
                    }}
                    className={cn(
                      "flex w-80 shrink-0 flex-col rounded-lg border bg-muted/30",
                      isOver && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("size-2 rounded-full", style.dot)}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          {style.label}
                        </span>
                      </div>
                      <span className="rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 p-2">
                      {colTasks.length === 0 ? (
                        <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                          Drop tasks here
                        </div>
                      ) : (
                        colTasks.map((t) => (
                          <KanbanCard
                            key={t._id}
                            task={t}
                            dragging={draggingId === t._id}
                            projectMembers={project.assignees}
                            onOpen={() => openTaskTab(t._id)}
                            onAssigneesChange={(next) =>
                              updateTaskAssignees(t._id, next)
                            }
                            onDragStart={() => setDraggingId(t._id)}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverCol(null);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-10 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</TableHead>
                  <TableHead className="h-10 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="h-10 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assignees</TableHead>
                  <TableHead className="h-10 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting</TableHead>
                  <TableHead className="h-10 w-36 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created by</TableHead>
                  <TableHead className="h-10 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks
                  .slice(
                    (listPage - 1) * LIST_PAGE_SIZE,
                    listPage * LIST_PAGE_SIZE
                  )
                  .map((t) => (
                  <TableRow
                    key={t._id}
                    className={cn(
                      "group cursor-pointer hover:bg-transparent",
                      STATUS_ROW_BG[t.status]
                    )}
                    onClick={() => openTaskTab(t._id)}
                  >
                    <TableCell className="px-3 py-2.5 text-sm font-medium">
                      <button
                        type="button"
                        className="text-left hover:text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskTab(t._id);
                        }}
                      >
                        {t.title}
                      </button>
                    </TableCell>
                    <TableCell
                      className="px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          moveTask(t._id, v as TaskStatusKey)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "h-7 w-[130px] gap-1.5 border-transparent px-2 text-xs font-medium shadow-none hover:border-border",
                            TASK_STATUS_STYLES[t.status].cls
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOARD_COLUMNS.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    TASK_STATUS_STYLES[s].dot
                                  )}
                                />
                                {TASK_STATUS_STYLES[s].label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell
                      className="px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TaskAssigneeRow
                        selected={t.assignees}
                        options={project.assignees}
                        onChange={(next) => updateTaskAssignees(t._id, next)}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <AssigneeBadges
                        users={t.reportingPersons}
                        max={3}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                      {t.createdBy?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tasks.length > LIST_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3 sm:px-6">
                <span className="text-xs text-muted-foreground">
                  Showing {(listPage - 1) * LIST_PAGE_SIZE + 1}-
                  {Math.min(listPage * LIST_PAGE_SIZE, tasks.length)} of{" "}
                  {tasks.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    disabled={listPage === 1}
                  >
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {listPage} /{" "}
                    {Math.max(1, Math.ceil(tasks.length / LIST_PAGE_SIZE))}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setListPage((p) =>
                        Math.min(
                          Math.ceil(tasks.length / LIST_PAGE_SIZE),
                          p + 1
                        )
                      )
                    }
                    disabled={
                      listPage >= Math.ceil(tasks.length / LIST_PAGE_SIZE)
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
            </div>
          </TabsContent>

          {openTaskTabs.map((t) => {
            const state = taskTabs[t._id];
            if (!state) return null;
            return (
              <TabsContent
                key={t._id}
                value={`task:${t._id}`}
                className="mt-4"
              >
                <div>
                  <div className="flex items-center gap-2 border-b border-border/40 px-4 pb-3 sm:px-6">
                    <MessageSquare className="size-4 text-muted-foreground" />
                    <h2 className="min-w-0 truncate text-sm font-semibold">
                      {t.title}
                    </h2>
                    <TaskStatusBadge status={t.status} />
                    <button
                      type="button"
                      onClick={() => closeTaskTab(t._id)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      Close tab
                    </button>
                  </div>

                  <div className="border-b border-border/40 px-4 py-4 sm:px-6">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t.createdBy && (
                        <>
                          <span>By {t.createdBy.name}</span>
                          <span>· {formatDate(t.createdAt)}</span>
                          <UserInitialsAvatar
                            name={t.createdBy.name}
                            className="size-5 text-[9px]"
                          />
                        </>
                      )}
                      {!t.createdBy && (
                        <span>{formatDate(t.createdAt)}</span>
                      )}
                    </div>
                    {t.description && t.description.trim() !== "" ? (
                      <RichTextViewer html={t.description} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No description.
                      </p>
                    )}
                  </div>

                  {state.loading ? (
                    <div className="space-y-4 p-4">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Skeleton className="size-8 rounded-full" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-40" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : state.comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 p-6 text-center">
                      <MessageSquare className="size-5 text-muted-foreground" />
                      <p className="text-sm font-medium">No comments yet</p>
                      <p className="text-xs text-muted-foreground">
                        Start the task discussion below.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {state.comments.map((c) => (
                        <li key={c._id} className="flex items-start gap-3 px-4 py-4 sm:px-6">
                          <UserInitialsAvatar
                            name={c.author?.name ?? "?"}
                            className="size-8 text-[10px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {c.author?.name ?? "Unknown"}
                              </span>
                              {c.author?.role && (
                                <RoleBadge role={c.author.role} />
                              )}
                              <span>· {formatDate(c.createdAt)}</span>
                            </div>
                            <div className="mt-2">
                              <RichTextViewer html={c.body} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t border-border/40 px-4 py-3 sm:px-6">
                    {!state.composerOpen ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateTaskTab(t._id, { composerOpen: true })
                        }
                        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        <MessageSquare className="size-4 text-muted-foreground" />
                        Reply to this task…
                      </button>
                    ) : (
                      <form
                        onSubmit={(e) => postTaskComment(e, t._id)}
                        className="space-y-3"
                      >
                        <FormAlert message={state.alert} />
                        <RichTextEditor
                          value={state.draft}
                          onChange={(v) => {
                            updateTaskTab(t._id, {
                              draft: v,
                              alert: state.alert ? null : state.alert,
                            });
                          }}
                          placeholder="Reply to this task…"
                          minHeight="min-h-20"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateTaskTab(t._id, {
                                draft: "",
                                alert: null,
                                composerOpen: false,
                              })
                            }
                            disabled={state.posting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={state.posting}
                            size="sm"
                          >
                            <Send className="mr-2 size-4" />
                            {state.posting ? "Posting…" : "Post comment"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
        </div>

        <aside className="border-border/40 lg:border-l">
          <div className="divide-y divide-border/40 text-sm">
            <SidebarRow label="Project">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-semibold">{project.name}</span>
                </span>
                <span className="text-muted-foreground">|</span>
                <span>
                  <span className="text-muted-foreground">ID:</span>{" "}
                  <span className="font-mono text-xs">{project.projectId}</span>
                </span>
              </div>
            </SidebarRow>

            <SidebarRow label="Reporting to">
              {project.reportingTo ? (
                <MinimalPerson user={project.reportingTo} />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </SidebarRow>

            <SidebarRow label="Timeline">
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDate(project.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formatDate(project.updatedAt)}</span>
                </div>
              </div>
            </SidebarRow>

            <div className="px-5 py-3">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Assignees
                </h3>
                <span className="ml-auto rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {project.assignees.length}
                </span>
              </div>
              <AssigneeAvatarRow
                users={project.assignees}
                canEdit={canEdit}
                existingIds={project.assignees.map((u) => u._id)}
                onAdd={addAssignee}
                onRemove={removeAssignee}
              />
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={handleCreateTask} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add task</DialogTitle>
              <DialogDescription>
                Create a task under {project.name}.
              </DialogDescription>
            </DialogHeader>

            <FormAlert message={taskAlert} />

            <div className="grid gap-1.5">
              <Label htmlFor="task-title">
                Title
                <RequiredMark />
              </Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => {
                  setTaskTitle(e.target.value);
                  if (taskErrors.title)
                    setTaskErrors((p) => ({ ...p, title: "" }));
                }}
                placeholder="Short, action-oriented title"
                aria-invalid={taskErrors.title ? true : undefined}
                className="shadow-none"
                autoFocus
              />
              <FieldError reserve message={taskErrors.title} />
            </div>

            <div className="grid gap-1.5">
              <Label>Description</Label>
              <RichTextEditor
                value={taskDesc}
                onChange={setTaskDesc}
                placeholder="Describe the task. Add notes, acceptance criteria, links…"
                minHeight="min-h-32"
                invalid={Boolean(taskErrors.description)}
              />
              <FieldError message={taskErrors.description} />
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={taskStatus}
                  onValueChange={(v) => setTaskStatus(v as TaskStatusKey)}
                >
                  <SelectTrigger className="w-full shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOARD_COLUMNS.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              TASK_STATUS_STYLES[s].dot
                            )}
                          />
                          {TASK_STATUS_STYLES[s].label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Reporting persons</Label>
                <ProjectUserPicker
                  options={project.assignees}
                  selected={taskReporting}
                  onChange={setTaskReporting}
                  placeholder="Select reporting persons"
                />
                <FieldError message={taskErrors.reportingPersons} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Assignees</Label>
              <ProjectUserPicker
                options={project.assignees}
                selected={taskAssignees}
                onChange={setTaskAssignees}
                placeholder="Select assignees"
              />
              <FieldError message={taskErrors.assignees} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTaskDialogOpen(false)}
                disabled={taskSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={taskSubmitting}>
                {taskSubmitting ? "Creating…" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MinimalPerson({ user }: { user: UserLite }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-2">
            <UserInitialsAvatar name={user.name} className="size-6 text-[10px]" />
            <span className="truncate text-sm">{user.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="text-xs">
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground">{user.email}</div>
            <div className="mt-0.5 text-muted-foreground">
              {user.role === "admin"
                ? "Admin"
                : user.role === "project_manager"
                ? "Project Manager"
                : "User"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const AVATAR_PALETTE = [
  "bg-sky-600 text-white dark:bg-sky-500",
  "bg-emerald-600 text-white dark:bg-emerald-500",
  "bg-violet-600 text-white dark:bg-violet-500",
  "bg-amber-600 text-white dark:bg-amber-500",
  "bg-rose-600 text-white dark:bg-rose-500",
  "bg-cyan-600 text-white dark:bg-cyan-500",
  "bg-fuchsia-600 text-white dark:bg-fuchsia-500",
  "bg-teal-600 text-white dark:bg-teal-500",
  "bg-orange-600 text-white dark:bg-orange-500",
  "bg-indigo-600 text-white dark:bg-indigo-500",
];

function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";
}

function AssigneeAvatarRow({
  users,
  canEdit,
  existingIds,
  onAdd,
  onRemove,
}: {
  users: UserLite[];
  canEdit: boolean;
  existingIds: string[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmUser, setConfirmUser] = useState<UserLite | null>(null);

  useEffect(() => {
    if (!pickerOpen) {
      setQuery("");
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ status: "active", limit: "20" });
        if (query) params.set("q", query);
        const res = await fetch(`/api/users?${params.toString()}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (res.ok) {
          setResults(
            (data.users ?? []).filter(
              (u: UserLite) => !existingIds.includes(u._id)
            )
          );
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pickerOpen, query, existingIds]);

  return (
    <div className="flex items-center">
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center -space-x-2">
          {users.map((u) => (
            <Tooltip key={u._id}>
              <TooltipTrigger asChild>
                <div className="group relative z-0 transition-transform hover:z-20 hover:scale-110">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold",
                      colorForId(u._id)
                    )}
                  >
                    {initialsOf(u.name)}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove ${u.name}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setConfirmUser(u);
                      }}
                      className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-background bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {u.role === "admin"
                      ? "Admin"
                      : u.role === "project_manager"
                      ? "Project Manager"
                      : "User"}
                  </div>
                  {canEdit && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Click to remove
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {canEdit && (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add assignee"
              className={cn(
                "relative z-0 flex size-8 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-20 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
                users.length > 0 && "-ml-2"
              )}
            >
              <UserPlus className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0">
            <div className="border-b p-2">
              <InputGroup className="h-8 shadow-none">
                <InputGroupAddon>
                  <Search className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Search people"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </InputGroup>
            </div>
            <div className="max-h-60 overflow-auto py-1">
              {loading ? (
                <div className="p-2 text-xs text-muted-foreground">
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">
                  No users available.
                </div>
              ) : (
                results.map((u) => (
                  <button
                    type="button"
                    key={u._id}
                    onClick={() => {
                      onAdd(u._id);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset",
                        colorForId(u._id)
                      )}
                    >
                      {initialsOf(u.name)}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate font-medium">{u.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <AlertDialog
        open={Boolean(confirmUser)}
        onOpenChange={(open) => !open && setConfirmUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignee?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser
                ? `${confirmUser.name} (${confirmUser.email}) will no longer see this project in their list.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmUser) onRemove(confirmUser._id);
                setConfirmUser(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SidebarRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PersonLine({ user }: { user: UserLite }) {
  return (
    <div className="flex items-center gap-3">
      <UserInitialsAvatar name={user.name} className="size-9" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
      <RoleBadge role={user.role} />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-32" />
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/projects"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to projects
      </Link>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" />
        </div>
        <p className="mt-4 text-sm font-medium">Couldn&apos;t load project</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            toast.info("Retrying…");
            window.location.reload();
          }}
        >
          <RefreshCw className="mr-2 size-3.5" /> Retry
        </Button>
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  dragging,
  projectMembers,
  onOpen,
  onAssigneesChange,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  dragging: boolean;
  projectMembers: UserLite[];
  onOpen: () => void;
  onAssigneesChange: (next: UserLite[]) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task._id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab select-none rounded-lg border p-4 shadow-sm transition-all hover:shadow-md",
        TASK_STATUS_STYLES[task.status].card,
        dragging && "opacity-40 cursor-grabbing"
      )}
    >
      <div className="text-sm font-semibold leading-snug line-clamp-2">
        {task.title}
      </div>
      {task.description && task.description.trim() !== "" && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {task.description.replace(/<[^>]+>/g, "").slice(0, 140)}
        </p>
      )}
      <div
        className="mt-4 flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        draggable={false}
        onDragStart={(e) => e.stopPropagation()}
      >
        <TaskAssigneeRow
          selected={task.assignees}
          options={projectMembers}
          onChange={onAssigneesChange}
        />
      </div>
    </div>
  );
}

function TaskAssigneeRow({
  selected,
  options,
  onChange,
}: {
  selected: UserLite[];
  options: UserLite[];
  onChange: (next: UserLite[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmUser, setConfirmUser] = useState<UserLite | null>(null);

  useEffect(() => {
    if (!pickerOpen) setQuery("");
  }, [pickerOpen]);

  const selectedIds = selected.map((s) => s._id);
  const q = query.trim().toLowerCase();
  const available = options
    .filter((u) => !selectedIds.includes(u._id))
    .filter((u) =>
      !q
        ? true
        : u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
    );

  function addUser(u: UserLite) {
    onChange([...selected, u]);
    setPickerOpen(false);
  }

  function confirmRemove() {
    if (!confirmUser) return;
    onChange(selected.filter((s) => s._id !== confirmUser._id));
    setConfirmUser(null);
  }

  return (
    <div className="flex items-center">
      <TooltipProvider delayDuration={150}>
        <div className="flex items-center -space-x-2">
          {selected.map((u) => (
            <Tooltip key={u._id}>
              <TooltipTrigger asChild>
                <div className="group relative z-0 transition-transform hover:z-20 hover:scale-110">
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border-2 border-background text-[9px] font-semibold",
                      colorForId(u._id)
                    )}
                  >
                    {initialsOf(u.name)}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${u.name}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmUser(u);
                    }}
                    className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-background bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-xs">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Click to remove
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add assignee"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative z-0 flex size-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background text-muted-foreground transition-all hover:z-20 hover:scale-110 hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
              selected.length > 0 && "-ml-2"
            )}
          >
            <UserPlus className="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b p-2">
            <InputGroup className="h-8 shadow-none">
              <InputGroupAddon>
                <Search className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search project members"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </InputGroup>
          </div>
          <div className="max-h-56 overflow-auto py-1">
            {options.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                No project members yet.
              </div>
            ) : available.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">
                {selected.length === options.length
                  ? "All project members assigned."
                  : "No matches."}
              </div>
            ) : (
              available.map((u) => (
                <button
                  type="button"
                  key={u._id}
                  onClick={() => addUser(u)}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold",
                      colorForId(u._id)
                    )}
                  >
                    {initialsOf(u.name)}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={Boolean(confirmUser)}
        onOpenChange={(open) => !open && setConfirmUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove assignee?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmUser
                ? `${confirmUser.name} will be removed from this task's assignees.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectUserPicker({
  options,
  selected,
  onChange,
  placeholder = "Select people",
}: {
  options: UserLite[];
  selected: UserLite[];
  onChange: (list: UserLite[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  })();

  function toggle(u: UserLite) {
    if (selected.some((s) => s._id === u._id)) {
      onChange(selected.filter((s) => s._id !== u._id));
    } else {
      onChange([...selected, u]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-left text-sm shadow-none",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none"
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1">{placeholder}</span>
          ) : (
            selected.map((u) => (
              <span
                key={u._id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full pl-0.5 pr-1.5 py-0.5 text-xs font-medium text-white",
                  colorForId(u._id)
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[9px]">
                  {initialsOf(u.name)}
                </span>
                {u.name}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${u.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(u);
                  }}
                  className="ml-0.5 cursor-pointer rounded-full hover:bg-white/20"
                >
                  <X className="size-3" />
                </span>
              </span>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <div className="border-b p-2">
          <InputGroup className="h-8 shadow-none">
            <InputGroupAddon>
              <Search className="text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search project members"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </InputGroup>
        </div>
        <div className="max-h-60 overflow-auto py-1">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              No project members yet. Add assignees to the project first.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No matches.</div>
          ) : (
            filtered.map((u) => {
              const sel = selected.some((s) => s._id === u._id);
              return (
                <button
                  type="button"
                  key={u._id}
                  onClick={() => toggle(u)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent",
                    sel && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold border-2 border-background",
                      colorForId(u._id)
                    )}
                  >
                    {initialsOf(u.name)}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </div>
                  {sel && <X className="size-4 text-muted-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AssigneeBadges({
  users,
  max = 3,
  size = "md",
}: {
  users: UserLite[];
  max?: number;
  size?: "sm" | "md";
}) {
  if (!users || users.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground">Unassigned</span>
    );
  }
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  const sizeCls =
    size === "sm"
      ? "size-6 text-[9px]"
      : "size-7 text-[10px]";
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-2">
        {shown.map((u) => (
          <Tooltip key={u._id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative z-0 flex items-center justify-center rounded-full border-2 border-background font-semibold transition-transform hover:z-20 hover:scale-110",
                  sizeCls,
                  colorForId(u._id)
                )}
              >
                {initialsOf(u.name)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-xs">
                <div className="font-medium">{u.name}</div>
                <div className="text-muted-foreground">{u.email}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <span
            className={cn(
              "relative z-0 flex items-center justify-center rounded-full border-2 border-background bg-muted font-semibold text-muted-foreground",
              sizeCls
            )}
          >
            +{extra}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
