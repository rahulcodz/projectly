"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Extension, Mark, Node as TipTapNode } from "@tiptap/react";
import { ReactRenderer, useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import {
  TaskHashList,
  type TaskHashItem,
  type TaskHashListHandle,
} from "@/components/task-hash-list";
import {
  Bold,
  Code,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  MentionList,
  type MentionItem,
  type MentionListHandle,
} from "@/components/mention-list";

export type MentionUser = {
  _id: string;
  name: string;
  email?: string;
  role?: import("@/lib/roles").UserRole;
};

export type HashTask = {
  _id: string;
  taskId: string;
  title: string;
  projectId: string;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  invalid?: boolean;
  onFocus?: () => void;
  mentionUsers?: MentionUser[];
  hashTasks?: HashTask[];
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write… @mention people, #link tasks, paste URLs",
  minHeight = "min-h-24",
  invalid = false,
  onFocus,
  mentionUsers,
  hashTasks,
}: Props) {
  const items: MentionItem[] = useMemo(() => {
    if (!mentionUsers) return [];
    const seen = new Set<string>();
    const out: MentionItem[] = [];
    for (const u of mentionUsers) {
      if (!u?._id || seen.has(u._id)) continue;
      seen.add(u._id);
      out.push({ id: u._id, label: u.name, email: u.email, role: u.role });
    }
    return out;
  }, [mentionUsers]);

  const taskItems: TaskHashItem[] = useMemo(() => {
    if (!hashTasks) return [];
    const seen = new Set<string>();
    const out: TaskHashItem[] = [];
    for (const t of hashTasks) {
      if (!t?._id || !t.taskId || seen.has(t._id)) continue;
      seen.add(t._id);
      out.push({
        id: t._id,
        taskId: t.taskId,
        title: t.title,
        projectId: t.projectId,
      });
    }
    return out;
  }, [hashTasks]);

  const extensions = useMemo(() => {
    const base: (Extension | Mark | TipTapNode)[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: "bg-muted rounded p-2 text-xs" } },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
    ];

    if (taskItems.length > 0) {
      const Hashtag = Mention.extend({
        name: "hashtag",
        addAttributes() {
          return {
            id: {
              default: null,
              parseHTML: (el: HTMLElement) => el.getAttribute("data-id"),
              renderHTML: (attrs: { id?: string | null }) =>
                attrs.id ? { "data-id": attrs.id } : {},
            },
            label: {
              default: null,
              parseHTML: (el: HTMLElement) => el.getAttribute("data-label"),
              renderHTML: (attrs: { label?: string | null }) =>
                attrs.label ? { "data-label": attrs.label } : {},
            },
            projectId: {
              default: null,
              parseHTML: (el: HTMLElement) =>
                el.getAttribute("data-project-id"),
              renderHTML: (attrs: { projectId?: string | null }) =>
                attrs.projectId
                  ? { "data-project-id": attrs.projectId }
                  : {},
            },
          };
        },
        parseHTML() {
          return [{ tag: "a[data-type='hashtag']" }];
        },
        renderHTML({
          node,
          HTMLAttributes,
        }: {
          node: { attrs: { id?: string; label?: string; projectId?: string } };
          HTMLAttributes: Record<string, unknown>;
        }) {
          const pid = node.attrs.projectId;
          const tid = node.attrs.id;
          const label = node.attrs.label ?? tid ?? "";
          const href = pid && tid ? `/dashboard/projects/${pid}?task=${tid}` : "#";
          return [
            "a",
            {
              ...HTMLAttributes,
              href,
              class: "task-ref",
              target: "_self",
              rel: "noopener",
              "data-type": "hashtag",
              "data-id": tid ?? "",
              "data-label": label,
              "data-project-id": pid ?? "",
            },
            `#${label}`,
          ];
        },
      });

      base.push(
        Hashtag.configure({
          suggestion: {
            char: "#",
            items: ({ query }: { query: string }) => {
              const q = query.toLowerCase();
              return taskItems
                .filter(
                  (i) =>
                    i.taskId.toLowerCase().includes(q) ||
                    i.title.toLowerCase().includes(q)
                )
                .slice(0, 8);
            },
            command: (({
              editor,
              range,
              props,
            }: {
              editor: import("@tiptap/react").Editor;
              range: { from: number; to: number };
              props: { id?: string; label?: string; projectId?: string };
            }) => {
              const id = props.id ?? "";
              const label = props.label ?? "";
              const projectId = props.projectId ?? "";
              editor
                .chain()
                .focus()
                .insertContentAt(range, [
                  {
                    type: "hashtag",
                    attrs: { id, label, projectId },
                  },
                  { type: "text", text: " " },
                ])
                .run();
            }) as unknown as undefined,
            render: () => {
              let component: ReactRenderer<TaskHashListHandle> | null = null;
              let popup: HTMLDivElement | null = null;

              const positionPopup = (rect: DOMRect | null | undefined) => {
                if (!popup || !rect) return;
                const pad = 6;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const width = popup.offsetWidth || 240;
                const height = popup.offsetHeight || 200;
                let left = rect.left;
                let top = rect.bottom + pad;
                if (left + width > vw - 8) left = vw - width - 8;
                if (left < 8) left = 8;
                if (top + height > vh - 8) {
                  top = Math.max(8, rect.top - height - pad);
                }
                popup.style.left = `${left}px`;
                popup.style.top = `${top}px`;
              };

              return {
                onStart: (props: SuggestionProps) => {
                  component = new ReactRenderer(TaskHashList, {
                    props,
                    editor: props.editor,
                  });
                  popup = document.createElement("div");
                  popup.style.position = "fixed";
                  popup.style.zIndex = "60";
                  popup.appendChild(component.element);
                  document.body.appendChild(popup);
                  positionPopup(props.clientRect?.());
                },
                onUpdate: (props: SuggestionProps) => {
                  component?.updateProps(props);
                  positionPopup(props.clientRect?.());
                },
                onKeyDown: (props: SuggestionKeyDownProps) => {
                  if (props.event.key === "Escape") {
                    popup?.remove();
                    popup = null;
                    component?.destroy();
                    component = null;
                    return true;
                  }
                  return (
                    component?.ref?.onKeyDown({ event: props.event }) ?? false
                  );
                },
                onExit: () => {
                  popup?.remove();
                  popup = null;
                  component?.destroy();
                  component = null;
                },
              };
            },
          },
        })
      );
    }

    if (items.length > 0) {
      base.push(
        Mention.configure({
          HTMLAttributes: {
            class: "mention",
            "data-type": "mention",
          },
          suggestion: {
            char: "@",
            items: ({ query }) => {
              const q = query.toLowerCase();
              return items
                .filter(
                  (i) =>
                    i.label.toLowerCase().includes(q) ||
                    (i.email ?? "").toLowerCase().includes(q)
                )
                .slice(0, 8);
            },
            render: () => {
              let component: ReactRenderer<MentionListHandle> | null = null;
              let popup: HTMLDivElement | null = null;

              const positionPopup = (rect: DOMRect | null | undefined) => {
                if (!popup || !rect) return;
                const pad = 6;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const width = popup.offsetWidth || 240;
                const height = popup.offsetHeight || 200;
                let left = rect.left;
                let top = rect.bottom + pad;
                if (left + width > vw - 8) left = vw - width - 8;
                if (left < 8) left = 8;
                if (top + height > vh - 8) {
                  top = Math.max(8, rect.top - height - pad);
                }
                popup.style.left = `${left}px`;
                popup.style.top = `${top}px`;
              };

              return {
                onStart: (props: SuggestionProps) => {
                  component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                  });
                  popup = document.createElement("div");
                  popup.style.position = "fixed";
                  popup.style.zIndex = "60";
                  popup.appendChild(component.element);
                  document.body.appendChild(popup);
                  positionPopup(props.clientRect?.());
                },
                onUpdate: (props: SuggestionProps) => {
                  component?.updateProps(props);
                  positionPopup(props.clientRect?.());
                },
                onKeyDown: (props: SuggestionKeyDownProps) => {
                  if (props.event.key === "Escape") {
                    popup?.remove();
                    popup = null;
                    component?.destroy();
                    component = null;
                    return true;
                  }
                  return (
                    component?.ref?.onKeyDown({ event: props.event }) ?? false
                  );
                },
                onExit: () => {
                  popup?.remove();
                  popup = null;
                  component?.destroy();
                  component = null;
                },
              };
            },
          },
        })
      );
    }

    return base;
  }, [placeholder, items, taskItems]);

  const editor = useEditor({
    extensions,
    content: value || "",
    editorProps: {
      attributes: {
        class: cn("rich-text focus:outline-none px-3 py-2", minHeight),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    onFocus,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border bg-background text-sm text-muted-foreground",
          minHeight
        )}
      >
        <div className="p-3">Loading editor…</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background",
        invalid
          ? "border-destructive ring-1 ring-destructive/20"
          : "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30"
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          label="Strikethrough"
        >
          <Strikethrough className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          label="Inline code"
        >
          <Code className="size-3.5" />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="Numbered list"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Quote"
        >
          <Quote className="size-3.5" />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as
              | string
              | undefined;
            const url = window.prompt("URL", prev ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
          }}
          label="Link"
        >
          <LinkIcon className="size-3.5" />
        </ToolbarButton>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          label="Undo"
        >
          <Undo className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          label="Redo"
        >
          <Redo className="size-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 px-2",
        active && "bg-primary/10 text-primary hover:bg-primary/15"
      )}
    >
      {children}
    </Button>
  );
}

export function RichTextViewer({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const anchor = t?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      let pid = anchor.getAttribute("data-project-id");
      let tid = anchor.getAttribute("data-id");
      if (!pid || !tid) {
        const href = anchor.getAttribute("href") ?? "";
        const m = href.match(/\/dashboard\/projects\/([^/?#]+)\?task=([^&#]+)/);
        if (m) {
          pid = m[1];
          tid = m[2];
        }
      }
      if (!pid || !tid) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(`/dashboard/projects/${pid}?task=${tid}`);
    };
    node.addEventListener("click", handler);
    return () => {
      node.removeEventListener("click", handler);
    };
  }, [router, html]);

  return (
    <div
      ref={ref}
      className={cn("rich-text text-sm", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
