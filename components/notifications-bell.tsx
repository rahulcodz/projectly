"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  type NotificationItem,
} from "@/hooks/use-notifications";

function buildHref(n: NotificationItem): string | null {
  if (n.task && n.project) {
    return `/dashboard/projects/${n.project._id}?task=${n.task._id}`;
  }
  if (n.project) {
    return `/dashboard/projects/${n.project._id}`;
  }
  return null;
}

function formatTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

function Actor({ children }: { children: ReactNode }) {
  return (
    <span className="font-semibold text-foreground">{children}</span>
  );
}
function ProjectTag({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-blue-600 dark:text-blue-400">
      {children}
    </span>
  );
}
function TaskTag({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-amber-600 dark:text-amber-400">
      {children}
    </span>
  );
}
function SubtaskTag({ children }: { children: ReactNode }) {
  return (
    <span className="font-medium text-pink-600 dark:text-pink-400">
      {children}
    </span>
  );
}
function StatusTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
      {children}
    </span>
  );
}
function RoleTag({ children }: { children: ReactNode }) {
  return (
    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
      {children}
    </span>
  );
}

function roleLabel(role?: unknown): string {
  if (role === "assignee") return "assignee";
  if (role === "reportingTo") return "reporting";
  if (role === "reportingPerson") return "reporting";
  return String(role ?? "");
}

function renderPreview(n: NotificationItem): ReactNode {
  const actorName = n.actor?.name ?? "Someone";
  const actor = <Actor>{actorName}</Actor>;
  const project = n.project ? (
    <ProjectTag>{n.project.name}</ProjectTag>
  ) : null;
  const taskTitle = n.task?.title;
  const task = taskTitle ? <TaskTag>{taskTitle}</TaskTag> : null;
  const data = n.data ?? {};
  const role = roleLabel((data as { role?: unknown }).role);
  const from = (data as { from?: string }).from;
  const to = (data as { to?: string }).to;
  const subtask = (data as { subtaskTitle?: string }).subtaskTitle;

  switch (n.type) {
    case "project_assigned":
      return (
        <>
          {actor} assigned you to {project}
          {role ? (
            <>
              {" as "}
              <RoleTag>{role}</RoleTag>
            </>
          ) : null}
        </>
      );
    case "project_unassigned":
      return (
        <>
          {actor} removed you from {project}
          {role ? (
            <>
              {" ("}
              <RoleTag>{role}</RoleTag>
              {")"}
            </>
          ) : null}
        </>
      );
    case "task_assigned":
      return (
        <>
          {actor} assigned you to {task}
          {project ? (
            <>
              {" in "}
              {project}
            </>
          ) : null}
          {role ? (
            <>
              {" as "}
              <RoleTag>{role}</RoleTag>
            </>
          ) : null}
        </>
      );
    case "task_unassigned":
      return (
        <>
          {actor} removed you from {task}
          {role ? (
            <>
              {" ("}
              <RoleTag>{role}</RoleTag>
              {")"}
            </>
          ) : null}
        </>
      );
    case "task_status_changed":
      return (
        <>
          {actor} changed status of {task} from <StatusTag>{from}</StatusTag>{" "}
          to <StatusTag>{to}</StatusTag>
        </>
      );
    case "mention_project":
      return (
        <>
          {actor} mentioned you in {project}
        </>
      );
    case "mention_task":
      return (
        <>
          {actor} mentioned you in {task}
        </>
      );
    case "mention_subtask":
      return (
        <>
          {actor} mentioned you in subtask{" "}
          <SubtaskTag>{subtask ?? ""}</SubtaskTag>
        </>
      );
    default:
      return n.message;
  }
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    items,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    loadList,
    loadMore,
    markRead,
    markAllRead,
    remove,
  } = useNotifications();

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next) await loadList();
  };

  const handleItemClick = async (n: NotificationItem) => {
    const href = buildHref(n);
    if (!n.read) await markRead([n._id]);
    setOpen(false);
    if (href) router.push(href);
  };

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!hasMore || loadingMore || loading) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 80) loadMore();
  }, [hasMore, loadingMore, loading, loadMore]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, onScroll]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full size-9"
          aria-label="Open notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[26rem] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5">
                {unreadCount} new
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => markAllRead()}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="size-3.5 mr-1" />
            Mark all read
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="h-[440px] overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Bell className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground mt-1">
                New notifications appear here.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {items.map((n) => {
                  const href = buildHref(n);
                  const inner = (
                    <div
                      className={cn(
                        "group flex items-start gap-2 px-4 py-3 text-left w-full cursor-pointer hover:bg-accent/50 transition-colors",
                        !n.read && "bg-primary/5"
                      )}
                      onClick={() => handleItemClick(n)}
                    >
                      <div
                        className={cn(
                          "mt-1.5 size-2 rounded-full shrink-0",
                          n.read ? "bg-transparent" : "bg-primary"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug break-words pr-1 text-muted-foreground">
                          {renderPreview(n)}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{formatTime(n.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!n.read && (
                          <button
                            type="button"
                            aria-label="Mark as read"
                            title="Mark as read"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markRead([n._id]);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <CheckCheck className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Delete notification"
                          title="Delete"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            remove(n._id);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n._id}>
                      {href ? (
                        <Link
                          href={href}
                          className="block"
                          onClick={(e) => {
                            e.preventDefault();
                            handleItemClick(n);
                          }}
                        >
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
              {loadingMore && (
                <div className="flex items-center justify-center py-3 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin mr-2" />
                  <span className="text-[11px]">Loading more…</span>
                </div>
              )}
              {!hasMore && !loadingMore && items.length > 0 && (
                <div className="py-3 text-center text-[11px] text-muted-foreground">
                  No more notifications
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
