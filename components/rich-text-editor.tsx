"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
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

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  invalid?: boolean;
  onFocus?: () => void;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  minHeight = "min-h-24",
  invalid = false,
  onFocus,
}: Props) {
  const editor = useEditor({
    extensions: [
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
    ],
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
  return (
    <div
      className={cn("rich-text text-sm", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
