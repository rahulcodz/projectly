"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

export type TaskHashItem = {
  id: string;
  taskId: string;
  title: string;
  projectId: string;
};

type Props = {
  items: TaskHashItem[];
  command: (item: { id: string; label: string; projectId: string }) => void;
};

export type TaskHashListHandle = {
  onKeyDown: (args: { event: KeyboardEvent }) => boolean;
};

export const TaskHashList = forwardRef<TaskHashListHandle, Props>(
  function TaskHashList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    function select(index: number) {
      const item = items[index];
      if (!item) return;
      command({
        id: item.id,
        label: item.taskId,
        projectId: item.projectId,
      });
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
          <div className="mention-empty">No matching tasks</div>
        ) : (
          <div className="mention-popup-list">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                className={`mention-item task-hash-item${
                  index === selectedIndex ? " is-selected" : ""
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(index);
                }}
              >
                <span className="task-hash-id">#{item.taskId}</span>
                <span className="task-hash-title">{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
