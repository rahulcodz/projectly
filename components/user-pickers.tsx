"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserInitialsAvatar } from "@/components/role-status-badge";
import { cn } from "@/lib/utils";
import { type UserRole } from "@/lib/roles";

export type UserLite = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
};

const controlClasses =
  "shadow-none border-border bg-background focus-visible:ring-primary/30 focus-visible:border-primary/60";

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
    if (!open) setQuery("");
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

export function UserSinglePicker({
  selected,
  onChange,
  placeholder = "Select person",
}: {
  selected: UserLite | null;
  onChange: (u: UserLite | null) => void;
  placeholder?: string;
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
            <span className="text-muted-foreground">{placeholder}</span>
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

export function UserMultiPicker({
  selected,
  onChange,
  placeholder = "Select people",
}: {
  selected: UserLite[];
  onChange: (list: UserLite[]) => void;
  placeholder?: string;
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
            <span className="text-muted-foreground px-1">{placeholder}</span>
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
