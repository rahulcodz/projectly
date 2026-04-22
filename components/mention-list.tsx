"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { UserInitialsAvatar } from "@/components/role-status-badge";
import { type UserRole } from "@/lib/roles";

export type MentionItem = {
  id: string;
  label: string;
  email?: string;
  role?: UserRole;
};

type Props = {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
};

export type MentionListHandle = {
  onKeyDown: (args: { event: KeyboardEvent }) => boolean;
};

export const MentionList = forwardRef<MentionListHandle, Props>(
  function MentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    function select(index: number) {
      const item = items[index];
      if (!item) return;
      command({ id: item.id, label: item.label });
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          select(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    return (
      <div className="mention-popup" role="listbox">
        {items.length === 0 ? (
          <div className="mention-empty">No matching members</div>
        ) : (
          <div className="mention-popup-list">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                className={`mention-item${
                  index === selectedIndex ? " is-selected" : ""
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(index);
                }}
              >
                <UserInitialsAvatar
                  name={item.label}
                  role={item.role}
                  className="size-6 text-[10px]"
                />
                <span className="mention-name">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
