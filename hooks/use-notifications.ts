"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NotificationItem = {
  _id: string;
  type: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  actor: { _id: string; name: string; email: string; role: string } | null;
  project: { _id: string; name: string; projectId: string } | null;
  task: { _id: string; title: string; taskId?: string } | null;
  comment: string | null;
  data: Record<string, unknown>;
};

export type NotificationsState = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadList: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const DEFAULT_POLL_MS = 30_000;
const HIDDEN_POLL_MS = 120_000;
const PAGE_SIZE = 15;

export function useNotifications(options?: {
  pollMs?: number;
  hiddenPollMs?: number;
  pageSize?: number;
}): NotificationsState {
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const hiddenPollMs = options?.hiddenPollMs ?? HIDDEN_POLL_MS;
  const pageSize = options?.pageSize ?? PAGE_SIZE;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current && typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/notifications?limit=${pageSize}&page=1`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      if (!mountedRef.current) return;
      setItems(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
      pageRef.current = 1;
      totalPagesRef.current = data.totalPages ?? 1;
      setHasMore((data.totalPages ?? 1) > 1);
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [pageSize]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (pageRef.current >= totalPagesRef.current) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/notifications?limit=${pageSize}&page=${nextPage}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load more");
      const data = await res.json();
      if (!mountedRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        const extra = (data.notifications ?? []).filter(
          (n: NotificationItem) => !seen.has(n._id)
        );
        return [...prev, ...extra];
      });
      pageRef.current = nextPage;
      totalPagesRef.current = data.totalPages ?? totalPagesRef.current;
      setHasMore(nextPage < (data.totalPages ?? 1));
      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loading, loadingMore, pageSize]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchCount(), loadList()]);
  }, [fetchCount, loadList]);

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const toMark = ids;
    setItems((prev) =>
      prev.map((n) =>
        toMark.includes(n._id) && !n.read
          ? { ...n, read: true, readAt: new Date().toISOString() }
          : n
      )
    );
    setUnreadCount((c) => {
      const unmarkedDelta = toMark.length;
      return Math.max(0, c - unmarkedDelta);
    });
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: toMark }),
      });
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) =>
      prev.map((n) =>
        n.read ? n : { ...n, read: true, readAt: new Date().toISOString() }
      )
    );
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // ignore
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    let wasUnread = false;
    setItems((prev) => {
      const target = prev.find((n) => n._id === id);
      wasUnread = !!target && !target.read;
      return prev.filter((n) => n._id !== id);
    });
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    } catch {
      // ignore — next poll reconciles
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const tick = async () => {
      await fetchCount();
      if (!mountedRef.current) return;
      const delay =
        typeof document !== "undefined" && document.visibilityState === "hidden"
          ? hiddenPollMs
          : pollMs;
      timerRef.current = setTimeout(tick, delay);
    };

    tick();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (timerRef.current) clearTimeout(timerRef.current);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchCount, pollMs, hiddenPollMs]);

  return {
    items,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadList,
    loadMore,
    markRead,
    markAllRead,
    remove,
  };
}
