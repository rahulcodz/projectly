"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusBadge,
  UserInitialsAvatar,
} from "@/components/role-status-badge";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";

type UserLite = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

type Project = {
  _id: string;
  projectId: string;
  name: string;
  status: "active" | "inactive";
  createdBy: UserLite | null;
  reportingTo: UserLite | null;
  assignees: UserLite[];
  createdAt?: string;
};

type Session = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

type StatusFilter = "all" | "active" | "inactive";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

const emptyForm = {
  name: "",
  status: "active" as "active" | "inactive",
  reportingTo: "",
  assignees: [] as string[],
};

export default function ProjectsPage() {
  const [session, setSession] = useState<Session | null>(null);

  const [reportingUser, setReportingUser] = useState<UserLite | null>(null);
  const [assigneeUsers, setAssigneeUsers] = useState<UserLite[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [nextId, setNextId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formAlert, setFormAlert] = useState<string | null>(null);

  const canEdit = session?.role === "admin" || session?.role === "project_manager";

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
  }, [statusFilter, limit]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (res.ok) setSession(data.user);
      } catch {}
    })();
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projects");
      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedQuery, statusFilter]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);
  const hasFilters = Boolean(debouncedQuery) || statusFilter !== "all";

  async function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setReportingUser(null);
    setAssigneeUsers([]);
    setFormErrors({});
    setFormAlert(null);
    setDialogOpen(true);
    try {
      const res = await fetch("/api/projects?peekId=1");
      const data = await res.json();
      if (res.ok) setNextId(data.nextId ?? "—");
    } catch {
      setNextId("—");
    }
  }

  function openEdit(p: Project) {
    setEditing(p);
    setNextId(p.projectId);
    setForm({
      name: p.name,
      status: p.status,
      reportingTo: p.reportingTo?._id ?? "",
      assignees: p.assignees.map((a) => a._id),
    });
    setReportingUser(p.reportingTo ?? null);
    setAssigneeUsers(p.assignees ?? []);
    setFormErrors({});
    setFormAlert(null);
    setDialogOpen(true);
  }

  function validateProjectForm(): FieldErrors {
    const errs: FieldErrors = {};
    if (form.name.trim().length < 2)
      errs.name = "Project name must be at least 2 characters";
    if (!form.reportingTo) errs.reportingTo = "Select a reporting person";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormAlert(null);

    const localErrs = validateProjectForm();
    if (Object.keys(localErrs).length > 0) {
      setFormErrors(localErrs);
      return;
    }
    setFormErrors({});

    setSubmitting(true);
    try {
      const isEdit = Boolean(editing);
      const url = isEdit ? `/api/projects/${editing!._id}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) {
          setFormErrors(fieldErrors);
        } else {
          setFormAlert(message);
        }
        return;
      }
      toast.success(isEdit ? "Project updated" : "Project created");
      setDialogOpen(false);
      await loadProjects();
    } catch (err) {
      setFormAlert(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/projects/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Project deleted");
      setDeleteTarget(null);
      if (projects.length === 1 && page > 1) setPage(page - 1);
      else await loadProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Projects
        </h1>
        {canEdit && (
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 size-4" /> Add project
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">All projects</h2>
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
              placeholder="Search name or project id"
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
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className={`w-full sm:w-36 ${controlClasses}`}>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
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

      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="w-24 border-r">ID</TableHead>
              <TableHead className="border-r">Name</TableHead>
              <TableHead className="border-r">Status</TableHead>
              <TableHead className="border-r">Reporting to</TableHead>
              <TableHead className="border-r">Assignees</TableHead>
              <TableHead className="border-r">Created by</TableHead>
              {canEdit && (
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="border-r">
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell className="border-r">
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell className="border-r">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell className="border-r">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className="border-r">
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </TableCell>
                  <TableCell className="border-r">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  {canEdit && <TableCell />}
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="h-40"
                >
                  <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => (
                <TableRow key={p._id}>
                  <TableCell className="border-r font-mono text-xs">
                    {p.projectId}
                  </TableCell>
                  <TableCell className="border-r font-medium">
                    <Link
                      href={`/dashboard/projects/${p._id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell className="border-r">
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="border-r">
                    <PersonChip user={p.reportingTo} />
                  </TableCell>
                  <TableCell className="border-r">
                    <AssigneeStack assignees={p.assignees} />
                  </TableCell>
                  <TableCell className="border-r text-sm text-muted-foreground">
                    {p.createdBy?.name ?? "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <RowActions
                        onEdit={() => openEdit(p)}
                        onDelete={() => setDeleteTarget(p)}
                      />
                    </TableCell>
                  )}
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
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border p-4">
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {projects.map((p) => (
              <li key={p._id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">
                      {p.projectId}
                    </div>
                    <Link
                      href={`/dashboard/projects/${p._id}`}
                      className="font-medium truncate hover:text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                  </div>
                  {canEdit && (
                    <RowActions
                      onEdit={() => openEdit(p)}
                      onDelete={() => setDeleteTarget(p)}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={p.status} />
                  {p.reportingTo && (
                    <span>Reports: {p.reportingTo.name}</span>
                  )}
                  <span>Created by: {p.createdBy?.name ?? "—"}</span>
                </div>
                <AssigneeStack assignees={p.assignees} />
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

      {canEdit && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Edit project" : "Add project"}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Update project details, reporting person, and assignees."
                    : "Create a new project. Project ID is auto-generated."}
                </DialogDescription>
              </DialogHeader>

              <FormAlert message={formAlert} />

              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_2fr]">
                <div className="grid gap-1.5">
                  <Label htmlFor="projectId">Project ID</Label>
                  <Input
                    id="projectId"
                    value={nextId}
                    disabled
                    readOnly
                    className={`${controlClasses} font-mono`}
                  />
                  <FieldError reserve message="" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="name">
                    Project name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      if (formErrors.name)
                        setFormErrors((p) => ({ ...p, name: "" }));
                    }}
                    placeholder="Apollo launch"
                    aria-invalid={formErrors.name ? true : undefined}
                    className={controlClasses}
                    autoFocus={!editing}
                  />
                  <FieldError reserve message={formErrors.name} />
                </div>
              </div>

              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        status: v as "active" | "inactive",
                      })
                    }
                  >
                    <SelectTrigger className={`w-full ${controlClasses}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError reserve message="" />
                </div>
                <div className="grid gap-1.5">
                  <Label>
                    Reporting to
                    <RequiredMark />
                  </Label>
                  <ReportingPicker
                    selected={reportingUser}
                    onChange={(u) => {
                      setReportingUser(u);
                      setForm((f) => ({ ...f, reportingTo: u?._id ?? "" }));
                      if (formErrors.reportingTo)
                        setFormErrors((p) => ({ ...p, reportingTo: "" }));
                    }}
                  />
                  <FieldError reserve message={formErrors.reportingTo} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Assignees</Label>
                <AssigneesPicker
                  selected={assigneeUsers}
                  onChange={(list) => {
                    setAssigneeUsers(list);
                    setForm((f) => ({
                      ...f,
                      assignees: list.map((u) => u._id),
                    }));
                    if (formErrors.assignees)
                      setFormErrors((p) => ({ ...p, assignees: "" }));
                  }}
                />
                {formErrors.assignees ? (
                  <FieldError message={formErrors.assignees} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Assigned users will see this project in their list.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Saving…"
                    : editing
                    ? "Save changes"
                    : "Create project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" (${deleteTarget.projectId}) will be permanently removed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PersonChip({ user }: { user: UserLite | null }) {
  if (!user) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <UserInitialsAvatar name={user.name} className="size-6 text-[10px]" />
      <span className="text-sm">{user.name}</span>
    </div>
  );
}

function AssigneeStack({ assignees }: { assignees: UserLite[] }) {
  if (!assignees || assignees.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const shown = assignees.slice(0, 4);
  const extra = assignees.length - shown.length;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-2">
        {shown.map((a) => (
          <Tooltip key={a._id}>
            <TooltipTrigger asChild>
              <div className="ring-2 ring-background rounded-full">
                <UserInitialsAvatar
                  name={a.name}
                  className="size-7 text-[10px]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{a.name}</TooltipContent>
          </Tooltip>
        ))}
        {extra > 0 && (
          <span className="ring-2 ring-background flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            +{extra}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}

function useUserSearch(open: boolean) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: "active",
        limit: "20",
      });
      if (q) params.set("q", q);
      const res = await fetch(`/api/users?${params.toString()}`, {
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.users ?? []);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      run(query.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, run]);

  useEffect(() => {
    if (open && results.length === 0 && !loading && !query) {
      run("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return { query, setQuery, results, loading, error };
}

function UserSearchList({
  loading,
  error,
  results,
  isSelected,
  onPick,
}: {
  loading: boolean;
  error: string | null;
  results: UserLite[];
  isSelected: (id: string) => boolean;
  onPick: (u: UserLite) => void;
}) {
  return (
    <div className="max-h-60 overflow-auto py-1">
      {loading ? (
        <div className="space-y-1 px-2 py-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-3 py-3 text-xs text-destructive">{error}</div>
      ) : results.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          No users found.
        </div>
      ) : (
        results.map((u) => {
          const sel = isSelected(u._id);
          return (
            <button
              type="button"
              key={u._id}
              onClick={() => onPick(u)}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent",
                sel && "bg-primary/5"
              )}
            >
              <UserInitialsAvatar
                name={u.name}
                className="size-6 text-[10px]"
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate font-medium">{u.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email}
                </div>
              </div>
              <Check
                className={cn(
                  "size-4 text-primary",
                  sel ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          );
        })
      )}
    </div>
  );
}

function ReportingPicker({
  selected,
  onChange,
}: {
  selected: UserLite | null;
  onChange: (u: UserLite | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading, error } = useUserSearch(open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none",
            controlClasses
          )}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <UserInitialsAvatar
                name={selected.name}
                className="size-5 text-[9px]"
              />
              <span className="truncate">{selected.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {selected.email}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select person</span>
          )}
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <div className="border-b p-2">
          <InputGroup className={`h-8 ${controlClasses}`}>
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
        <UserSearchList
          loading={loading}
          error={error}
          results={results}
          isSelected={(id) => selected?._id === id}
          onPick={(u) => {
            onChange(u);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function AssigneesPicker({
  selected,
  onChange,
}: {
  selected: UserLite[];
  onChange: (list: UserLite[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, loading, error } = useUserSearch(open);

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
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1.5 text-left text-sm",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/30 focus:outline-none",
            controlClasses
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1">Select assignees</span>
          ) : (
            selected.map((u) => (
              <span
                key={u._id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-1 pr-1.5 py-0.5 text-xs font-medium text-primary"
              >
                <UserInitialsAvatar
                  name={u.name}
                  className="size-4 text-[9px]"
                />
                {u.name}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${u.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(u);
                  }}
                  className="ml-0.5 cursor-pointer rounded-full hover:bg-primary/20"
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
          <InputGroup className={`h-8 ${controlClasses}`}>
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
        <UserSearchList
          loading={loading}
          error={error}
          results={results}
          isSelected={(id) => selected.some((s) => s._id === id)}
          onPick={(u) => toggle(u)}
        />
      </PopoverContent>
    </Popover>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 hover:text-primary"
              onClick={onEdit}
              aria-label="Edit project"
            >
              <Pencil className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={onDelete}
              aria-label="Delete project"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">
        {hasFilters ? "No projects match your filters" : "No projects yet"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilters
          ? "Try a different search term or clear filters."
          : "Create your first project to get started."}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
          <X className="mr-1 size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}
