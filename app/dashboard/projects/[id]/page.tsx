"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  FolderKanban,
  LayoutGrid,
  List as ListIcon,
  ListChecks,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
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
import {
  RichTextEditor,
  RichTextViewer,
  type HashTask,
} from "@/components/rich-text-editor";
import { MentionInput } from "@/components/mention-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  PriorityBadge,
  PrioritySelect,
} from "@/components/priority-badge";
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
import {
  type FieldErrors,
  parseApiError,
  parseJsonResponse,
} from "@/lib/form-errors";

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

type Subtask = {
  _id: string;
  title: string;
  completed: boolean;
};

type TaskPriorityKey = "low" | "medium" | "high" | "urgent";

type Task = {
  _id: string;
  taskId?: string | null;
  title: string;
  description: string;
  status: TaskStatusKey;
  priority: TaskPriorityKey;
  assignedDate: string | null;
  dueDate: string | null;
  createdBy: UserLite | null;
  assignees: UserLite[];
  reportingPersons: UserLite[];
  subtasks?: Subtask[];
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

function formatShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function DueDateCell({
  due,
  status,
}: {
  due: string | null;
  status: TaskStatusKey;
}) {
  if (!due) return <span className="text-xs text-muted-foreground">—</span>;
  const dueDate = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueMidnight = new Date(dueDate);
  dueMidnight.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (dueMidnight.getTime() - today.getTime()) / (24 * 3600 * 1000)
  );
  const isDone = status === "done";
  const overdue = !isDone && diffDays < 0;
  const soon = !isDone && diffDays >= 0 && diffDays <= 2;
  return (
    <span
      className={cn(
        "text-xs font-medium",
        overdue && "text-rose-600 dark:text-rose-400",
        soon && !overdue && "text-amber-600 dark:text-amber-400",
        !overdue && !soon && "text-muted-foreground"
      )}
      title={dueDate.toLocaleDateString()}
    >
      {formatShortDate(due)}
      {overdue ? " · overdue" : ""}
    </span>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taskParam = searchParams?.get("task") ?? null;
  const editParam = searchParams?.get("edit") ?? null;
  const id = params?.id;

  const [project, setProject] = useState<Project | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskEditId, setTaskEditId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatusKey>("todo");
  const [taskPriority, setTaskPriority] = useState<TaskPriorityKey>("medium");
  const [taskAssignedDate, setTaskAssignedDate] = useState<Date | null>(null);
  const [taskDueDate, setTaskDueDate] = useState<Date | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 10;
  const [taskQuery, setTaskQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<
    "all" | TaskStatusKey
  >("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<
    "all" | TaskPriorityKey
  >("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>("all");
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const filteredTasks = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false;
      if (taskStatusFilter !== "all" && t.status !== taskStatusFilter)
        return false;
      if (taskPriorityFilter !== "all" && t.priority !== taskPriorityFilter)
        return false;
      if (taskAssigneeFilter !== "all") {
        if (taskAssigneeFilter === "__unassigned") {
          if ((t.assignees?.length ?? 0) > 0) return false;
        } else if (
          !(t.assignees ?? []).some((a) => a._id === taskAssigneeFilter)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, taskQuery, taskStatusFilter, taskPriorityFilter, taskAssigneeFilter]);

  const hasTaskFilters =
    Boolean(taskQuery.trim()) ||
    taskStatusFilter !== "all" ||
    taskPriorityFilter !== "all" ||
    taskAssigneeFilter !== "all";

  useEffect(() => {
    setListPage(1);
  }, [taskQuery, taskStatusFilter, taskPriorityFilter, taskAssigneeFilter]);

  const hashTasks = useMemo(() => {
    if (!project) return [];
    return tasks
      .filter((t) => t.taskId)
      .map((t) => ({
        _id: t._id,
        taskId: t.taskId as string,
        title: t.title,
        projectId: project._id,
      }));
  }, [tasks, project]);

  const projectMembers = useMemo(() => {
    if (!project) return [];
    const list: {
      _id: string;
      name: string;
      email?: string;
      role?: UserRole;
    }[] = [];
    const seen = new Set<string>();
    const push = (u: UserLite | null | undefined) => {
      if (!u?._id || seen.has(u._id)) return;
      seen.add(u._id);
      list.push({ _id: u._id, name: u.name, email: u.email, role: u.role });
    };
    push(project.reportingTo);
    push(project.createdBy);
    for (const a of project.assignees) push(a);
    return list;
  }, [project]);

  const mentionUsersForTask = useCallback(
    (taskId: string) => {
      const t = tasks.find((x) => x._id === taskId);
      if (!t) return projectMembers;
      const list = [...projectMembers];
      const seen = new Set(list.map((u) => u._id));
      const push = (u: UserLite | null | undefined) => {
        if (!u?._id || seen.has(u._id)) return;
        seen.add(u._id);
        list.push({ _id: u._id, name: u.name, email: u.email, role: u.role });
      };
      for (const a of t.assignees) push(a);
      for (const a of t.reportingPersons) push(a);
      push(t.createdBy);
      return list;
    },
    [projectMembers, tasks]
  );

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
      if (!res.ok) {
        const { message } = await parseApiError(res);
        throw new Error(message || "Failed to load project");
      }
      const data = await parseJsonResponse<{ project: Project }>(res);
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
      if (!res.ok) {
        const { message } = await parseApiError(res);
        throw new Error(message || "Failed to load tasks");
      }
      const data = await parseJsonResponse<{ tasks: Task[] }>(res);
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

  const editHandledRef = useRef(false);
  useEffect(() => {
    if (editParam !== "1" || !taskParam || !project) return;
    if (editHandledRef.current) return;
    const t = tasks.find((x) => x._id === taskParam);
    if (!t) return;
    editHandledRef.current = true;
    openEditTask(t);
    if (pathname) {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      sp.delete("edit");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, taskParam, project, tasks]);

  const loadProjComments = useCallback(async () => {
    if (!id) return;
    setProjCommentsLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/comments`);
      if (!res.ok) {
        const { message } = await parseApiError(res);
        throw new Error(message || "Failed to load discussion");
      }
      const data = await parseJsonResponse<{ comments: CommentT[] }>(res);
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
    if (typeof window === "undefined") return;
    try {
      const v = localStorage.getItem("projectly:sidebar");
      if (v === "0") setSidebarOpen(false);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("projectly:sidebar", sidebarOpen ? "1" : "0");
    } catch {}
  }, [sidebarOpen]);

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

  useEffect(() => {
    if (!project || !hydratedRef.current) return;
    if (!taskParam) return;
    setOpenTaskIds((prev) =>
      prev.includes(taskParam) ? prev : [...prev, taskParam]
    );
    setTaskTabs((prev) =>
      prev[taskParam]
        ? prev
        : {
            ...prev,
            [taskParam]: {
              comments: [],
              loading: true,
              draft: "",
              composerOpen: false,
              alert: null,
              posting: false,
            },
          }
    );
    setTab(`task:${taskParam}`);
    if (!taskTabs[taskParam]) loadTaskComments(taskParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskParam, project]);

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
    if (taskParam === taskId && pathname) {
      router.replace(pathname);
    }
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

    if (newStatus === "done") {
      const subs = existing.subtasks ?? [];
      if (subs.length > 0 && subs.some((s) => !s.completed)) {
        toast.error("Complete all subtasks before marking task done");
        return;
      }
    }

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

  async function saveSubtasks(
    taskId: string,
    nextSubtasks: Subtask[],
    subtaskMention?: { title: string; mentionIds: string[] }
  ) {
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) =>
        t._id === taskId ? { ...t, subtasks: nextSubtasks } : t
      )
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subtasks: nextSubtasks.map((s) => ({
            _id: s._id.startsWith("tmp-") ? undefined : s._id,
            title: s.title,
            completed: s.completed,
          })),
          ...(subtaskMention && subtaskMention.mentionIds.length > 0
            ? { subtaskMention }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTasks(prev);
        toast.error(data.error || "Failed to update subtasks");
        return;
      }
      const serverSubtasks = (data.task?.subtasks ?? []) as Subtask[];
      setTasks((ts) =>
        ts.map((t) =>
          t._id === taskId ? { ...t, subtasks: serverSubtasks } : t
        )
      );
    } catch (err) {
      setTasks(prev);
      toast.error(err instanceof Error ? err.message : "Failed to update subtasks");
    }
  }

  function openCreateTask() {
    setTaskEditId(null);
    setTaskTitle("");
    setTaskDesc("");
    setTaskStatus("todo");
    setTaskPriority("medium");
    setTaskAssignedDate(null);
    setTaskDueDate(null);
    setTaskAssignees([]);
    setTaskReporting([]);
    setTaskErrors({});
    setTaskAlert(null);
    setTaskDialogOpen(true);
  }

  function openEditTask(t: Task) {
    setTaskEditId(t._id);
    setTaskTitle(t.title);
    setTaskDesc(t.description ?? "");
    setTaskStatus(t.status);
    setTaskPriority(t.priority ?? "medium");
    setTaskAssignedDate(t.assignedDate ? new Date(t.assignedDate) : null);
    setTaskDueDate(t.dueDate ? new Date(t.dueDate) : null);
    setTaskAssignees(t.assignees);
    setTaskReporting(t.reportingPersons);
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
    const isEdit = Boolean(taskEditId);
    try {
      const url = isEdit
        ? `/api/tasks/${taskEditId}`
        : `/api/projects/${id}/tasks`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          status: taskStatus,
          priority: taskPriority,
          assignedDate: taskAssignedDate
            ? taskAssignedDate.toISOString()
            : null,
          dueDate: taskDueDate ? taskDueDate.toISOString() : null,
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
      toast.success(isEdit ? "Task updated" : "Task created");
      setTaskDialogOpen(false);
      setTaskEditId(null);
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
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] flex-col sm:-mx-6 sm:-my-8 lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      <div
        className={cn(
          "grid flex-1 lg:min-h-0",
          sidebarOpen
            ? "lg:grid-cols-[minmax(0,1fr)_320px]"
            : "lg:grid-cols-[minmax(0,1fr)_40px]"
        )}
      >
        <div className="flex min-w-0 flex-col lg:min-h-0">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-w-0 flex-1 flex-col lg:min-h-0"
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

          <TabsContent
            value="overview"
            className="mt-2 flex-1 lg:min-h-0 lg:overflow-y-auto"
          >
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/40 px-4 pb-2 text-sm sm:px-6">
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
              <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 sm:px-6">
                <MessageSquare className="size-3.5 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Project thread</h2>
                <span className="rounded-full border bg-background px-1.5 py-0 text-[11px] font-medium text-muted-foreground">
                  {projCommentsLoading ? "…" : projComments.length}
                </span>
              </div>

              {projCommentsLoading ? (
                <div className="space-y-3 p-3 sm:px-6">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Skeleton className="size-7 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : projComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-0.5 p-3 text-center">
                  <MessageSquare className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium">No posts yet</p>
                  <p className="text-xs text-muted-foreground">
                    Share updates, context, or questions for the whole project.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {projComments.map((c) => (
                    <li key={c._id} className="flex items-start gap-2 px-4 py-1.5 sm:px-6">
                      <UserInitialsAvatar
                        name={c.author?.name ?? "?"}
                        role={c.author?.role}
                        className="size-6 text-[9px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.author?.name ?? "Unknown"}
                          </span>
                          {c.author?.role && (
                            <RoleBadge role={c.author.role} />
                          )}
                          <span>· {formatDate(c.createdAt)}</span>
                        </div>
                        <div className="mt-1">
                          <RichTextViewer html={c.body} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-border/40 px-4 py-1.5 sm:px-6">
                {!projComposerOpen ? (
                  <button
                    type="button"
                    onClick={() => setProjComposerOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-1 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <MessageSquare className="size-3.5 text-muted-foreground" />
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
                      placeholder="Share an update — @mention people, #link tasks, paste URLs…"
                      minHeight="min-h-24"
                      mentionUsers={projectMembers}
                      hashTasks={hashTasks}
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

          <TabsContent
            value="tasks"
            className="mt-2 flex flex-1 flex-col lg:min-h-0"
          >
            <div className="flex flex-1 flex-col lg:min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-2 sm:px-6 shrink-0">
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

        {tasks.length > 0 && !tasksLoading ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2 sm:px-6">
            <InputGroup className="h-8 w-full shadow-none sm:w-64">
              <InputGroupAddon>
                <Search className="size-3.5 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search title"
                value={taskQuery}
                onChange={(e) => setTaskQuery(e.target.value)}
              />
            </InputGroup>
            <Select
              value={taskStatusFilter}
              onValueChange={(v) =>
                setTaskStatusFilter(v as "all" | TaskStatusKey)
              }
            >
              <SelectTrigger size="sm" className="h-8 w-36 shadow-none">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
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
            <Select
              value={taskPriorityFilter}
              onValueChange={(v) =>
                setTaskPriorityFilter(v as "all" | TaskPriorityKey)
              }
            >
              <SelectTrigger size="sm" className="h-8 w-36 shadow-none">
                <SelectValue placeholder="All priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={taskAssigneeFilter}
              onValueChange={setTaskAssigneeFilter}
            >
              <SelectTrigger size="sm" className="h-8 w-44 shadow-none">
                <SelectValue placeholder="All assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="__unassigned">Unassigned</SelectItem>
                {project.assignees.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasTaskFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTaskQuery("");
                  setTaskStatusFilter("all");
                  setTaskPriorityFilter("all");
                  setTaskAssigneeFilter("all");
                }}
                className="h-8 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 size-3.5" /> Clear
              </Button>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {filteredTasks.length} of {tasks.length}
            </span>
          </div>
        ) : null}

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
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 p-8 text-center">
            <ListChecks className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">No tasks match filters</p>
            <p className="text-xs text-muted-foreground">
              Try clearing filters or adjusting search.
            </p>
          </div>
        ) : view === "board" ? (
          <div className="overflow-x-auto lg:flex-1 lg:min-h-0">
            <div className="flex gap-3 px-4 py-2 min-w-max sm:px-6 lg:h-full">
              {BOARD_COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col);
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
                      "flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border bg-muted/30 lg:h-full",
                      isOver && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 px-2.5 py-1.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn("size-2 rounded-full", style.dot)}
                        />
                        <span className="text-[11px] font-semibold uppercase tracking-wide">
                          {style.label}
                        </span>
                      </div>
                      <span className="rounded-full border bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-1.5 overflow-y-auto min-h-0 flex-1">
                      {colTasks.length === 0 ? (
                        <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                          Drop tasks here
                        </div>
                      ) : (
                        colTasks.map((t) => (
                          <KanbanCard
                            key={t._id}
                            task={t}
                            dragging={draggingId === t._id}
                            projectMembers={project.assignees}
                            canEdit={canEdit}
                            onOpen={() => openTaskTab(t._id)}
                            onEdit={() => openEditTask(t)}
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
          <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <div className="hidden md:block md:flex-1 md:overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-8 w-28 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ID</TableHead>
                  <TableHead className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Title</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="h-8 w-28 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Due</TableHead>
                  <TableHead className="h-8 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assignees</TableHead>
                  <TableHead className="h-8 w-40 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reporting</TableHead>
                  <TableHead className="h-8 w-36 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created by</TableHead>
                  <TableHead className="h-8 w-32 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks
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
                    <TableCell className="px-3 py-1.5">
                      {t.taskId ? (
                        <span className="font-mono text-sm text-muted-foreground">
                          {t.taskId}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-sm font-medium">
                      <div className="group/title flex items-center gap-2">
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
                        {canEdit && (
                          <button
                            type="button"
                            aria-label="Edit task"
                            title="Edit task"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditTask(t);
                            }}
                            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover/title:opacity-100"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5"
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
                    <TableCell className="px-3 py-1.5">
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-xs text-muted-foreground">
                      {formatShortDate(t.assignedDate)}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <DueDateCell
                        due={t.dueDate}
                        status={t.status}
                      />
                    </TableCell>
                    <TableCell
                      className="px-3 py-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TaskAssigneeRow
                        selected={t.assignees}
                        options={project.assignees}
                        onChange={(next) => updateTaskAssignees(t._id, next)}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <AssigneeBadges
                        users={t.reportingPersons}
                        max={3}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-sm text-muted-foreground">
                      {t.createdBy?.name ?? "—"}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatShortDate(t.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            <ul className="divide-y divide-border/40 md:hidden">
              {filteredTasks
                .slice(
                  (listPage - 1) * LIST_PAGE_SIZE,
                  listPage * LIST_PAGE_SIZE
                )
                .map((t) => (
                  <li
                    key={t._id}
                    className={cn("p-3", STATUS_ROW_BG[t.status])}
                    onClick={() => openTaskTab(t._id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {t.taskId ? (
                            <span className="font-mono">{t.taskId}</span>
                          ) : null}
                          <PriorityBadge priority={t.priority} />
                        </div>
                        <div className="truncate text-sm font-medium">
                          {t.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <TaskStatusBadge status={t.status} />
                          {t.dueDate ? (
                            <DueDateCell due={t.dueDate} status={t.status} />
                          ) : null}
                          <span>{formatShortDate(t.createdAt)}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AssigneeBadges
                          users={t.assignees}
                          max={3}
                          size="sm"
                        />
                      </div>
                    </div>
                  </li>
                ))}
            </ul>

            {filteredTasks.length > LIST_PAGE_SIZE && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/40 px-4 py-3 sm:px-6">
                <span className="text-xs text-muted-foreground">
                  Showing {(listPage - 1) * LIST_PAGE_SIZE + 1}-
                  {Math.min(listPage * LIST_PAGE_SIZE, filteredTasks.length)} of{" "}
                  {filteredTasks.length}
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
                    {Math.max(1, Math.ceil(filteredTasks.length / LIST_PAGE_SIZE))}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setListPage((p) =>
                        Math.min(
                          Math.ceil(filteredTasks.length / LIST_PAGE_SIZE),
                          p + 1
                        )
                      )
                    }
                    disabled={
                      listPage >= Math.ceil(filteredTasks.length / LIST_PAGE_SIZE)
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
                className="mt-2 flex-1 lg:min-h-0 lg:overflow-y-auto"
              >
                <div>
                  <div className="flex items-center gap-2 border-b border-border/40 px-4 py-2 sm:px-6">
                    <MessageSquare className="size-3.5 text-muted-foreground" />
                    {t.taskId ? (
                      <span className="font-mono text-sm text-muted-foreground">
                        {t.taskId}
                      </span>
                    ) : null}
                    <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {t.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => closeTaskTab(t._id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      Close tab
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-1.5 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Status
                      </span>
                      <Select
                        value={t.status}
                        onValueChange={(v) =>
                          moveTask(t._id, v as TaskStatusKey)
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "h-7 w-[140px] gap-1.5 border-transparent px-2 text-xs font-medium shadow-none hover:border-border",
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Assignees
                      </span>
                      <TaskAssigneeRow
                        selected={t.assignees}
                        options={project.assignees}
                        onChange={(next) =>
                          updateTaskAssignees(t._id, next)
                        }
                      />
                    </div>
                  </div>

                  <div className="border-b border-border/40 px-4 py-2 sm:px-6">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t.createdBy && (
                        <>
                          <span>By {t.createdBy.name}</span>
                          <span>· {formatDate(t.createdAt)}</span>
                          <UserInitialsAvatar
                            name={t.createdBy.name}
                            role={t.createdBy.role}
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

                  <SubtaskPanel
                    task={t}
                    mentionUsers={mentionUsersForTask(t._id)}
                    hashTasks={hashTasks}
                    onSave={(next, subtaskMention) =>
                      saveSubtasks(t._id, next, subtaskMention)
                    }
                  />

                  {state.loading ? (
                    <div className="space-y-3 p-3 sm:px-6">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Skeleton className="size-7 rounded-full" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3 w-40" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : state.comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-0.5 p-3 text-center">
                      <MessageSquare className="size-4 text-muted-foreground" />
                      <p className="text-sm font-medium">No comments yet</p>
                      <p className="text-xs text-muted-foreground">
                        Start the task discussion below.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {state.comments.map((c) => (
                        <li key={c._id} className="flex items-start gap-2 px-4 py-1.5 sm:px-6">
                          <UserInitialsAvatar
                            name={c.author?.name ?? "?"}
                            role={c.author?.role}
                            className="size-6 text-[9px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {c.author?.name ?? "Unknown"}
                              </span>
                              {c.author?.role && (
                                <RoleBadge role={c.author.role} />
                              )}
                              <span>· {formatDate(c.createdAt)}</span>
                            </div>
                            <div className="mt-1">
                              <RichTextViewer html={c.body} />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t border-border/40 px-4 py-1.5 sm:px-6">
                    {!state.composerOpen ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateTaskTab(t._id, { composerOpen: true })
                        }
                        className="flex w-full items-center gap-2 rounded-md border bg-background px-3 py-1 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      >
                        <MessageSquare className="size-3.5 text-muted-foreground" />
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
                          placeholder="Reply — @mention, #link tasks, paste URLs…"
                          minHeight="min-h-20"
                          mentionUsers={mentionUsersForTask(t._id)}
                          hashTasks={hashTasks}
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

        <aside className="relative flex flex-col border-border/40 lg:border-l">
          <div
            className={cn(
              "hidden h-10 shrink-0 items-center border-b border-border/40 px-2 lg:flex",
              sidebarOpen ? "justify-end" : "justify-center"
            )}
          >
            <button
              type="button"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {sidebarOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </button>
          </div>
          <div
            className={cn(
              "divide-y divide-border/40 text-sm",
              !sidebarOpen && "lg:hidden"
            )}
          >
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
              <DialogTitle>{taskEditId ? "Edit task" : "Add task"}</DialogTitle>
              <DialogDescription>
                {taskEditId
                  ? `Update details for this task in ${project.name}.`
                  : `Create a task under ${project.name}.`}
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
                placeholder="Describe the task — @mention people, #link tasks, paste URLs…"
                minHeight="min-h-32"
                invalid={Boolean(taskErrors.description)}
                mentionUsers={projectMembers}
                hashTasks={hashTasks}
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
                <Label>Priority</Label>
                <PrioritySelect
                  value={taskPriority}
                  onChange={setTaskPriority}
                  triggerClassName="h-9 w-full text-sm"
                  size="default"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="task-assigned">Assigned date</Label>
                <DatePicker
                  id="task-assigned"
                  value={taskAssignedDate}
                  onChange={setTaskAssignedDate}
                  placeholder="Pick start date"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <DatePicker
                  id="task-due"
                  value={taskDueDate}
                  onChange={setTaskDueDate}
                  placeholder="Pick due date"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Assignees</Label>
                <ProjectUserPicker
                  options={project.assignees}
                  selected={taskAssignees}
                  onChange={setTaskAssignees}
                  placeholder="Select assignees"
                  excludeIds={taskReporting.map((u) => u._id)}
                />
                <FieldError message={taskErrors.assignees} />
              </div>
              <div className="grid gap-1.5">
                <Label>Reporting persons</Label>
                <ProjectUserPicker
                  options={project.assignees}
                  selected={taskReporting}
                  onChange={setTaskReporting}
                  placeholder="Select reporting persons"
                  excludeIds={taskAssignees.map((u) => u._id)}
                />
                <FieldError message={taskErrors.reportingPersons} />
              </div>
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
                {taskSubmitting
                  ? taskEditId
                    ? "Saving…"
                    : "Creating…"
                  : taskEditId
                  ? "Save changes"
                  : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderSubtaskTitle(
  title: string,
  hashTasks: HashTask[] | undefined
) {
  if (!hashTasks || hashTasks.length === 0) return title;
  const byTaskId = new Map(hashTasks.map((t) => [t.taskId, t]));
  const parts: ReactNode[] = [];
  const re = /#([A-Za-z0-9_-]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(title)) !== null) {
    if (match.index > last) parts.push(title.slice(last, match.index));
    const ref = byTaskId.get(match[1]);
    if (ref) {
      parts.push(
        <a
          key={key++}
          href={`/dashboard/projects/${ref.projectId}?task=${ref.id}`}
          className="task-ref"
          data-type="hashtag"
          data-id={ref.id}
          data-label={ref.taskId}
          data-project-id={ref.projectId}
          onClick={(e) => e.stopPropagation()}
        >
          #{ref.taskId}
        </a>
      );
    } else {
      parts.push(match[0]);
    }
    last = match.index + match[0].length;
  }
  if (last < title.length) parts.push(title.slice(last));
  return parts;
}

function SubtaskPanel({
  task,
  mentionUsers,
  hashTasks,
  onSave,
}: {
  task: Task;
  mentionUsers?: {
    _id: string;
    name: string;
    email?: string;
    role?: UserRole;
  }[];
  hashTasks?: HashTask[];
  onSave: (
    next: Subtask[],
    subtaskMention?: { title: string; mentionIds: string[] }
  ) => void | Promise<void>;
}) {
  const subtasks = task.subtasks ?? [];
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<Subtask | null>(null);
  const [draftMentions, setDraftMentions] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editMentions, setEditMentions] = useState<Set<string>>(new Set());

  function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (title.length === 0) return;
    const next: Subtask[] = [
      ...subtasks,
      { _id: `tmp-${Date.now()}`, title, completed: false },
    ];
    const mentionIds = title.includes("@") ? Array.from(draftMentions) : [];
    setDraft("");
    setDraftMentions(new Set());
    setAdding(false);
    onSave(
      next,
      mentionIds.length > 0 ? { title, mentionIds } : undefined
    );
  }

  function toggle(id: string) {
    const next = subtasks.map((s) =>
      s._id === id ? { ...s, completed: !s.completed } : s
    );
    onSave(next);
  }

  function confirmRemove() {
    if (!pendingRemove) return;
    const id = pendingRemove._id;
    setPendingRemove(null);
    onSave(subtasks.filter((s) => s._id !== id));
  }

  function startEdit(s: Subtask) {
    setEditingId(s._id);
    setEditDraft(s.title);
    setEditMentions(new Set());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditMentions(new Set());
  }

  function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const title = editDraft.trim();
    if (title.length === 0) return;
    const target = subtasks.find((s) => s._id === editingId);
    if (!target) {
      cancelEdit();
      return;
    }
    if (title === target.title && editMentions.size === 0) {
      cancelEdit();
      return;
    }
    const next = subtasks.map((s) =>
      s._id === editingId ? { ...s, title } : s
    );
    const mentionIds =
      title.includes("@") && editMentions.size > 0
        ? Array.from(editMentions)
        : [];
    cancelEdit();
    onSave(
      next,
      mentionIds.length > 0 ? { title, mentionIds } : undefined
    );
  }

  return (
    <div className="border-b border-border/40 px-4 py-2 sm:px-6">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Subtasks
        </h3>
        <span className="rounded-full border bg-background px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
          {done}/{total}
        </span>
        {total > 0 && (
          <div className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allDone ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {task.status !== "done" && total > 0 && !allDone && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Task can&apos;t be Done until all subtasks complete
          </span>
        )}
      </div>

      {total > 0 && (
        <ul className="mb-1.5 flex flex-col gap-0.5">
          {subtasks.map((s) => {
            const isEditing = editingId === s._id;
            return (
              <li
                key={s._id}
                className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={s.completed}
                  onChange={() => toggle(s._id)}
                  disabled={isEditing}
                  className="size-4 accent-primary"
                />
                {isEditing ? (
                  <form
                    onSubmit={saveEdit}
                    className="flex flex-1 items-center gap-2"
                  >
                    <MentionInput
                      value={editDraft}
                      onChange={setEditDraft}
                      onMention={(id) =>
                        setEditMentions((prev) => {
                          const next = new Set(prev);
                          next.add(id);
                          return next;
                        })
                      }
                      mentionUsers={mentionUsers}
                      hashTasks={hashTasks}
                      placeholder="Edit subtask — @mention, #link tasks"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={editDraft.trim().length === 0}
                    >
                      <Check className="size-3.5" /> Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        s.completed && "text-muted-foreground line-through"
                      )}
                    >
                      {renderSubtaskTitle(s.title, hashTasks)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      aria-label="Edit subtask"
                      className="opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemove(s)}
                      aria-label="Remove subtask"
                      className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => !open && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this subtask?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `"${pendingRemove.title}" will be permanently removed from this task.`
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

      {adding ? (
        <form onSubmit={addSubtask} className="flex items-center gap-2">
          <MentionInput
            value={draft}
            onChange={setDraft}
            onMention={(id) =>
              setDraftMentions((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
              })
            }
            mentionUsers={mentionUsers}
            hashTasks={hashTasks}
            placeholder="New subtask — @mention, #link tasks"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={draft.trim().length === 0}>
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft("");
              setDraftMentions(new Set());
              setAdding(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="size-3.5" /> Add subtask
        </button>
      )}
    </div>
  );
}

function MinimalPerson({ user }: { user: UserLite }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-2">
            <UserInitialsAvatar name={user.name} role={user.role} className="size-6 text-[10px]" />
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

function colorForRole(role?: UserRole) {
  switch (role) {
    case "admin":
      return "bg-red-600 text-white";
    case "project_manager":
      return "bg-amber-500 text-white";
    case "user":
    default:
      return "bg-green-600 text-white";
  }
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
                <div className="relative z-0 hover:z-20">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 border-background text-[10px] font-semibold",
                      colorForRole(u.role)
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
                      className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-background bg-destructive text-white opacity-0 transition-opacity hover:opacity-100"
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
                        colorForRole(u.role)
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
      <UserInitialsAvatar name={user.name} role={user.role} className="size-9" />
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
  canEdit,
  onOpen,
  onEdit,
  onAssigneesChange,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  dragging: boolean;
  projectMembers: UserLite[];
  canEdit?: boolean;
  onOpen: () => void;
  onEdit?: () => void;
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
        "group cursor-grab select-none rounded-lg border p-2.5 shadow-sm transition-all hover:shadow-md",
        TASK_STATUS_STYLES[task.status].card,
        dragging && "opacity-40 cursor-grabbing"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.taskId ? (
            <span className="font-mono text-xs text-muted-foreground">
              {task.taskId}
            </span>
          ) : null}
          <PriorityBadge priority={task.priority} />
        </div>
        {canEdit && onEdit ? (
          <button
            type="button"
            aria-label="Edit task"
            title="Edit task"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            draggable={false}
            onDragStart={(e) => e.stopPropagation()}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-primary group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="text-sm font-semibold leading-snug line-clamp-2">
        {task.title}
      </div>
      {task.description && task.description.trim() !== "" && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description.replace(/<[^>]+>/g, "").slice(0, 140)}
        </p>
      )}
      {(task.assignedDate || task.dueDate) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {task.assignedDate ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="size-3" />
              <span className="font-medium text-foreground/80">Start</span>
              <span>{formatShortDate(task.assignedDate)}</span>
            </span>
          ) : null}
          {task.dueDate ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="size-3" />
              <span className="font-medium text-foreground/80">Due</span>
              <DueDateCell due={task.dueDate} status={task.status} />
            </span>
          ) : null}
        </div>
      )}
      <div
        className="mt-2 flex items-center justify-between gap-2"
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
                <div className="relative z-0 hover:z-20">
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border-2 border-background text-[9px] font-semibold",
                      colorForRole(u.role)
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
                    className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-background bg-destructive text-white opacity-0 transition-opacity hover:opacity-100"
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
                      colorForRole(u.role)
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
  excludeIds,
}: {
  options: UserLite[];
  selected: UserLite[];
  onChange: (list: UserLite[]) => void;
  placeholder?: string;
  excludeIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = (() => {
    const exclude = new Set(excludeIds ?? []);
    const base = exclude.size
      ? options.filter((u) => !exclude.has(u._id))
      : options;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
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
                  colorForRole(u.role)
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
                      colorForRole(u.role)
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
                  colorForRole(u.role)
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
