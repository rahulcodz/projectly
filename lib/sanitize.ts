import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "hr",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeRichHtml(input: string): string {
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["style", "onerror", "onclick"],
  });
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").trim();
}
