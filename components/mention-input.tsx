"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import {
  MentionList,
  type MentionItem,
  type MentionListHandle,
} from "@/components/mention-list";
import {
  TaskHashList,
  type TaskHashItem,
  type TaskHashListHandle,
} from "@/components/task-hash-list";
import {
  type MentionUser,
  type HashTask,
} from "@/components/rich-text-editor";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onMention?: (userId: string) => void;
  onTaskRef?: (taskId: string) => void;
  mentionUsers?: MentionUser[];
  hashTasks?: HashTask[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
};

export type MentionInputHandle = {
  focus: () => void;
};

type PopupState =
  | { kind: "mention"; query: string; start: number; end: number }
  | { kind: "hash"; query: string; start: number; end: number }
  | null;

export const MentionInput = forwardRef<MentionInputHandle, Props>(
  function MentionInput(
    {
      value,
      onChange,
      onMention,
      onTaskRef,
      mentionUsers = [],
      hashTasks = [],
      placeholder,
      autoFocus,
      className,
      disabled,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const mentionListRef = useRef<MentionListHandle>(null);
    const hashListRef = useRef<TaskHashListHandle>(null);
    const [popup, setPopup] = useState<PopupState>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    function detectContext(): PopupState {
      const el = inputRef.current;
      if (!el) return null;
      const pos = el.selectionStart ?? value.length;
      const before = value.slice(0, pos);
      const atIdx = before.lastIndexOf("@");
      const hashIdx = before.lastIndexOf("#");
      const triggerIdx = Math.max(atIdx, hashIdx);
      if (triggerIdx < 0) return null;
      if (triggerIdx > 0 && !/\s/.test(value.charAt(triggerIdx - 1)))
        return null;
      const between = before.slice(triggerIdx + 1);
      if (/\s/.test(between)) return null;
      if (between.length > 40) return null;
      const kind = triggerIdx === hashIdx ? "hash" : "mention";
      return { kind, query: between, start: triggerIdx, end: pos };
    }

    function refreshPopup() {
      const ctx = detectContext();
      if (!ctx) {
        setPopup(null);
        return;
      }
      if (ctx.kind === "mention" && mentionUsers.length === 0) {
        setPopup(null);
        return;
      }
      if (ctx.kind === "hash" && hashTasks.length === 0) {
        setPopup(null);
        return;
      }
      setPopup(ctx);
    }

    useEffect(() => {
      refreshPopup();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, mentionUsers, hashTasks]);

    const mentionItems: MentionItem[] = useMemo(() => {
      if (!popup || popup.kind !== "mention") return [];
      const q = popup.query.toLowerCase();
      return mentionUsers
        .filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q)
        )
        .slice(0, 8)
        .map((u) => ({
          id: u._id,
          label: u.name,
          email: u.email,
          role: u.role,
        }));
    }, [popup, mentionUsers]);

    const hashItems: TaskHashItem[] = useMemo(() => {
      if (!popup || popup.kind !== "hash") return [];
      const q = popup.query.toLowerCase();
      return hashTasks
        .filter(
          (t) =>
            t.taskId.toLowerCase().includes(q) ||
            t.title.toLowerCase().includes(q)
        )
        .slice(0, 8)
        .map((t) => ({
          id: t._id,
          taskId: t.taskId,
          title: t.title,
          projectId: t.projectId,
        }));
    }, [popup, hashTasks]);

    function applyInsert(text: string) {
      if (!popup) return;
      const before = value.slice(0, popup.start);
      const after = value.slice(popup.end);
      const next = before + text + after;
      onChange(next);
      setPopup(null);
      queueMicrotask(() => {
        const el = inputRef.current;
        if (el) {
          const pos = before.length + text.length;
          el.focus();
          el.setSelectionRange(pos, pos);
        }
      });
    }

    function applyMention(item: { id: string; label: string }) {
      applyInsert(`@${item.label} `);
      onMention?.(item.id);
    }

    function applyHash(item: { id: string; label: string }) {
      applyInsert(`#${item.label} `);
      onTaskRef?.(item.id);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (!popup) return;
      if (popup.kind === "mention" && mentionItems.length > 0 && mentionListRef.current) {
        const handled = mentionListRef.current.onKeyDown({
          event: e.nativeEvent as KeyboardEvent,
        });
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (popup.kind === "hash" && hashItems.length > 0 && hashListRef.current) {
        const handled = hashListRef.current.onKeyDown({
          event: e.nativeEvent as KeyboardEvent,
        });
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setPopup(null);
      }
    }

    return (
      <div className={cn("relative w-full", className)}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={refreshPopup}
          onClick={refreshPopup}
          onBlur={() => window.setTimeout(() => setPopup(null), 120)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className="h-8 shadow-none"
        />
        {popup && popup.kind === "mention" && mentionItems.length > 0 ? (
          <div className="absolute left-0 top-full z-[60] mt-1">
            <MentionList
              ref={mentionListRef}
              items={mentionItems}
              command={applyMention}
            />
          </div>
        ) : null}
        {popup && popup.kind === "hash" && hashItems.length > 0 ? (
          <div className="absolute left-0 top-full z-[60] mt-1">
            <TaskHashList
              ref={hashListRef}
              items={hashItems}
              command={applyHash}
            />
          </div>
        ) : null}
      </div>
    );
  }
);
