"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Extension, Mark, Node as TipTapNode } from "@tiptap/react";
import { Node, ReactRenderer, useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import {
  detectMediaKind,
  embedUrlFor,
  filenameFromUrl,
  type MediaKind,
} from "@/lib/media-embed";
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
  maxHeight?: string;
  invalid?: boolean;
  onFocus?: () => void;
  mentionUsers?: MentionUser[];
  hashTasks?: HashTask[];
};

const MediaEmbed = Node.create({
  name: "mediaEmbed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null as string | null },
      kind: { default: "file" as MediaKind },
      filename: { default: null as string | null },
    };
  },
  parseHTML() {
    return [
      { tag: "div[data-type='media-embed']" },
      {
        tag: "img[data-type='media-embed']",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          kind: "image" as MediaKind,
          filename: (el as HTMLElement).getAttribute("alt"),
        }),
      },
      {
        tag: "video[data-type='media-embed']",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          kind: "video" as MediaKind,
        }),
      },
      {
        tag: "audio[data-type='media-embed']",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("src"),
          kind: "audio" as MediaKind,
        }),
      },
      {
        tag: "iframe[data-type='media-embed']",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("data-src") ?? (el as HTMLElement).getAttribute("src"),
          kind: ((el as HTMLElement).getAttribute("data-kind") ?? "pdf") as MediaKind,
          filename: (el as HTMLElement).getAttribute("data-filename"),
        }),
      },
      {
        tag: "a[data-type='media-embed']",
        getAttrs: (el) => ({
          src: (el as HTMLElement).getAttribute("href"),
          kind: "file" as MediaKind,
          filename: (el as HTMLElement).getAttribute("data-filename"),
        }),
      },
    ];
  },
  renderHTML({ node }) {
    const src = node.attrs.src as string | null;
    const kind = node.attrs.kind as MediaKind;
    const filename = (node.attrs.filename as string | null) ?? "";
    if (!src) return ["div", { "data-type": "media-embed" }];
    if (kind === "image") {
      return [
        "img",
        {
          src,
          alt: filename,
          "data-type": "media-embed",
          "data-kind": "image",
          class: "media-embed media-embed-image",
          loading: "lazy",
        },
      ];
    }
    if (kind === "video") {
      return [
        "video",
        {
          src,
          controls: "controls",
          preload: "metadata",
          "data-type": "media-embed",
          "data-kind": "video",
          class: "media-embed media-embed-video",
        },
      ];
    }
    if (kind === "audio") {
      return [
        "audio",
        {
          src,
          controls: "controls",
          preload: "metadata",
          "data-type": "media-embed",
          "data-kind": "audio",
          class: "media-embed media-embed-audio",
        },
      ];
    }
    if (kind === "pdf") {
      return [
        "iframe",
        {
          src,
          "data-src": src,
          "data-type": "media-embed",
          "data-kind": "pdf",
          "data-filename": filename,
          class: "media-embed media-embed-pdf",
          loading: "lazy",
          frameborder: "0",
        },
      ];
    }
    if (kind === "office") {
      return [
        "iframe",
        {
          src: embedUrlFor("office", src),
          "data-src": src,
          "data-type": "media-embed",
          "data-kind": "office",
          "data-filename": filename,
          class: "media-embed media-embed-office",
          loading: "lazy",
          frameborder: "0",
        },
      ];
    }
    if (kind === "youtube" || kind === "vimeo") {
      return [
        "iframe",
        {
          src: embedUrlFor(kind, src),
          "data-src": src,
          "data-type": "media-embed",
          "data-kind": kind,
          class: `media-embed media-embed-${kind}`,
          loading: "lazy",
          frameborder: "0",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          allowfullscreen: "true",
        },
      ];
    }
    return [
      "a",
      {
        href: src,
        target: "_blank",
        rel: "noopener noreferrer",
        "data-type": "media-embed",
        "data-kind": "file",
        "data-filename": filename,
        class: "media-embed media-embed-file",
      },
      filename || src,
    ];
  },
});

function insertMediaFromUrl(
  editor: import("@tiptap/react").Editor,
  url: string
): boolean {
  const kind = detectMediaKind(url);
  if (!kind) return false;
  editor
    .chain()
    .focus()
    .insertContent({
      type: "mediaEmbed",
      attrs: {
        src: url,
        kind,
        filename: filenameFromUrl(url),
      },
    })
    .run();
  return true;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write… @mention people, #link tasks, paste URLs",
  minHeight = "min-h-24",
  maxHeight = "max-h-80",
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
      MediaEmbed,
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
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain")?.trim();
        if (!text) return false;
        if (!/^https?:\/\/\S+$/i.test(text)) return false;
        const kind = detectMediaKind(text);
        if (!kind) return false;
        const schema = view.state.schema;
        const nodeType = schema.nodes.mediaEmbed;
        if (!nodeType) return false;
        const node = nodeType.create({
          src: text,
          kind,
          filename: filenameFromUrl(text),
        });
        const tr = view.state.tr.replaceSelectionWith(node);
        view.dispatch(tr);
        return true;
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
            if (insertMediaFromUrl(editor, url)) return;
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
      <div className={cn("overflow-y-auto", maxHeight)}>
        <EditorContent editor={editor} />
      </div>
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

type MediaInfo = {
  src: string;
  kind: MediaKind;
  filename?: string;
};

const MEDIA_ICONS: Record<string, string> = {
  image:
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"><rect x="6" y="10" width="52" height="44" rx="3"/><circle cx="22" cy="24" r="4" fill="currentColor" stroke="none"/><path d="M10 48 24 32l10 10 8-8 12 14"/></svg>',
  video:
    '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="4" fill="#6b7280"/><polygon points="28,22 46,32 28,42" fill="white"/></svg>',
  audio:
    '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 46V18l24-4v28"/><circle cx="16" cy="46" r="6" fill="currentColor" stroke="none"/><circle cx="46" cy="42" r="6" fill="currentColor" stroke="none"/></svg>',
  pdf:
    '<svg viewBox="0 0 64 64" fill="none"><path d="M14 6h26l12 12v36a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M40 6v12h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><rect x="8" y="36" width="44" height="16" rx="2" fill="currentColor"/><text x="32" y="48" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="system-ui, sans-serif" letter-spacing="0.5">PDF</text></svg>',
  office:
    '<svg viewBox="0 0 64 64" fill="none"><rect x="8" y="8" width="48" height="48" rx="4" fill="currentColor"/><text x="32" y="44" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">X</text></svg>',
  vimeo:
    '<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="22" fill="#1ab7ea"/><polygon points="28,22 46,32 28,42" fill="white"/></svg>',
  youtube:
    '<svg viewBox="0 0 64 64" fill="currentColor"><polygon points="22,18 48,32 22,46" fill="white"/></svg>',
};

const OFFICE_VARIANTS: Record<string, { letter: string; color: string }> = {
  xls: { letter: "X", color: "#16a34a" },
  xlsx: { letter: "X", color: "#16a34a" },
  csv: { letter: "C", color: "#0d9488" },
  doc: { letter: "W", color: "#2563eb" },
  docx: { letter: "W", color: "#2563eb" },
  ppt: { letter: "P", color: "#ea580c" },
  pptx: { letter: "P", color: "#ea580c" },
};

function extFromFilename(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
  return m?.[1]?.toLowerCase() ?? "";
}

function youtubeThumb(src: string): string | null {
  try {
    const u = new URL(src);
    let id: string | null = null;
    if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
      id = u.searchParams.get("v");
      if (!id) {
        const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/);
        id = m?.[1] ?? null;
      }
    } else if (/^youtu\.be$/i.test(u.hostname)) {
      const m = u.pathname.match(/^\/([\w-]{6,})/);
      id = m?.[1] ?? null;
    }
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

export function extractMediaEmbedsHtml(html: string): string {
  if (!html || typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = doc.querySelectorAll<HTMLElement>(
    '.media-embed, [data-type="media-embed"]'
  );
  return Array.from(nodes)
    .map((n) => n.outerHTML)
    .join("");
}

export function countMediaEmbeds(html: string): number {
  if (!html || typeof window === "undefined") return 0;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelectorAll('.media-embed, [data-type="media-embed"]').length;
}

export type MediaItem = {
  src: string;
  kind: MediaKind;
  filename: string;
};

export function extractMediaItems(html: string): MediaItem[] {
  if (!html || typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes = doc.querySelectorAll<HTMLElement>(
    '.media-embed, [data-type="media-embed"]'
  );
  const out: MediaItem[] = [];
  for (const n of Array.from(nodes)) {
    const kind = (n.getAttribute("data-kind") || "file") as MediaKind;
    const src =
      n.getAttribute("data-src") ||
      n.getAttribute("src") ||
      n.getAttribute("href") ||
      "";
    if (!src) continue;
    const filename =
      n.getAttribute("data-filename") ||
      n.getAttribute("alt") ||
      filenameFromUrl(src);
    out.push({ src, kind, filename });
  }
  return out;
}

export function MediaThumb({
  item,
  onOpen,
  className,
}: {
  item: MediaItem;
  onOpen: () => void;
  className?: string;
}) {
  const { kind, src, filename } = item;
  const [broken, setBroken] = useState(false);

  const content = (() => {
    if (kind === "image") {
      if (broken) return null;
      return (
        <img
          src={src}
          alt={filename}
          loading="lazy"
          className="media-embed"
          data-kind="image"
          onError={() => setBroken(true)}
        />
      );
    }
    if (kind === "youtube") {
      const poster = youtubeThumb(src);
      return (
        <div
          className="media-embed media-embed-thumb has-bg"
          data-kind="youtube"
        >
          {poster ? (
            <img
              src={poster}
              alt={filename}
              loading="lazy"
              onError={() => setBroken(true)}
            />
          ) : null}
          <div
            className="play"
            dangerouslySetInnerHTML={{ __html: MEDIA_ICONS.youtube }}
          />
        </div>
      );
    }
    return (
      <div
        className="media-embed media-embed-thumb"
        data-kind={kind}
      >
        <span
          className="icon"
          dangerouslySetInnerHTML={{ __html: iconSvgFor(kind, filename) }}
        />
        <span className="label">{filename}</span>
      </div>
    );
  })();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${filename}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(`media-embed-wrap has-${kind}`, className)}
    >
      {kind === "image" && broken ? (
        <div className="media-embed media-embed-thumb" data-kind="image">
          <span
            className="icon"
            dangerouslySetInnerHTML={{ __html: iconSvgFor("image", filename) }}
          />
          <span className="label">{filename}</span>
        </div>
      ) : (
        content
      )}
      <button
        type="button"
        aria-label="Expand preview"
        title="Expand preview"
        className="media-embed-expand"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
        </svg>
      </button>
    </div>
  );
}

function iconSvgFor(kind: MediaKind, filename: string): string {
  if (kind === "office") {
    const ext = extFromFilename(filename);
    const v = OFFICE_VARIANTS[ext] ?? OFFICE_VARIANTS.xlsx;
    return `<svg viewBox="0 0 64 64" fill="none"><rect x="8" y="8" width="48" height="48" rx="4" fill="${v.color}"/><text x="32" y="44" text-anchor="middle" font-size="28" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">${v.letter}</text></svg>`;
  }
  return MEDIA_ICONS[kind] ?? MEDIA_ICONS.office;
}

export { MediaLightbox };

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EXPAND_BTN_HTML =
  '<button type="button" class="media-embed-expand" aria-label="Expand preview" title="Expand preview"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7"/></svg></button>';

function transformMediaInHtml(html: string): string {
  if (!html || typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const embeds = doc.querySelectorAll<HTMLElement>(
    '.media-embed, [data-type="media-embed"]'
  );
  for (const el of Array.from(embeds)) {
    if (el.parentElement?.classList.contains("media-embed-wrap")) continue;
    const kind = (el.getAttribute("data-kind") || "file") as MediaKind;
    const src =
      el.getAttribute("data-src") ||
      el.getAttribute("src") ||
      el.getAttribute("href") ||
      "";
    if (!src) continue;
    const filename =
      el.getAttribute("data-filename") ||
      el.getAttribute("alt") ||
      filenameFromUrl(src);

    if (kind === "file") continue;

    const wrap = doc.createElement("span");
    wrap.className = `media-embed-wrap has-${kind}`;
    wrap.setAttribute("data-src", src);
    wrap.setAttribute("data-kind", kind);
    wrap.setAttribute("data-filename", filename);
    wrap.setAttribute("role", "button");
    wrap.setAttribute("tabindex", "0");

    let inner: string;
    if (kind === "image") {
      inner = `<img class="media-embed" data-kind="image" data-src="${attr(
        src
      )}" src="${attr(src)}" alt="${attr(filename)}" loading="lazy"/>`;
    } else if (kind === "youtube") {
      const poster = youtubeThumb(src);
      inner = `<div class="media-embed media-embed-thumb has-bg" data-kind="youtube" data-src="${attr(
        src
      )}" data-filename="${attr(filename)}">${
        poster
          ? `<img src="${attr(poster)}" alt="${attr(
              filename
            )}" loading="lazy"/>`
          : ""
      }<div class="play">${MEDIA_ICONS.youtube}</div></div>`;
    } else {
      inner = `<div class="media-embed media-embed-thumb" data-kind="${attr(
        kind
      )}" data-src="${attr(src)}" data-filename="${attr(
        filename
      )}"><span class="icon">${iconSvgFor(
        kind,
        filename
      )}</span><span class="label">${escapeText(filename)}</span></div>`;
    }
    wrap.innerHTML = inner + EXPAND_BTN_HTML;
    el.replaceWith(wrap);
  }
  return doc.body.innerHTML;
}

function attr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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
  const [lightbox, setLightbox] = useState<MediaInfo | null>(null);

  const processedHtml = useMemo(() => transformMediaInHtml(html), [html]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;

      const wrap = t?.closest?.(".media-embed-wrap") as HTMLElement | null;
      if (wrap) {
        const kind = (wrap.getAttribute("data-kind") || "file") as MediaKind;
        if (kind === "file") return;
        const src = wrap.getAttribute("data-src") || "";
        if (!src) return;
        const filename = wrap.getAttribute("data-filename") || undefined;
        e.preventDefault();
        e.stopPropagation();
        setLightbox({ src, kind, filename });
        return;
      }

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
  }, [router, processedHtml]);

  return (
    <>
      <div
        ref={ref}
        className={cn("rich-text text-sm", className)}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}

function MediaLightbox({
  media,
  onClose,
}: {
  media: MediaInfo | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [media, onClose]);

  if (!media) return null;

  let content: React.ReactNode;
  if (media.kind === "image") {
    content = (
      <img
        src={media.src}
        alt={media.filename ?? ""}
        className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
      />
    );
  } else if (media.kind === "video") {
    content = (
      <video
        src={media.src}
        controls
        autoPlay
        className="max-h-[90vh] max-w-[95vw] rounded-lg bg-black"
      />
    );
  } else if (media.kind === "audio") {
    content = (
      <audio src={media.src} controls autoPlay className="w-[480px] max-w-[95vw]" />
    );
  } else if (media.kind === "youtube" || media.kind === "vimeo") {
    content = (
      <iframe
        src={embedUrlFor(media.kind, media.src)}
        className="h-[80vh] w-[90vw] max-w-[1200px] rounded-lg bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  } else if (media.kind === "pdf" || media.kind === "office") {
    content = (
      <iframe
        src={embedUrlFor(media.kind, media.src)}
        className="h-[90vh] w-[90vw] max-w-[1200px] rounded-lg bg-white"
      />
    );
  } else {
    content = (
      <a
        href={media.src}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-background px-4 py-3 text-sm underline"
      >
        {media.filename ?? media.src}
      </a>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <div onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
}
